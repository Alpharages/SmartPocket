import { Platform } from "react-native";

export type PickedTextFile = {
  name: string;
  text: string;
};

export async function pickTextFile(): Promise<PickedTextFile | null> {
  if (Platform.OS === "web") {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        file
          .text()
          .then((text) => resolve({ name: file.name, text }))
          .catch(reject);
      };
      // Not all browsers fire "cancel" on a dismissed <input type=file> dialog,
      // but where supported this prevents the promise from hanging forever.
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  const DocumentPicker = await import("expo-document-picker");
  const FileSystem = await import("expo-file-system/legacy");
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "text/plain"],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const text = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { name: asset.name ?? "import.csv", text };
}
