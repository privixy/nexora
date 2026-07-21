/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const repositoryTests = path
  .join(
    repoRoot,
    "tests/repository/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
  )
  .replaceAll(path.sep, "/");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "@testing-library/jest-dom",
      "@testing-library/react",
      "vitest",
      "@tauri-apps/api",
      "@tauri-apps/plugin-notification",
      "@tauri-apps/plugin-dialog",
      "@tauri-apps/plugin-fs",
      "@tauri-apps/plugin-opener",
      "react-i18next",
      "@monaco-editor/react",
      "lucide-react",
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["../../tests/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      repositoryTests,
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/test/**"],
    },
  },
});
