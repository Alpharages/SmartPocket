import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ensureUserSeeded } from "./user-seeding";
import { ENV } from "./env";

/**
 * Session issuing and verification.
 *
 * This is the half of the old Manus `sdk.ts` that was never Manus-specific:
 * an HS256 JWT signed with JWT_SECRET, carried as a cookie on web and a bearer
 * token on native. The identity provider in front of it has been replaced
 * (Manus OAuth -> email + password, `auth-routes.ts`), but nothing here had to
 * change for that — a session is a session regardless of how the user proved
 * who they were to get one.
 *
 * Gone with the OAuth half: the "user not in DB, go ask the identity provider
 * who this is" fallback, which only made sense when an external service was
 * the source of truth for accounts. Accounts are now created here, so a token
 * whose subject has no row is simply invalid.
 */

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  name: string;
};

/** The authenticated principal a request resolves to. */
export type AuthenticatedUser = User;

class SessionService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession({ openId, name: options.name || "" }, options);
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({ openId: payload.openId, name: payload.name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;

    try {
      const { payload } = await jwtVerify(
        cookieValue,
        this.getSessionSecret(),
        {
          algorithms: ["HS256"],
        },
      );
      const { openId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing openId");
        return null;
      }

      return { openId, name: isNonEmptyString(name) ? name : "" };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /** Resolves the caller from a bearer token (native) or session cookie (web). */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const session = await this.verifySession(token || cookies.get(COOKIE_NAME));

    if (!session) {
      throw ForbiddenError("Invalid session");
    }

    let user = await db.getUserByOpenId(session.openId);

    // Dev only: re-create the dev user if it went missing, which happens every
    // time the in-memory dev database is cleared by a restart while the client
    // still holds a perfectly valid token.
    if (!user && !ENV.isProduction && session.openId === "dev_local_user") {
      try {
        await db.upsertUser({
          openId: "dev_local_user",
          name: "Dev User",
          email: "dev@localhost",
          loginMethod: "dev",
          lastSignedIn: new Date(),
        });
        user = await db.getUserByOpenId("dev_local_user");
        if (user?.id) await ensureUserSeeded(user.id);
      } catch {
        // Falls through to the not-found rejection below.
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const session = new SessionService();
