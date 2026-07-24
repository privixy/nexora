/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "repository",
          environment: "node",
          include: ["tests/repository/**/*.test.ts"],
        },
      },
      "./apps/desktop/vitest.config.ts",
    ],
  },
});
