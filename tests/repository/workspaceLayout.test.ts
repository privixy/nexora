import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootPackage = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { private: boolean };
const desktopPackage = JSON.parse(
  readFileSync(resolve(root, "apps/desktop/package.json"), "utf8"),
) as { name: string; private: boolean; version: string };
const workspace = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");

describe("current workspace layout", () => {
  it("owns frontend source, assets, and app configuration in apps/desktop", () => {
    for (const path of [
      "apps/desktop/src/main.tsx",
      "apps/desktop/public/logo.png",
      "apps/desktop/index.html",
      "apps/desktop/vite.config.ts",
      "apps/desktop/vitest.config.ts",
      "apps/desktop/tsconfig.app.json",
      "apps/desktop/tsconfig.node.json",
      "apps/desktop/postcss.config.js",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }

    for (const path of [
      "public",
      "index.html",
      "vite.config.ts",
      "vitest.config.ts",
      "tsconfig.app.json",
      "tsconfig.node.json",
      "postcss.config.js",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(false);
    }
  });

  it("separates desktop tests from root repository contracts", () => {
    expect(existsSync(resolve(root, "apps/desktop/tests/setup.ts"))).toBe(true);
    expect(existsSync(resolve(root, "apps/desktop/tests/utils"))).toBe(true);
    expect(existsSync(resolve(root, "tests/repository"))).toBe(true);
    expect(
      existsSync(resolve(root, "tests/repository/releaseWorkflow.test.ts")),
    ).toBe(true);
    expect(
      existsSync(resolve(root, "tests/repository/releaseDryRunWorkflow.test.ts")),
    ).toBe(true);
    expect(
      existsSync(resolve(root, "apps/desktop/tests/releaseWorkflow.test.ts")),
    ).toBe(false);
    expect(
      existsSync(
        resolve(root, "apps/desktop/tests/releaseDryRunWorkflow.test.ts"),
      ),
    ).toBe(false);

    const rootEntries = readdirSync(resolve(root, "tests")).sort();
    expect(rootEntries).toEqual(["repository"]);
  });

  it("owns the complete Tauri crate in apps/desktop", () => {
    for (const path of [
      "apps/desktop/src-tauri/Cargo.toml",
      "apps/desktop/src-tauri/Cargo.lock",
      "apps/desktop/src-tauri/tauri.conf.json",
      "apps/desktop/src-tauri/src/lib.rs",
      "apps/desktop/src-tauri/tests/integration_tests.rs",
      "apps/desktop/src-tauri/capabilities/default.json",
      "apps/desktop/src-tauri/icons/icon.png",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    expect(existsSync(resolve(root, "src-tauri"))).toBe(false);
  });

  it("keeps plugin sync at its transitional root path", () => {
    expect(existsSync(resolve(root, "src/pluginApi.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/main.tsx"))).toBe(false);
  });
});

describe("desktop workspace migration", () => {
  it("declares the desktop workspace boundary", () => {
    expect(workspace).toContain("- apps/*");
    expect(desktopPackage).toMatchObject({
      name: "@nexora/desktop",
      private: true,
      version: "1.0.3",
    });
    expect(rootPackage.private).toBe(true);
  });
});
