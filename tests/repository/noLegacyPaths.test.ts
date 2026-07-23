import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n");
const excluded = (path: string) => path.startsWith("docs/superpowers/") || path.startsWith("plugins/fixtures/") || path.startsWith(".gitnexus/");

describe("final workspace path policy", () => {
  it("contains no active root desktop compatibility paths", () => {
    const offenders = tracked.filter((path) => !excluded(path) && /^(src|src-tauri|public)(\/|$)|^(vite\.config\.ts|index\.html|tsconfig\.app\.json)$/.test(path));
    expect(offenders).toEqual([]);
  });

  it("keeps workspace and orchestration ownership explicit", () => {
    const workspace = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(workspace).toContain("apps/*");
    expect(workspace).toContain("packages/*");
    expect(pkg.private).toBe(true);
    expect(pkg.scripts.test).toContain("vitest");
    for (const name of ["dev", "build", "typecheck", "tauri"]) expect(pkg.scripts[name]).toContain("@nexora/desktop");
  });

  it("contains no stale moved version path in active tooling", () => {
    const files = tracked.filter((path) => !excluded(path) && (/^(scripts|tests\/repository|\.github|package\.json)/.test(path)));
    const legacyPath = ["apps/desktop", "src", "version.ts"].join("/");
    const offenders = files.filter((path) => path !== "tests/repository/noLegacyPaths.test.ts" && readFileSync(resolve(root, path), "utf8").includes(legacyPath));
    expect(offenders).toEqual([]);
  });
});
