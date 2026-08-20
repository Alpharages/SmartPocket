import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { createPasswordUser, getUserByEmail, touchLastSignedIn } from "../db";
import { ensureUserSeeded } from "./user-seeding";
import { getSessionCookieOptions } from "./cookies";
import { session } from "./session";
import {
  burnVerificationTime,
  clearLoginAttempts,
  hashPassword,
  isLoginLocked,
  LOGIN_LOCKOUT_MS,
  passwordProblem,
  recordFailedLogin,
  verifyPassword,
} from "./password";

/**
 * Email + password authentication.
 *
 * Replaces the Manus OAuth flow (authorization code -> ExchangeToken ->
 * GetUserInfo). Accounts now live entirely in this database, so there is no
 * external identity provider to be unavailable, rate-limit us, or have to be
 * configured before anyone can sign in.
 *
 * The session these routes hand out is unchanged — see `session.ts`.
 */

// A deliberately vague, identical message for "no such account" and "wrong
// password". Telling them apart is exactly the account-enumeration signal that
// `burnVerificationTime` exists to remove from the timing side; there is no
// point closing that channel and leaving this one open.
const BAD_CREDENTIALS = "Incorrect email or password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 320;

type Credentials = { email: string; password: string; name?: string };

function readCredentials(req: Request): Credentials | null {
  const body = req.body as Record<string, unknown> | undefined;
  const email = body?.email;
  const password = body?.password;
  const name = body?.name;
  if (typeof email !== "string" || typeof password !== "string") return null;
  return {
    email: email.trim().toLowerCase(),
    password,
    name: typeof name === "string" && name.trim() ? name.trim() : undefined,
  };
}

function buildUserResponse(user: {
  id?: unknown;
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date | null;
}) {
  return {
    id: user.id ?? null,
    openId: user.openId ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: (user.lastSignedIn ?? new Date()).toISOString(),
  };
}

/**
 * Issues the session both ways at once: a cookie for the web client and the
 * raw token in the body for native, which has no cookie jar and keeps it in
 * SecureStore instead.
 */
async function issueSession(
  req: Request,
  res: Response,
  user: { openId: string; name?: string | null },
) {
  const token = await session.createSessionToken(user.openId, {
    name: user.name ?? "",
  });
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
  return token;
}

function isDuplicateEmail(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const credentials = readCredentials(req);
    if (!credentials) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (
      !EMAIL_PATTERN.test(credentials.email) ||
      credentials.email.length > EMAIL_MAX_LENGTH
    ) {
      res.status(400).json({ error: "Enter a valid email address" });
      return;
    }
    const problem = passwordProblem(credentials.password);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }

    try {
      const passwordHash = await hashPassword(credentials.password);
      // Straight to the INSERT — no "is this address taken?" read first. The
      // unique index is the only check that cannot lose a race against a
      // simultaneous signup for the same address.
      const id = await createPasswordUser({
        email: credentials.email,
        passwordHash,
        name: credentials.name ?? null,
      });

      const user = await getUserByEmail(credentials.email);
      if (!user) throw new Error("Account vanished immediately after creation");

      // The unique index is the race-free check, but it is not the only thing
      // this can rely on: a store that does not enforce it (the in-memory dev
      // database does not) would let a second signup for a taken address
      // through, and the lookup above would then hand back somebody else's
      // account — session included. Confirming the row we read is the row we
      // just minted closes that without reintroducing a check-then-insert race.
      if (user.id !== id) {
        res.status(409).json({ error: "That email is already registered" });
        return;
      }

      await ensureUserSeeded(id);

      const token = await issueSession(req, res, user);
      res.status(201).json({ token, user: buildUserResponse(user) });
    } catch (error) {
      if (isDuplicateEmail(error)) {
        res.status(409).json({ error: "That email is already registered" });
        return;
      }
      console.error("[Auth] signup failed:", error);
      res.status(500).json({ error: "Could not create the account" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const credentials = readCredentials(req);
    if (!credentials) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const now = Date.now();
    if (isLoginLocked(credentials.email, now)) {
      res.status(429).json({
        error: `Too many attempts. Try again in ${Math.ceil(
          LOGIN_LOCKOUT_MS / 60000,
        )} minutes.`,
      });
      return;
    }

    try {
      const user = await getUserByEmail(credentials.email);

      // Both misses — unknown address, and a row with no password set — spend
      // the same scrypt time a real verification would, so neither is
      // distinguishable from a wrong password by how long the answer takes.
      if (!user?.passwordHash) {
        await burnVerificationTime(credentials.password);
        recordFailedLogin(credentials.email, now);
        res.status(401).json({ error: BAD_CREDENTIALS });
        return;
      }

      const ok = await verifyPassword(credentials.password, user.passwordHash);
      if (!ok) {
        recordFailedLogin(credentials.email, now);
        res.status(401).json({ error: BAD_CREDENTIALS });
        return;
      }

      clearLoginAttempts(credentials.email);
      // Best effort: a failed timestamp write must not cost the user their login.
      await touchLastSignedIn(user.id).catch((error) =>
        console.warn("[Auth] lastSignedIn update failed:", error),
      );

      const token = await issueSession(req, res, user);
      res.json({ token, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] login failed:", error);
      res.status(500).json({ error: "Could not sign in" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Works with both the cookie (web) and a bearer token (native).
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await session.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch {
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Turns a bearer token into a cookie for this origin. Used by the web client
  // when it receives a token out of band and needs a real Set-Cookie response.
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await session.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
