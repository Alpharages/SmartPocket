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

  // SP-D10: `10.0.2.2` is the *emulator's* host alias. A physical device gets an
  // unroutable address from it, which is why the app sat on a blank screen with
  // no error; it keeps `localhost`, which `adb reverse` forwards to the host.
  it("rewrites localhost to 10.0.2.2 on an Android emulator when Metro is loopback", async () => {
    constants.expoConfig = { hostUri: "localhost:8081" };
    vi.doMock("react-native", () => ({
      Platform: {
        OS: "android",
        constants: {
          Fingerprint: "google/sdk_gphone64_arm64/generic:16/UP1A/user",
          Model: "sdk_gphone64_arm64",
          Brand: "google",
        },
      },
    }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://10.0.2.2:3000");
  });

  it("keeps localhost on a physical Android device when Metro is loopback", async () => {
    constants.expoConfig = { hostUri: "localhost:8081" };
    vi.doMock("react-native", () => ({
      Platform: {
        OS: "android",
        constants: {
          Fingerprint: "vivo/V2352/V2352:16/AP3A/compiler:user/release-keys",
          Model: "V2352",
          Brand: "vivo",
        },
      },
    }));
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
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

describe("getApiBaseUrl web host derivation when env is unset", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_API_PORT", "3000");
    vi.stubGlobal("__DEV__", true);
    vi.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rewrites the sandbox 8081- hostname prefix to 3000-", async () => {
    vi.stubGlobal("window", {
      location: {
        protocol: "https:",
        hostname: "8081-abc123.region.example.dev",
      },
    });
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("https://3000-abc123.region.example.dev");
  });

  it("falls back to the API port on plain localhost", async () => {
    vi.stubGlobal("window", {
      location: { protocol: "http:", hostname: "localhost" },
    });
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to the API port on a LAN dev host", async () => {
    vi.stubGlobal("window", {
      location: { protocol: "http:", hostname: "192.168.2.15" },
    });
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("http://192.168.2.15:3000");
  });

  it("does NOT fall back outside dev (production web must set the env)", async () => {
    vi.stubGlobal("__DEV__", false);
    vi.stubGlobal("window", {
      location: { protocol: "https:", hostname: "app.smartpocket.example" },
    });
    const { getApiBaseUrl } = await import("@/constants/oauth");
    expect(getApiBaseUrl()).toBe("");
  });
});
