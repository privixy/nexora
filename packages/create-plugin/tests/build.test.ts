import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stagedTemplates = join(root, ".tmp/templates");

afterAll(() => {
  rmSync(stagedTemplates, { recursive: true, force: true });
});

describe("build lifecycle", () => {
  it("freshly stages templates for the compiled CLI and removes stale files", () => {
    rmSync(stagedTemplates, { recursive: true, force: true });
    mkdirSync(join(stagedTemplates, "rust-driver"), { recursive: true });
    writeFileSync(join(stagedTemplates, "rust-driver/stale"), "stale");

    execFileSync("pnpm", ["build"], { cwd: root, stdio: "pipe" });

    expect(existsSync(join(stagedTemplates, "rust-driver/stale"))).toBe(false);
    expect(existsSync(join(stagedTemplates, "rust-driver/manifest.json.tmpl"))).toBe(true);

    const target = join(root, ".tmp/build-lifecycle-plugin");
    rmSync(target, { recursive: true, force: true });
    execFileSync(process.execPath, [join(root, ".tmp/build/cli.js"), "fixture", "--db-type=network", "--no-git", `--dir=${target}`], { stdio: "pipe" });
    expect(existsSync(join(target, "manifest.json"))).toBe(true);
    rmSync(target, { recursive: true, force: true });
  });
});
