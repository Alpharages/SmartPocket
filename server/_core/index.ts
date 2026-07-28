import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { generateDueTransactions } from "./recurrenceGenerator";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import * as db from "../db";
import { ENV } from "./env";
import { buildAllowedOrigins, isOriginAllowed } from "./cors";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** Authorize the recurring-generation cron endpoint (SP-011). */
async function isCronRequestAuthorized(req: express.Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.authorization;
    if (typeof header === "string" && header === `Bearer ${secret}`) {
      return true;
    }
  }

  try {
    const user = await sdk.authenticateRequest(req);
    return user?.isCron === true;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS.
  //
  // QA report SP-005: this previously reflected *any* Origin back with
  // `Allow-Credentials: true`, which let any third-party page make credentialed
  // requests to the API and read the responses. Origins now come from an
  // explicit allowlist. In development the local Metro/preview hosts are
  // permitted so the web client keeps working; in production only
  // ALLOWED_ORIGINS is honoured.
  const allowedOrigins = buildAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    ENV.isProduction,
  );
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
    }

    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );

    if (req.method === "OPTIONS") {
      // Never 200 a preflight for a disallowed origin — without the
      // Allow-Origin header the browser blocks it anyway, but failing loudly
      // makes misconfiguration obvious instead of silent.
      res.sendStatus(
        origin && !isOriginAllowed(origin, allowedOrigins) ? 403 : 204,
      );
      return;
    }
    next();
  });

  // SP-044: 50mb on every route was an easy memory-exhaustion vector. Normal
  // payloads are a few KB; only the bulk-import path needs headroom, and that
  // is bounded to 1000 rows by `transactions.createMany`.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // SP-011: this ran recurring generation for *every* user with no auth at
  // all. It now requires either the platform's cron identity (which
  // `sdk.authenticateRequest` already recognises) or a shared CRON_SECRET.
  app.post("/api/scheduled/generate-recurring", async (req, res) => {
    const authorized = await isCronRequestAuthorized(req);
    if (!authorized) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }
    try {
      const result = await generateDueTransactions();
      res.json({ ok: true, ...result });
    } catch (error) {
      console.error("[scheduled/generate-recurring] failed:", error);
      res.status(500).json({ ok: false, error: "Recurring generation failed" });
    }
  });

  // Dev-only login — creates a local dev user and returns a signed session token.
  // Never available in production.
  if (!ENV.isProduction) {
    app.post("/api/dev/login", async (_req, res) => {
      try {
        const DEV_OPEN_ID = "dev_local_user";
        await db.upsertUser({
          openId: DEV_OPEN_ID,
          name: "Dev User",
          email: "dev@localhost",
          loginMethod: "dev",
          lastSignedIn: new Date(),
        });
        const token = await sdk.createSessionToken(DEV_OPEN_ID, {
          name: "Dev User",
        });
        res.json({ token });
      } catch (err) {
        console.error("[dev/login] failed:", err);
        res.status(500).json({ error: "Dev login failed" });
      }
    });
  }

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
