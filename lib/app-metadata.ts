import Constants from "expo-constants";

export function getAppMetadata() {
  return {
    name: Constants.expoConfig?.name ?? "App",
    version: Constants.expoConfig?.version ?? "—",
  };
}
