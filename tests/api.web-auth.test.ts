import { beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";

const auth = {
  getSessionToken: vi.fn(),
};

const oauth = {
  getApiBaseUrl: vi.fn(),
};

vi.mock("@/lib/_core/auth", () => auth);
vi.mock("@/constants/oauth", () => oauth);

describe("apiCall web auth", () => {
  beforeEach(() => {
    Platform.OS = "web";
    auth.getSessionToken.mockReset();
    oauth.getApiBaseUrl.mockReset();
    oauth.getApiBaseUrl.mockReturnValue("http://localhost:3000");
  });

  it("adds a Bearer token to web requests when a session token exists", async () => {
    auth.getSessionToken.mockResolvedValue("token-123");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiCall } = await import("@/lib/_core/api");
    await apiCall("/api/foo", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/foo",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("does not add an Authorization header when no session token exists", async () => {
    auth.getSessionToken.mockResolvedValue(null);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiCall } = await import("@/lib/_core/api");
    await apiCall("/api/foo");

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.headers).not.toHaveProperty("Authorization");
  });
});

describe("apiCall native auth", () => {
  beforeEach(() => {
    Platform.OS = "ios";
    auth.getSessionToken.mockReset();
    oauth.getApiBaseUrl.mockReset();
    oauth.getApiBaseUrl.mockReturnValue("http://localhost:3000");
  });

  it("adds a Bearer token to native requests when a session token exists", async () => {
    auth.getSessionToken.mockResolvedValue("token-native");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiCall } = await import("@/lib/_core/api");
    await apiCall("/api/foo", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/foo",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          Authorization: "Bearer token-native",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
