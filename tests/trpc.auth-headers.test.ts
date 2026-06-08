import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getSessionToken: vi.fn(),
};

const oauth = {
  getApiBaseUrl: vi.fn().mockReturnValue("http://localhost:3000"),
};

vi.mock("@/lib/_core/auth", () => auth);
vi.mock("@/constants/oauth", () => oauth);

// Regression coverage for Bug 86exvgjme: the originally reported failure was
// tRPC requests 401ing on web because the client sent no Authorization header.
// authHeaders() is the exact code path the tRPC client uses, so assert it here
// rather than relying on the transitive getSessionToken/apiCall tests.
describe("trpc authHeaders", () => {
  beforeEach(() => {
    auth.getSessionToken.mockReset();
  });

  it("emits a Bearer header when a session token exists", async () => {
    auth.getSessionToken.mockResolvedValue("token-123");

    const { authHeaders } = await import("@/lib/trpc");

    await expect(authHeaders()).resolves.toEqual({
      Authorization: "Bearer token-123",
    });
  });

  it("emits no auth header when no session token exists", async () => {
    auth.getSessionToken.mockResolvedValue(null);

    const { authHeaders } = await import("@/lib/trpc");

    await expect(authHeaders()).resolves.toEqual({});
  });
});
