import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constants = vi.hoisted(() => ({
  expoConfig: { hostUri: "192.168.2.15:8081" as string | undefined },
}));

vi.mock("expo-constants", () => ({
  default: {
    get expoConfig() {
      return constants.expoConfig;
    },
    expoGoConfig: undefined,
  },
}));

vi.mock("expo-linking", () => ({
  createURL: (path: string) => `exp://localhost${path}`,
}));

describe("getApiBaseUrl native dev loopback rewrite", () => {
  beforeEach(() => {
    vi.resetModules();
    constants.expoConfig = { hostUri: "192.168.2.15:8081" };
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.stubEnv("EXPO_PUBLIC_API_PORT", "3000");
    vi.stubGlobal("__DEV__", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rewrites localhost to Metro LAN host on iOS", async () => {
    vi.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://192.168.2.15:3000");
  });

  it("rewrites localhost to 10.0.2.2 on Android when Metro is loopback", async () => {
    constants.expoConfig = { hostUri: "localhost:8081" };
    vi.doMock("react-native", () => ({ Platform: { OS: "android" } }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://10.0.2.2:3000");
  });

  it("uses Metro LAN host on Android when available", async () => {
    vi.doMock("react-native", () => ({ Platform: { OS: "android" } }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://192.168.2.15:3000");
  });

  it("keeps localhost on web", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "http://localhost:3000");
    vi.doMock("react-native", () => ({ Platform: { OS: "web" } }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("derives native URL from Metro when env is unset", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://192.168.2.15:3000");
  });
});
