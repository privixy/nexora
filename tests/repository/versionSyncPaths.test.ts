import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(resolve(repoRoot, "scripts/sync-version.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const desktopPaths = [
  "apps/desktop/package.json",
  "apps/desktop/src/version.ts",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/Cargo.toml",
];

describe("version synchronization paths", () => {
  it.each(desktopPaths)("targets %s", (path) => {
    expect(source).toContain(path);
  });

  it("stages only current versioned paths", () => {
    expect(pkg.scripts.version).toContain("apps/desktop/package.json");
    expect(pkg.scripts.version).toContain("apps/desktop/src/version.ts");
    expect(pkg.scripts.version).not.toContain(" src-tauri/");
    expect(pkg.scripts.version).not.toContain(" src/version.ts");
  });
});
