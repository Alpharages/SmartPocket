import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { Platform } from "react-native";

import { AuthGate } from "@/components/auth-gate";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));

let segments: string[] = ["(tabs)"];

vi.mock("expo-router", () => ({
  useRouter: () => routerMock,
  useSegments: () => segments,
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  loading: false,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => authState,
}));

describe("AuthGate", () => {
  const originalOS = Platform.OS;
  let renderer: TestRenderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    routerMock.replace.mockClear();
    authState.isAuthenticated = false;
    authState.loading = false;
    segments = ["(tabs)"];
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    Platform.OS = originalOS;
  });

  function render() {
    act(() => {
      renderer = TestRenderer.create(React.createElement(AuthGate));
    });
  }

  it("web: redirects a signed-out user away from a private route to /login", () => {
    Platform.OS = "web";
    authState.isAuthenticated = false;
    segments = ["(tabs)"];

    render();

    expect(routerMock.replace).toHaveBeenCalledWith("/login");
  });

  it("web: does not redirect a signed-out user already on a public route", () => {
    Platform.OS = "web";
    authState.isAuthenticated = false;
    segments = ["login"];

    render();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("web: redirects a signed-in user away from /login to the dashboard", () => {
    Platform.OS = "web";
    authState.isAuthenticated = true;
    segments = ["login"];

    render();

    expect(routerMock.replace).toHaveBeenCalledWith("/dashboard");
  });

  it(
    "native: never redirects a signed-out user — local-first-sync-plan.md " +
      "phase 3, the in-process link always resolves to the local device user",
    () => {
      Platform.OS = "ios";
      authState.isAuthenticated = false;
      segments = ["(tabs)"];

      render();

      expect(routerMock.replace).not.toHaveBeenCalled();
    },
  );

  it("native: still waits for the loading state before deciding anything", () => {
    Platform.OS = "ios";
    authState.isAuthenticated = false;
    authState.loading = true;
    segments = ["(tabs)"];

    render();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
