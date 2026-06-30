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
      "expo-file-system": path.resolve(__dirname, "./__mocks__/expo-file-system.ts"),
      "expo-sharing": path.resolve(__dirname, "./__mocks__/expo-sharing.ts"),
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
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
