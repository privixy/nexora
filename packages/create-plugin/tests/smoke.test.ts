import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smoke = resolve(root, "scripts/smoke.ts");

function run(args: string[]) {
  return spawnSync("pnpm", ["exec", "tsx", smoke, ...args], { cwd: root, encoding: "utf8" });
}

describe("create-plugin smoke runner", () => {
  it("supports the complete static matrix with cargo skipped", () => {
    execFileSync("pnpm", ["build"], { cwd: root });
    const result = run(["--skip-cargo"]);
    expect(result.status).toBe(0);
    for (const kind of ["network", "file", "folder", "api"]) expect(result.stdout).toContain(kind);
    expect(result.stdout).toContain("non-network UI rejection");
    expect(result.stdout).toContain("UI static validation");
  });

  it("keeps temporary output only when requested", () => {
    const result = run(["--skip-cargo", "--keep-temp"]);
    expect(result.status).toBe(0);
    const match = /Temporary smoke root: (.+)/.exec(result.stdout);
    expect(match?.[1]).toBeDefined();
    const path = match![1]!.trim();
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).isDirectory()).toBe(true);
    rmSync(path, { recursive: true, force: true });
  });

  it("cleans temporary output in finally when validation fails", () => {
    const emptyPath = mkdtempSync(join(tmpdir(), "create-plugin-smoke-path-"));
    const result = spawnSync(process.execPath, ["--import", "tsx", smoke], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: emptyPath },
    });
    const match = /Temporary smoke root: (.+)/.exec(`${result.stdout}${result.stderr}`);
    expect(result.status).not.toBe(0);
    expect(match?.[1]).toBeDefined();
    expect(existsSync(match![1]!.trim())).toBe(false);
    rmSync(emptyPath, { recursive: true, force: true });
  });
});
