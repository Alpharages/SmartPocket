import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  define: {
    __DEV__: "true",
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./") + "/",
      "react-native": path.resolve(__dirname, "./__mocks__/react-native.ts"),
      "react-native-reanimated": path.resolve(
        __dirname,
        "./__mocks__/react-native-reanimated.ts",
      ),
      "expo-haptics": path.resolve(__dirname, "./__mocks__/expo-haptics.ts"),
      nativewind: path.resolve(__dirname, "./__mocks__/nativewind.ts"),
      "react-native-css-interop": path.resolve(
        __dirname,
        "./__mocks__/react-native-css-interop.ts",
      ),
      "react-native-gesture-handler": path.resolve(
        __dirname,
        "./__mocks__/react-native-gesture-handler.ts",
      ),
      "expo-constants": path.resolve(
        __dirname,
        "./__mocks__/expo-constants.ts",
      ),
      "expo-localization": path.resolve(
        __dirname,
        "./__mocks__/expo-localization.ts",
      ),
      "react-native-chart-kit": path.resolve(
        __dirname,
        "./__mocks__/react-native-chart-kit.ts",
      ),
      "@shared/": path.resolve(__dirname, "./shared/") + "/",
      // Map the SDK 54 legacy subpath (used by lib/share-file.ts) before the
      // bare specifier so it resolves to the same mock.
      "expo-file-system/legacy": path.resolve(
        __dirname,
        "./__mocks__/expo-file-system.ts",
      ),
      "expo-file-system": path.resolve(
        __dirname,
        "./__mocks__/expo-file-system.ts",
      ),
      "expo-sharing": path.resolve(__dirname, "./__mocks__/expo-sharing.ts"),
      "expo-crypto": path.resolve(__dirname, "./__mocks__/expo-crypto.ts"),
      "expo-blur": path.resolve(__dirname, "./__mocks__/expo-blur.ts"),
      "expo-linear-gradient": path.resolve(
        __dirname,
        "./__mocks__/expo-linear-gradient.ts",
      ),
      "@react-native-community/datetimepicker": path.resolve(
        __dirname,
        "./__mocks__/react-native-community-datetimepicker.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: [
      "react-native",
      "react-native-reanimated",
      "expo-haptics",
      "nativewind",
      "react-native-css-interop",
      "react-native-gesture-handler",
      "react-native-chart-kit",
      "expo-blur",
      "expo-linear-gradient",
      "@react-native-community/datetimepicker",
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    server: {
      deps: {
        // `node:sqlite` is a newer built-in that Vite's default externalization
        // list doesn't yet recognize, so it tries to bundle it as if it were an
        // npm package named "sqlite" and fails to resolve. Only the local-first
        // SQLite engine tests (tests/sqlite-engine.test.ts and its driver) touch
        // this module — everything else is unaffected.
        external: [/^node:sqlite$/],
      },
    },
  },
});
