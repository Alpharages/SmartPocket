const isProduction = process.env.NODE_ENV === "production";

export const ENV = {
  // In dev, fall back to a placeholder so JWT tokens contain a non-empty appId.
  appId: process.env.VITE_APP_ID || (isProduction ? "" : "dev-local-app"),
  // In dev, fall back to a local-only secret so JWT signing works without env vars.
  cookieSecret:
    process.env.JWT_SECRET ||
    (isProduction ? "" : "dev-local-secret-not-for-production-use"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** 32-byte AES key (hex or base64). Server-only — never expose to client. */
  cardEncryptionKey: process.env.CARD_ENCRYPTION_KEY ?? "",
};
