import { Platform } from "react-native";

/**
 * Write `content` to a temp file and share/download it platform-appropriately.
 * Native: writes to cacheDirectory and opens the OS share sheet.
 * Web: creates a Blob URL and triggers a browser download.
 */
export async function shareFile(
  filename: string,
  content: string,
  mimeType: string,
  UTI = "public.comma-separated-values-text",
): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke — Firefox/Safari fetch the blob asynchronously after click()
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    // Lazy-require native modules so they are never evaluated on web.
    // SDK 54's expo-file-system@19 moved the legacy file API
    // (cacheDirectory / writeAsStringAsync / EncodingType) behind the
    // "/legacy" subpath; the default entry only exposes File/Paths/Directory.
    const FileSystem = await import("expo-file-system/legacy");
    const Sharing = await import("expo-sharing");

    if (!FileSystem.cacheDirectory) {
      throw new Error("Cache directory unavailable — cannot write export file");
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is not available on this device");
    }

    const uri = FileSystem.cacheDirectory + filename;
    try {
      await FileSystem.writeAsStringAsync(uri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, {
        mimeType,
        UTI,
      });
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
}
