/**
 * Cross-origin access control for the API (QA report SP-005).
 *
 * The API used to reflect *any* `Origin` back with
 * `Access-Control-Allow-Credentials: true`, which let any third-party page
 * issue credentialed requests and read the responses — a signed-in user's full
 * transaction history was one `fetch` away. Origins now come from an explicit
 * allowlist.
 *
 * Extracted from `index.ts` so it can be tested: that module calls
 * `startServer()` at import time.
 */

/** Origins permitted to make credentialed cross-origin requests. */
export function buildAllowedOrigins(
  configuredValue: string | undefined,
  isProduction: boolean,
): Set<string> {
  const configured = (configuredValue ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const origins = new Set(configured);

  if (!isProduction) {
    // Local development hosts only — never added in production.
    for (const port of [8081, 3000, 19006]) {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    }
    return origins;
  }

  // An empty allowlist in production is fail-closed but silent: every
  // credentialed cross-origin request is rejected, so a web client served from
  // a different origin than the API simply stops working with no clue why.
  // Refuse to boot instead, mirroring how JWT_SECRET is handled in `env.ts`.
  // Same-origin deployments should set ALLOWED_ORIGINS to their own origin.
  if (origins.size === 0) {
    throw new Error(
      "ALLOWED_ORIGINS is required in production. Set it to a comma-separated " +
        "list of origins permitted to call this API (e.g. https://app.example.com). " +
        "Without it every cross-origin request is rejected.",
    );
  }

  return origins;
}

export function isOriginAllowed(origin: string, allowed: Set<string>): boolean {
  const normalized = origin.replace(/\/$/, "");
  if (allowed.has(normalized)) return true;

  // Sandbox preview topology: the API (3000-*) and the web client (8081-*)
  // are sibling subdomains of one preview host. Allow a sibling only when the
  // parent host is itself allowlisted.
  for (const entry of allowed) {
    try {
      const a = new URL(entry);
      const b = new URL(normalized);
      if (
        a.protocol === b.protocol &&
        a.hostname.replace(/^\d+-/, "") === b.hostname.replace(/^\d+-/, "")
      ) {
        return true;
      }
    } catch {
      // ignore malformed allowlist entries
    }
  }
  return false;
}
