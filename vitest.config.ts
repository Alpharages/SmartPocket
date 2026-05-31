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
      "expo-haptics": path.resolve(
        __dirname,
        "./__mocks__/expo-haptics.ts",
      ),
      nativewind: path.resolve(__dirname, "./__mocks__/nativewind.ts"),
      "react-native-css-interop": path.resolve(
        __dirname,
        "./__mocks__/react-native-css-interop.ts",
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
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
});
