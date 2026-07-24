import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncVersion, updateCargoLock, updateCargoToml } from "../../scripts/version-sync";

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "version-sync-"));
  const files: Record<string, string> = {
    "package.json": '{\n  "version": "1.0.0"\n}\n',
    "apps/desktop/package.json": '{\n  "version": "1.0.0"\n}\n',
    "apps/desktop/src-tauri/tauri.conf.json": '{\n  "version": "1.0.0"\n}\n',
    "apps/desktop/src-tauri/Cargo.toml": '[package]\nname = "nexora"\nversion = "1.0.0"\n\n[dependencies]\nfoo = "2.0.0"\n',
    "apps/desktop/src-tauri/Cargo.lock": 'version = 4\n\n[[package]]\nname = "nexora"\nversion = "1.0.0"\n\n[[package]]\nname = "foo"\nversion = "2.0.0"\n',
    "apps/desktop/src/app/config/version.ts": 'export const APP_VERSION = "1.0.0";\n',
    "README.md": 'v1.0.0/Nexora_1.0.0_amd64.deb Nexora_1.0.0_x64-setup.exe\n',
  };
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    const directory = absolute.slice(0, absolute.lastIndexOf("/"));
    mkdirSync(directory, { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

describe("workspace version synchronization", () => {
  it("updates only focused Cargo package versions", () => {
    expect(updateCargoToml('[package]\nversion = "1.0.0"\n[dependencies]\nfoo = "2.0.0"\n', "1.2.3")).toContain('foo = "2.0.0"');
    expect(updateCargoLock('[[package]]\nname = "nexora"\nversion = "1.0.0"\n[[package]]\nname = "foo"\nversion = "2.0.0"\n', "1.2.3")).toContain('name = "foo"\nversion = "2.0.0"');
  });

  it("checks without writes or Cargo", async () => {
    const root = repository();
    const runner = vi.fn();
    await expect(syncVersion({ root, check: true, runner })).resolves.toBeUndefined();
    expect(runner).not.toHaveBeenCalled();
  });

  it("atomically updates every mirror and validates metadata", async () => {
    const root = repository();
    const runner = vi.fn();
    await syncVersion({ root, version: "1.2.3", runner });
    expect(readFileSync(join(root, "apps/desktop/package.json"), "utf8")).toContain("1.2.3");
    expect(readFileSync(join(root, "apps/desktop/src/app/config/version.ts"), "utf8")).toContain("1.2.3");
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("Nexora_1.2.3_amd64.deb");
    expect(runner).toHaveBeenCalledWith("cargo", ["metadata", "--manifest-path", join(root, "apps/desktop/src-tauri/Cargo.toml"), "--offline", "--locked", "--no-deps", "--format-version", "1"]);
  });

  it("rolls every file back when validation fails", async () => {
    const root = repository();
    const before = readFileSync(join(root, "package.json"), "utf8");
    await expect(syncVersion({ root, version: "1.2.3", runner: () => { throw new Error("metadata failed"); } })).rejects.toThrow("metadata failed");
    expect(readFileSync(join(root, "package.json"), "utf8")).toBe(before);
  });
});
