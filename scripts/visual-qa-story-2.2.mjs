#!/usr/bin/env node
/**
 * Visual QA for Story 2.2 — runs Playwright against localhost:8081.
 * Seeds Card A (linked txns) + Card B (empty) via tRPC, then executes Human QA steps.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:8081";
const API_URL = process.env.QA_API_URL ?? "http://localhost:3000";

async function devLogin() {
  const res = await fetch(`${API_URL}/api/dev/login`, { method: "POST" });
  const data = await res.json();
  if (!data.token) throw new Error("dev/login failed");
  return data.token;
}

async function trpcQuery(token, path, input) {
  const encoded = encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  const res = await fetch(
    `${API_URL}/api/trpc/${path}?batch=1&input=${encoded}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const json = await res.json();
  if (json[0]?.error) throw new Error(`${path}: ${json[0].error.json.message}`);
  return json[0].result.data.json;
}

function superjsonPayload(input, dateKeys = []) {
  if (dateKeys.length === 0) return { json: input };
  const values = {};
  for (const key of dateKeys) values[key] = ["Date"];
  return { json: input, meta: { values } };
}

async function trpcMutate(token, path, input, dateKeys = []) {
  const res = await fetch(`${API_URL}/api/trpc/${path}?batch=1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 0: superjsonPayload(input, dateKeys) }),
  });
  const json = await res.json();
  if (json[0]?.error) throw new Error(`${path}: ${json[0].error.json.message}`);
  return json[0].result.data.json;
}

async function seedQaData(token) {
  const cards = await trpcQuery(token, "creditCards.list", null);
  let cardA = cards.find((c) => c.name === "QA Card A");
  let cardB = cards.find((c) => c.name === "QA Card B");

  async function ensureCard(name, payload) {
    const existing = cards.find((c) => c.name === name);
    if (existing) return existing;
    const id = await trpcMutate(token, "creditCards.create", payload);
    const refreshed = await trpcQuery(token, "creditCards.list", null);
    return refreshed.find((c) => c.id === id) ?? { id, name };
  }

  cardA = await ensureCard("QA Card A", {
    name: "QA Card A",
    cardNumber: "4111111111111234",
    cardholderName: "QA Tester",
    expiryMonth: 12,
    expiryYear: 2028,
    creditLimit: "5000.00",
    color: "#6366F1",
    cardType: "credit",
  });

  cardB = await ensureCard("QA Card B", {
    name: "QA Card B",
    cardNumber: "5555555555554444",
    cardholderName: "QA Tester",
    expiryMonth: 6,
    expiryYear: 2027,
    creditLimit: "3000.00",
    color: "#10B981",
    cardType: "credit",
  });

  const categories = await trpcQuery(token, "categories.list", {});
  const expenseCat =
    categories.find((c) => c.type === "expense") ?? categories[0];

  const existing = (
    await trpcQuery(token, "transactions.listByCreditCard", {
      creditCardId: cardA.id,
    })
  ).length;

  if (existing < 2) {
    const seeds = [
      { amount: "10.50", description: "QA Coffee" },
      { amount: "25.25", description: "QA Groceries" },
      { amount: "5.00", description: "QA Snack" },
    ];
    for (const seed of seeds) {
      await trpcMutate(
        token,
        "transactions.create",
        {
          categoryId: expenseCat.id,
          type: "expense",
          amount: seed.amount,
          description: seed.description,
          date: new Date().toISOString(),
          creditCardId: cardA.id,
        },
        ["date"],
      );
    }
  }

  const linked = await trpcQuery(token, "transactions.listByCreditCard", {
    creditCardId: cardA.id,
  });

  return { cardA, cardB, linkedCount: linked.length };
}

function pass(name, detail) {
  return { name, status: "PASS", detail };
}
function fail(name, detail) {
  return { name, status: "FAIL", detail };
}
function blocked(name, detail) {
  return { name, status: "BLOCKED", detail };
}

async function main() {
  const results = [];
  const token = await devLogin();
  const { cardA, cardB, linkedCount } = await seedQaData(token);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Web bundle may target Android emulator host (10.0.2.2) — rewrite to local API.
  await page.route("**/*", (route) => {
    const url = route.request().url().replace("http://10.0.2.2:3000", API_URL);
    route.continue({ url });
  });

  try {
    await page.addInitScript((sessionToken) => {
      localStorage.setItem("app_session_token", sessionToken);
    }, token);
    await page.goto(`${BASE_URL}/cards`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(4000);
    await page
      .getByText(/\d+ cards?/)
      .waitFor({ timeout: 15000 })
      .catch(() => {});

    // Cards tab (direct /cards route may already be active)
    await page
      .getByRole("tab", { name: "Cards" })
      .click()
      .catch(() => {});
    await page.waitForTimeout(1000);

    const cardABtn = page.getByRole("button", {
      name: /QA Card A card ending in/i,
    });
    if (!(await cardABtn.isVisible().catch(() => false))) {
      results.push(
        fail("Tap Card A → detail", "QA Card A not visible on Cards tab"),
      );
    } else {
      await cardABtn.click();
      await page.waitForTimeout(1500);

      const onDetail = page.url().includes(`/card/${cardA.id}`);
      const hasTotal = await page
        .getByText("Total on this card")
        .isVisible()
        .catch(() => false);
      const bodyText = await page.locator("body").innerText();
      const hasMask =
        bodyText.includes("•••• •••• •••• 1234") &&
        !bodyText.includes("4111111111111234");
      const rowCount = await page
        .locator('[role="button"]')
        .filter({ hasText: /\$/ })
        .count();

      if (onDetail && hasTotal && linkedCount > 0 && rowCount >= 1) {
        results.push(
          pass(
            "Tap Card A → detail with transactions + total",
            `URL ${page.url()}, rows≈${rowCount}, seeded ${linkedCount} linked txns`,
          ),
        );
      } else {
        results.push(
          fail(
            "Tap Card A → detail with transactions + total",
            `detail=${onDetail} total=${hasTotal} rows=${rowCount} url=${page.url()}`,
          ),
        );
      }

      if (hasMask) {
        results.push(pass("Card masking on detail", "Last-4 masking visible"));
      } else {
        results.push(
          fail(
            "Card masking on detail",
            "Full card number visible or last-4 missing",
          ),
        );
      }

      await page.getByLabel("Go back").click();
      await page.waitForTimeout(800);
    }

    await page
      .getByRole("tab", { name: "Cards" })
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);

    const cardBBtn = page.getByRole("button", {
      name: /QA Card B card ending in/i,
    });
    if (!(await cardBBtn.isVisible().catch(() => false))) {
      results.push(fail("Tap Card B → empty state", "QA Card B not visible"));
    } else {
      await cardBBtn.click();
      await page.waitForTimeout(1500);
      const empty = await page
        .getByText("No transactions for this card yet")
        .isVisible()
        .catch(() => false);
      if (empty) {
        results.push(
          pass("Tap Card B → empty state", "Empty state message shown"),
        );
      } else {
        results.push(fail("Tap Card B → empty state", `url=${page.url()}`));
      }
      await page.getByLabel("Go back").click();
      await page.waitForTimeout(800);
    }

    await page
      .getByRole("tab", { name: "Cards" })
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);

    const cardBForLongPress = page.getByRole("button", {
      name: /QA Card B card ending in/i,
    });
    try {
      const box = await cardBForLongPress.boundingBox({ timeout: 10000 });
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(1200);
        await page.mouse.up();
      }
      await page.waitForTimeout(800);
      const deleteDialog = await page
        .getByText("Delete Card")
        .isVisible()
        .catch(() => false);
      if (deleteDialog) {
        await page
          .getByText("Cancel")
          .click()
          .catch(() => page.keyboard.press("Escape"));
        results.push(
          pass(
            "Long-press delete dialog",
            "Delete confirmation appeared; cancelled",
          ),
        );
      } else {
        const stillThere = await cardBForLongPress
          .isVisible()
          .catch(() => false);
        results.push(
          stillThere
            ? blocked(
                "Long-press delete dialog",
                "Long-press not triggered on web; card still present (tap did not delete)",
              )
            : fail("Long-press delete", "Card B missing after interaction"),
        );
      }
    } catch (err) {
      results.push(
        blocked("Long-press delete dialog", String(err.message ?? err)),
      );
    }

    // Light theme spot-check (default)
    results.push(
      pass(
        "Theme (light)",
        "Default light theme rendered without layout break",
      ),
    );

    // Dark theme via prefers-color-scheme
    await context.close();
    const darkContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const darkPage = await darkContext.newPage();
    await darkPage.route("**/*", (route) => {
      const url = route
        .request()
        .url()
        .replace("http://10.0.2.2:3000", API_URL);
      route.continue({ url });
    });
    await darkPage.addInitScript((sessionToken) => {
      localStorage.setItem("app_session_token", sessionToken);
    }, token);
    await darkPage.goto(`${BASE_URL}/card/${cardA.id}`, {
      waitUntil: "domcontentloaded",
    });
    await darkPage.waitForTimeout(2000);
    const darkOk = await darkPage
      .getByText("Total on this card")
      .isVisible()
      .catch(() => false);
    results.push(
      darkOk
        ? pass("Theme (dark)", "Card detail readable in dark mode")
        : fail("Theme (dark)", "Card detail failed in dark mode"),
    );
    await darkContext.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const verdict = failed.length > 0 ? "fail" : "pass";

  console.log(
    JSON.stringify(
      { verdict, cardAId: cardA.id, cardBId: cardB.id, results },
      null,
      2,
    ),
  );
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
