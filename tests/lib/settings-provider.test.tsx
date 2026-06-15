import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

const mocks = vi.hoisted(() => {
  const settingsRefetch = vi.fn().mockResolvedValue({ data: { aiEnabled: false } });
  const setAiMutateAsync = vi.fn().mockImplementation(async ({ enabled }: { enabled: boolean }) => {
    mocks.settingsData.aiEnabled = enabled;
    return { aiEnabled: enabled };
  });
  const toastShow = vi.fn();

  return {
    settingsRefetch,
    setAiMutateAsync,
    toastShow,
    settingsData: { aiEnabled: false } as { aiEnabled: boolean },
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ show: mocks.toastShow }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    settings: {
      get: {
        useQuery: () => ({
          data: mocks.settingsData,
          refetch: mocks.settingsRefetch,
          isLoading: false,
        }),
      },
      setAiEnabled: {
        useMutation: () => ({ mutateAsync: mocks.setAiMutateAsync }),
      },
    },
  },
}));

import { SettingsProvider, useSettings } from "@/lib/settings-provider";

function SettingsHarness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useSettings>) => void;
}) {
  const api = useSettings();
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

let renderer: ReactTestRenderer | null = null;

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
  mocks.settingsData.aiEnabled = false;
  mocks.setAiMutateAsync.mockReset();
  mocks.setAiMutateAsync.mockResolvedValue({ aiEnabled: true });
  mocks.settingsRefetch.mockReset();
  mocks.settingsRefetch.mockResolvedValue({ data: { aiEnabled: false } });
  mocks.toastShow.mockReset();
});

describe("SettingsProvider", () => {
  it("exposes aiEnabled false by default from server", async () => {
    let api!: ReturnType<typeof useSettings>;

    await act(async () => {
      renderer = TestRenderer.create(
        <SettingsProvider>
          <SettingsHarness onReady={(value) => { api = value; }} />
        </SettingsProvider>,
      );
    });

    expect(api.aiEnabled).toBe(false);
  });

  it("optimistically enables AI and persists on success", async () => {
    let api!: ReturnType<typeof useSettings>;

    await act(async () => {
      renderer = TestRenderer.create(
        <SettingsProvider>
          <SettingsHarness onReady={(value) => { api = value; }} />
        </SettingsProvider>,
      );
    });

    await act(async () => {
      await api.setAiEnabled(true);
    });

    expect(mocks.setAiMutateAsync).toHaveBeenCalledWith({ enabled: true });
    expect(mocks.settingsRefetch).toHaveBeenCalled();
    expect(mocks.toastShow).not.toHaveBeenCalled();
  });

  it("reverts and shows error toast when mutation fails", async () => {
    mocks.setAiMutateAsync.mockRejectedValueOnce(new Error("offline"));
    let api!: ReturnType<typeof useSettings>;

    await act(async () => {
      renderer = TestRenderer.create(
        <SettingsProvider>
          <SettingsHarness onReady={(value) => { api = value; }} />
        </SettingsProvider>,
      );
    });

    await act(async () => {
      await api.setAiEnabled(true);
    });

    expect(api.aiEnabled).toBe(false);
    expect(mocks.toastShow).toHaveBeenCalledWith({
      type: "error",
      message: "Failed to update AI setting",
    });
  });

  it("ignores stale mutation completion after rapid double-toggle", async () => {
    let resolveFirst: (value: { aiEnabled: boolean }) => void = () => {};
    const firstMutation = new Promise<{ aiEnabled: boolean }>((resolve) => {
      resolveFirst = resolve;
    });

    mocks.setAiMutateAsync
      .mockImplementationOnce(() => firstMutation)
      .mockResolvedValueOnce({ aiEnabled: false });

    let api!: ReturnType<typeof useSettings>;

    await act(async () => {
      renderer = TestRenderer.create(
        <SettingsProvider>
          <SettingsHarness onReady={(value) => { api = value; }} />
        </SettingsProvider>,
      );
    });

    await act(async () => {
      void api.setAiEnabled(true);
    });
    expect(api.aiEnabled).toBe(true);

    await act(async () => {
      await api.setAiEnabled(false);
    });
    expect(api.aiEnabled).toBe(false);

    await act(async () => {
      resolveFirst({ aiEnabled: true });
      await firstMutation;
      await Promise.resolve();
    });

    expect(api.aiEnabled).toBe(false);
  });
});
