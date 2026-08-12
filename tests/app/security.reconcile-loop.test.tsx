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

// A faithful fake account: setPin actually flips the stored state, so a
// refetch after a sync reports what a real server would. Without this the
// remount test below would be measuring the fake, not the fix.
const account = vi.hoisted(() => ({ pinSet: false }));

const serverSetPin = vi.hoisted(() =>
  vi.fn(async (_input: unknown) => {
    account.pinSet = true;
    return { pinSet: true };
  }),
);

// Deliberately slower than the local `isPinSet()` keychain read, because that
// is the real timing relationship: SecureStore resolves in single-digit ms
// while this is a network round-trip. The reconcile is gated behind the local
// read (`loading`), so with an instant fake the background refetch always wins
// the race and the stale-cache window never opens — the bug would be
// unreproducible for the wrong reason.
const serverGetPinStatus = vi.hoisted(() =>
  vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { pinSet: account.pinSet };
  }),
);

const PIN_STATUS_KEY = ["security.getPinStatus"];

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
      // Deliberately unmemoized, unlike the real trpc.useUtils() — a new
      // object every render is the harsher case for any effect that takes
      // it as a dependency.
      useUtils: () => {
        const queryClient = reactQuery.useQueryClient();
        return {
          security: {
            getPinStatus: {
              setData: (_input: undefined, data: unknown) =>
                queryClient.setQueryData(PIN_STATUS_KEY, data),
            },
          },
        };
      },
      security: {
        setPin: {
          useMutation: () =>
            reactQuery.useMutation({ mutationFn: serverSetPin }),
        },
        clearPin: {
          useMutation: () =>
            reactQuery.useMutation({ mutationFn: async () => ({}) }),
        },
        // A real useQuery against a real cache, so `setData` on the success
        // path actually lands where a remount will read it.
        getPinStatus: {
          useQuery: () =>
            reactQuery.useQuery({
              queryKey: PIN_STATUS_KEY,
              queryFn: serverGetPinStatus,
            }),
        },
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
  account.pinSet = false;
  serverSetPin.mockClear();
  serverGetPinStatus.mockClear();
  toast.show.mockClear();
});

async function settle(): Promise<void> {
  // Settling repeatedly gives a self-retriggering effect every chance to run:
  // each mutation state transition re-renders, and an unlatched effect treats
  // that render as a fresh reason to sync.
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
}

function mountScreen(queryClient: QueryClient) {
  return TestRenderer.create(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SecurityScreen),
    ),
  );
}

describe("SecurityScreen account reconcile — real useMutation (T1)", () => {
  it("pushes the local PIN exactly once and does not loop", async () => {
    const queryClient = new QueryClient();

    await act(async () => {
      mountScreen(queryClient);
    });
    await settle();

    expect(serverSetPin).toHaveBeenCalledTimes(1);
    // Assert the variables only — react-query also passes a context argument
    // whose presence is an implementation detail, and matching on it would
    // fail the test for an arity change unrelated to what it guards (U2).
    expect(serverSetPin.mock.calls[0][0]).toEqual({
      pin: "1234",
      currentPin: undefined,
    });
    // A looping reconcile trips the server-side setPin cooldown and toasts on
    // every rejection; one clean sync is silent.
    expect(toast.show).not.toHaveBeenCalled();
  });

  it("does not re-push on a remount, because the sync writes the status back to the cache (U1)", async () => {
    // The ref latch is per-mount, but the QueryClient outlives the screen —
    // and getPinStatus runs at staleTime 0, so a remount serves the cached
    // value synchronously while refetching behind it. Without the setData on
    // the success path the second mount reads a stale `pinSet: false` and
    // pushes again, tripping the 2s server cooldown and toasting a sync
    // failure for a PIN that is already synced.
    const queryClient = new QueryClient();

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = mountScreen(queryClient);
    });
    await settle();
    expect(serverSetPin).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.unmount();
    });

    await act(async () => {
      mountScreen(queryClient);
    });
    await settle();

    expect(serverSetPin).toHaveBeenCalledTimes(1);
    expect(toast.show).not.toHaveBeenCalled();
  });
});
