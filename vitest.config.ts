import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./") + "/",
      "react-native": path.resolve(__dirname, "./__mocks__/react-native.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
