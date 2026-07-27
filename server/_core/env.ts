const isProduction = process.env.NODE_ENV === "production";

/**
 * QA report SP-025: `JWT_SECRET` silently fell back to a public, hard-coded
 * string whenever NODE_ENV was anything other than "production". A deploy that
 * forgot to set NODE_ENV would therefore sign real sessions with a secret that
 * is committed to this repository. The dev fallback is retained for local work
 * but is now loud, and production refuses to boot without a real secret.
 */
const DEV_JWT_SECRET = "dev-local-secret-not-for-production-use";

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;

  if (isProduction) {
    throw new Error(
      "JWT_SECRET is required in production and must be at least 32 characters.",
    );
  }
  if (configured) {
    throw new Error("JWT_SECRET must be at least 32 characters.");
  }
  console.warn(
    "[env] JWT_SECRET is not set — using the insecure local development secret. " +
      "Set JWT_SECRET before deploying.",
  );
  return DEV_JWT_SECRET;
}

export const ENV = {
  // In dev, fall back to a placeholder so JWT tokens contain a non-empty appId.
  appId: process.env.VITE_APP_ID || (isProduction ? "" : "dev-local-app"),
  // In dev, fall back to a local-only secret so JWT signing works without env vars.
  cookieSecret: resolveJwtSecret(),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** 32-byte AES key (hex or base64). Server-only — never expose to client. */
  cardEncryptionKey: process.env.CARD_ENCRYPTION_KEY ?? "",
};
