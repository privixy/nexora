import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const rootPackage = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { private: boolean };
const desktopPackage = JSON.parse(
  readFileSync(resolve(root, "apps/desktop/package.json"), "utf8"),
) as { name: string; private: boolean; version: string };
const workspace = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");

describe("current workspace layout", () => {
  it("keeps the desktop application at the documented current paths", () => {
    expect(existsSync(resolve(root, "src/main.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "tests/setup.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src-tauri/Cargo.toml"))).toBe(true);
    expect(existsSync(resolve(root, "vite.config.ts"))).toBe(true);
  });
});

describe("desktop workspace migration", () => {
  it("declares the desktop workspace boundary", () => {
    expect(workspace).toContain("- apps/*");
    expect(desktopPackage).toEqual({
      name: "@nexora/desktop",
      private: true,
      version: "1.0.3",
    });
    expect(rootPackage.private).toBe(true);
  });
});
