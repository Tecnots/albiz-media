import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // These are plain Node/TS unit tests with no CSS involved — stop Vite from
  // auto-discovering the project's postcss.config.mjs (Tailwind v4's plugin
  // array format there isn't compatible with Vite's own PostCSS loader).
  css: { postcss: { plugins: [] } },
});
