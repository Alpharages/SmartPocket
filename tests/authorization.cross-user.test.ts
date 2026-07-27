/**
 * Cross-tenant authorization regression tests.
 *
 * QA report SP-001 / SP-002 / SP-023: `categories.*` and `creditCards.*` keyed
 * their reads and writes on `id` alone, so any authenticated user could read,
 * modify or delete another user's rows — including overwriting a stored PAN.
 * The correctly-scoped routers (accounts, transactions, budgets, loans) act as
 * the control: they must keep behaving exactly as they did.
 *
 * This suite drives the real appRouter against the real db layer with two
 * distinct users sharing one datastore.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { appRouter } from "@/server/routers";
import * as db from "@/server/db";
import type { TrpcContext } from "@/server/_core/context";

function callerFor(user: unknown) {
  const ctx = {
    user,
    req: { headers: {} },
    res: { cookie() {}, clearCookie() {} },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

type Caller = ReturnType<typeof callerFor>;

let victim: any;
let attacker: any;
let asVictim: Caller;
let asAttacker: Caller;
let victimCategoryId: number;
let victimCardId: number;

beforeAll(async () => {
  await db.upsertUser({
    openId: "authz-victim",
    name: "Victim",
    email: "victim@example.com",
    loginMethod: "test",
    lastSignedIn: new Date(),
  });
  await db.upsertUser({
    openId: "authz-attacker",
    name: "Attacker",
    email: "attacker@example.com",
    loginMethod: "test",
    lastSignedIn: new Date(),
  });
  victim = await db.getUserByOpenId("authz-victim");
  attacker = await db.getUserByOpenId("authz-attacker");
  asVictim = callerFor(victim);
  asAttacker = callerFor(attacker);

  await asVictim.categories.create({
    name: "Victim Private Category",
    type: "expense",
    color: "#123456",
  });
  const cats = await asVictim.categories.list();
  victimCategoryId = cats.find(
    (c: any) => c.name === "Victim Private Category",
  ).id;

  await asVictim.creditCards.create({
    name: "Victim Amex",
    cardNumber: "378282246310005",
    cardholderName: "Victim Real Name",
    expiryMonth: 12,
    expiryYear: 2030,
    creditLimit: "9000.00",
    color: "#123456",
    cardType: "credit",
  });
  const cards = await asVictim.creditCards.list();
  victimCardId = cards[0].id;
});

describe("categories — cross-user access is denied (SP-001)", () => {
  it("getById does not leak another user's category", async () => {
    await expect(
      asAttacker.categories.getById({ id: victimCategoryId }),
    ).resolves.toBeNull();
  });

  it("update cannot modify another user's category", async () => {
    await expect(
      asAttacker.categories.update({
        id: victimCategoryId,
        name: "PWNED",
        type: "expense",
        color: "#000000",
      }),
    ).rejects.toThrow(/not found/i);

    const still = await asVictim.categories.getById({ id: victimCategoryId });
    expect(still.name).toBe("Victim Private Category");
  });

  it("delete cannot remove another user's category", async () => {
    await expect(
      asAttacker.categories.delete({ id: victimCategoryId }),
    ).rejects.toThrow(/not found/i);

    const still = await asVictim.categories.list();
    expect(still.some((c: any) => c.id === victimCategoryId)).toBe(true);
  });

  it("the owner can still read, update and use their own category", async () => {
    const own = await asVictim.categories.getById({ id: victimCategoryId });
    expect(own.name).toBe("Victim Private Category");
    await asVictim.categories.update({
      id: victimCategoryId,
      name: "Renamed By Owner",
      type: "expense",
      color: "#123456",
    });
    const after = await asVictim.categories.getById({ id: victimCategoryId });
    expect(after.name).toBe("Renamed By Owner");
  });
});

describe("credit cards — cross-user access is denied (SP-002)", () => {
  it("getById does not leak another user's card metadata", async () => {
    await expect(
      asAttacker.creditCards.getById({ id: victimCardId }),
    ).resolves.toBeNull();
  });

  it("update cannot overwrite another user's stored card number", async () => {
    await expect(
      asAttacker.creditCards.update({
        id: victimCardId,
        name: "Victim Amex",
        cardNumber: "4111111111111111",
        cardholderName: "Victim Real Name",
        expiryMonth: 12,
        expiryYear: 2030,
        creditLimit: "9000.00",
        color: "#123456",
        cardType: "credit",
      }),
    ).rejects.toThrow(/not found/i);

    const cards = await asVictim.creditCards.list();
    expect(cards[0].cardNumberLast4).toBe("0005");
  });

  it("delete cannot remove another user's card", async () => {
    await expect(
      asAttacker.creditCards.delete({ id: victimCardId }),
    ).rejects.toThrow(/not found/i);

    const cards = await asVictim.creditCards.list();
    expect(cards.some((c: any) => c.id === victimCardId)).toBe(true);
  });

  it("the owner can still read their own card", async () => {
    const own = await asVictim.creditCards.getById({ id: victimCardId });
    expect(own?.cardNumberLast4).toBe("0005");
  });
});

describe("transactions — foreign category/card ids are rejected (SP-023)", () => {
  it("create rejects another user's categoryId", async () => {
    await expect(
      asAttacker.transactions.create({
        categoryId: victimCategoryId,
        type: "expense",
        amount: "10.00",
        date: new Date(),
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("create rejects another user's creditCardId", async () => {
    await asAttacker.categories.create({
      name: "Attacker Category",
      type: "expense",
      color: "#654321",
    });
    const own = (await asAttacker.categories.list()).find(
      (c: any) => c.name === "Attacker Category",
    );

    await expect(
      asAttacker.transactions.create({
        categoryId: own.id,
        type: "expense",
        amount: "10.00",
        date: new Date(),
        creditCardId: victimCardId,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("createMany rejects a batch referencing another user's category", async () => {
    await expect(
      asAttacker.transactions.createMany([
        {
          categoryId: victimCategoryId,
          type: "expense",
          amount: "10.00",
          date: new Date(),
        },
      ]),
    ).rejects.toThrow(/not found/i);
  });
});

describe("control — already-scoped routers are unaffected", () => {
  it("accounts.getById still blocks cross-user reads", async () => {
    await asVictim.accounts.create({
      name: "Victim Bank",
      type: "bank",
      currency: "USD",
    });
    const acct = (await asVictim.accounts.list())[0];
    await expect(
      asAttacker.accounts.getById({ id: acct.id }),
    ).resolves.toBeFalsy();
  });
});
