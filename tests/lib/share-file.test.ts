import { afterEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";
// Aliased to __mocks__/expo-file-system.ts (legacy API surface) and
// __mocks__/expo-sharing.ts via vitest.config.ts.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { shareFile } from "@/lib/share-file";

describe("shareFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
    Platform.OS = "ios";
  });

  it("native: writes to cacheDirectory via the legacy API, shares, then cleans up", async () => {
    Platform.OS = "ios";
    await shareFile("smartpocket-transactions-2026-06-30.csv", "Date,Type\n", "text/csv");

    const expectedUri = "/tmp/cache/smartpocket-transactions-2026-06-30.csv";
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expectedUri,
      "Date,Type\n",
      { encoding: FileSystem.EncodingType.UTF8 },
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expectedUri,
      expect.objectContaining({ mimeType: "text/csv" }),
    );
    // finally-block cleanup runs regardless of share outcome
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(expectedUri, {
      idempotent: true,
    });
  });

  it("native: still cleans up the temp file when sharing throws", async () => {
    Platform.OS = "ios";
    vi.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error("user cancelled"));

    await expect(
      shareFile("export.csv", "a,b\n", "text/csv"),
    ).rejects.toThrow("user cancelled");

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "/tmp/cache/export.csv",
      { idempotent: true },
    );
  });

  it("web: downloads via a Blob anchor and never touches the native modules", async () => {
    Platform.OS = "web";
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    // node environment has no DOM — stub the globals the web branch uses.
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Blob", class {});
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    await shareFile("export.csv", "a,b\n", "text/csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe("export.csv");
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
