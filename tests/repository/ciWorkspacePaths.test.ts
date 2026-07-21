import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");

describe("CI desktop workspace paths", () => {
  it("keeps root commands and caches the moved Rust crate", () => {
    for (const command of [
      "pnpm test -- --run",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm build:plugin-api",
      "pnpm check:plugin-api",
      "pnpm build:create-plugin",
      "pnpm smoke:create-plugin",
      "pnpm build",
      "pnpm test:rust",
    ]) {
      expect(workflow).toContain(`run: ${command}`);
    }
    expect(workflow).toContain("workspaces: apps/desktop/src-tauri");
    expect(workflow).not.toContain("workspaces: src-tauri");
  });
});
