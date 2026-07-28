import { describe, expect, it } from "vitest";

import { buildAllowedOrigins, isOriginAllowed } from "@/server/_core/cors";

/**
 * QA report SP-005 — the API used to reflect any Origin back with
 * `Allow-Credentials: true`. These lock in the allowlist behaviour, including
 * the production boot guard: an empty ALLOWED_ORIGINS in production rejects
 * every cross-origin request, and doing that silently is how a deploy ends up
 * with a web client that cannot reach its own API.
 */
describe("buildAllowedOrigins", () => {
  it("adds localhost dev origins outside production", () => {
    const origins = buildAllowedOrigins(undefined, false);
    expect(origins.has("http://localhost:8081")).toBe(true);
    expect(origins.has("http://127.0.0.1:3000")).toBe(true);
  });

  it("never adds localhost in production", () => {
    const origins = buildAllowedOrigins("https://app.example.com", true);
    expect(origins.has("http://localhost:8081")).toBe(false);
    expect([...origins]).toEqual(["https://app.example.com"]);
  });

  it("parses a comma-separated list and strips trailing slashes", () => {
    const origins = buildAllowedOrigins(
      " https://a.example.com/ , https://b.example.com ",
      true,
    );
    expect([...origins].sort()).toEqual([
      "https://a.example.com",
      "https://b.example.com",
    ]);
  });

  it("throws in production when the allowlist is empty", () => {
    expect(() => buildAllowedOrigins(undefined, true)).toThrow(
      /ALLOWED_ORIGINS is required in production/,
    );
    expect(() => buildAllowedOrigins("   ,  ", true)).toThrow(
      /ALLOWED_ORIGINS is required in production/,
    );
  });
});

describe("isOriginAllowed", () => {
  const allowed = buildAllowedOrigins("https://8081-preview.example.dev", true);

  it("allows an exact match, with or without a trailing slash", () => {
    expect(isOriginAllowed("https://8081-preview.example.dev", allowed)).toBe(
      true,
    );
    expect(isOriginAllowed("https://8081-preview.example.dev/", allowed)).toBe(
      true,
    );
  });

  it("allows a sibling port-prefixed subdomain of an allowlisted host", () => {
    expect(isOriginAllowed("https://3000-preview.example.dev", allowed)).toBe(
      true,
    );
  });

  it("rejects an unrelated origin", () => {
    expect(isOriginAllowed("https://evil.example.com", allowed)).toBe(false);
  });

  it("rejects a scheme downgrade on an allowlisted host", () => {
    expect(isOriginAllowed("http://8081-preview.example.dev", allowed)).toBe(
      false,
    );
  });
});
