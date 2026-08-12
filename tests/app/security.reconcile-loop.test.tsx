/**
 * Round-3 review T1 — the B3 mount reconcile must fire at most once.
 *
 * This file exists separately from tests/app/security.test.tsx because that
 * suite mocks `useMutation` as `() => ({ mutateAsync })` — a stateless object
 * with no MutationObserver and no re-render — which makes it structurally
 * incapable of reproducing a render loop. Here the REAL
 * @tanstack/react-query `useMutation` runs under a real QueryClientProvider
 * and only the transport is mocked, so a dependency that changes identity per
 * render (which `useMutation`'s result object does) actually feeds the effect
 * back into itself. Against the unlatched reconcile this recorded 151 calls
 * in ~300ms.
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import SecurityScreen from "@/app/security";

const serverSetPin = vi.hoisted(() =>
  vi.fn(async (_input: unknown) => ({ pinSet: true })),
);

const appLock = vi.hoisted(() => ({
  isAppLockSupported: vi.fn(() => true),
  isPinSet: vi.fn(async () => true),
  getPin: vi.fn(async () => "1234"),
  setPin: vi.fn(async () => undefined),
  verifyPin: vi.fn(async () => true),
  clearAppLock: vi.fn(async () => undefined),
  getBiometricLabel: vi.fn(async () => null),
  isBiometricEnabled: vi.fn(async () => false),
  setBiometricEnabled: vi.fn(async () => undefined),
}));
vi.mock("@/lib/app-lock", () => appLock);

const toast = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/components/ui/ToastProvider", () => ({ useToast: () => toast }));

vi.mock("@/lib/trpc", async () => {
  const reactQuery = await import("@tanstack/react-query");
  return {
    trpc: {
      security: {
        setPin: {
          useMutation: () =>
            reactQuery.useMutation({ mutationFn: serverSetPin }),
        },
        clearPin: {
          useMutation: () =>
            reactQuery.useMutation({ mutationFn: async () => ({}) }),
        },
        // Local PIN set + account unset: the B3 backfill condition, and the
        // one the reconcile never gets to clear on its own.
        getPinStatus: { useQuery: () => ({ data: { pinSet: false } }) },
      },
    },
  };
});

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/screen-container", () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}));

vi.mock("@/components/ui/Sheet", () => ({
  Sheet: ({
    children,
    visible,
  }: {
    children: React.ReactNode;
    visible: boolean;
  }) => (visible ? React.createElement("View", {}, children) : null),
}));

vi.mock("@expo/vector-icons", () => {
  const Ionicons = ({ name }: { name: string }) =>
    React.createElement("Ionicons", { name });
  (Ionicons as unknown as { glyphMap: Record<string, number> }).glyphMap = {
    "chevron-back": 1,
    "key-outline": 1,
  };
  return { Ionicons };
});

const mockColors = {
  primary: "#4F46E5",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  error: "#DC2626",
};
vi.mock("@/hooks/use-colors", () => ({ useColors: () => mockColors }));
vi.mock("@/lib/theme-provider", () => ({
  useThemeContext: () => ({ colorScheme: "light" }),
  useThemeTokens: () => ({ colors: mockColors }),
}));

beforeEach(() => {
  serverSetPin.mockClear();
  toast.show.mockClear();
});

describe("SecurityScreen account reconcile — real useMutation (T1)", () => {
  it("pushes the local PIN exactly once and does not loop", async () => {
    const queryClient = new QueryClient();

    await act(async () => {
      TestRenderer.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(SecurityScreen),
        ),
      );
    });

    // Settling repeatedly gives a self-retriggering effect every chance to
    // run: each mutation state transition re-renders, and an unlatched effect
    // treats that render as a fresh reason to sync.
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
    }

    expect(serverSetPin).toHaveBeenCalledTimes(1);
    expect(serverSetPin).toHaveBeenCalledWith(
      { pin: "1234", currentPin: undefined },
      expect.anything(),
    );
    // A looping reconcile trips the server-side setPin cooldown and toasts on
    // every rejection; one clean sync is silent.
    expect(toast.show).not.toHaveBeenCalled();
  });
});
