import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = resolve(root, "scripts/stage-package.ts");
const check = resolve(root, "scripts/check-package.ts");
const tarball = resolve(root, ".tmp/package/nexora-create-plugin-0.1.1.tgz");
const distCli = resolve(root, "dist/cli.js");
const originalDist = readFileSync(distCli);
const work = mkdtempSync(join(tmpdir(), "create-plugin-package-"));

function run(script: string) {
  return spawnSync("pnpm", ["exec", "tsx", script], { cwd: root, encoding: "utf8" });
}

beforeAll(() => execFileSync("pnpm", ["build"], { cwd: root }));
afterAll(() => {
  writeFileSync(distCli, originalDist);
  rmSync(work, { recursive: true, force: true });
});

describe("create-plugin package lifecycle", () => {
  it("rejects stale builds rather than falling back to checked-in dist", () => {
    const buildCli = resolve(root, ".tmp/build/cli.js");
    const old = new Date(Math.min(statSync(resolve(root, "src/cli.ts")).mtimeMs, statSync(resolve(root, "package.json")).mtimeMs) - 10_000);
    utimesSync(buildCli, old, old);
    utimesSync(resolve(root, ".tmp/templates"), old, old);
    writeFileSync(distCli, "#!/usr/bin/env node\nthrow new Error('stale dist');\n");
    const result = run(stage);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("stale");
  });

  it("rejects stale recursively nested template inputs", () => {
    execFileSync("pnpm", ["build"], { cwd: root });
    const nestedTemplate = resolve(root, "templates/rust-driver/src/handlers/query.rs");
    const original = statSync(nestedTemplate);
    const fresh = new Date(Date.now() + 10_000);
    try {
      utimesSync(nestedTemplate, fresh, fresh);
      const result = run(stage);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("templates/rust-driver/src/handlers/query.rs");
    } finally {
      utimesSync(nestedTemplate, original.atime, original.mtime);
    }
  });

  it("rejects a mutated canonical tarball", () => {
    execFileSync("pnpm", ["build"], { cwd: root });
    expect(run(stage).status).toBe(0);
    copyFileSync(tarball, join(work, "before.tgz"));
    writeFileSync(tarball, Buffer.concat([readFileSync(tarball), Buffer.from("mutation")]));
    const result = run(check);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("checksum mismatch");
  });
});
