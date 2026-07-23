import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = resolve(root, "scripts/stage-package.ts");
const check = resolve(root, "scripts/check-package.ts");
const output = resolve(root, ".tmp/package/nexora-plugin-api-0.1.0.tgz");
const work = mkdtempSync(join(tmpdir(), "plugin-api-package-"));

function run(script: string) {
  return spawnSync("pnpm", ["exec", "tsx", script], { cwd: root, encoding: "utf8" });
}

beforeAll(() => {
  execFileSync("pnpm", ["build"], { cwd: root });
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("plugin-api package lifecycle", () => {
  it("builds before validating the emitted contract", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(packageJson.scripts.test).toContain("--exclude tests/emitted-contract.test.ts");
    expect(packageJson.scripts["test:emitted"]).toBe("vitest run tests/emitted-contract.test.ts");
    expect(packageJson.scripts.check.indexOf("pnpm build")).toBeLessThan(packageJson.scripts.check.indexOf("pnpm test:emitted"));
    expect(packageJson.scripts.check.indexOf("pnpm test:emitted")).toBeLessThan(packageJson.scripts.check.indexOf("pnpm check:sync"));
  });

  it("rejects a build older than package inputs and ignores checked-in dist", () => {
    const buildEntry = resolve(root, ".tmp/build/index.js");
    const old = new Date(Math.min(statSync(resolve(root, "src/index.ts")).mtimeMs, statSync(resolve(root, "package.json")).mtimeMs) - 10_000);
    utimesSync(buildEntry, old, old);
    const result = run(stage);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("stale");
  });

  it("rejects hash mutation without rewriting the canonical artifact", () => {
    execFileSync("pnpm", ["build"], { cwd: root });
    expect(run(stage).status).toBe(0);
    mkdirSync(work, { recursive: true });
    copyFileSync(output, join(work, "before.tgz"));
    writeFileSync(output, Buffer.concat([readFileSync(output), Buffer.from("mutation")]));
    const result = run(check);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("checksum mismatch");
  });
});
