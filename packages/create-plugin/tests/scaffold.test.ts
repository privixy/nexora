import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scaffold } from "../src/scaffold";

const cases = [
  ["network", false], ["network", true], ["file", false], ["file", true], ["folder", false], ["folder", true], ["api", false], ["api", true],
] as const;

describe("scaffold matrix", () => {
  for (const [dbType, withUi] of cases) {
    it(`preserves ${dbType}${withUi ? " with UI" : ""} output`, () => {
      const root = mkdtempSync(join(tmpdir(), "create-plugin-"));
      const targetDir = join(root, "fixture-driver");
      scaffold({ slug: "fixture-driver", displayName: "Fixture Driver", dbType, quote: "\"", withUi, targetDir, gitInit: false, pluginApiVersion: "0.1.0", minNexoraVersion: "0.9.20" });
      const manifest = JSON.parse(readFileSync(join(targetDir, "manifest.json"), "utf8"));
      expect(manifest.id).toBe("fixture-driver");
      expect(manifest.capabilities.file_based).toBe(dbType === "file");
      expect(manifest.capabilities.folder_based).toBe(dbType === "folder");
      expect(manifest.capabilities.no_connection_required).toBe(dbType === "api");
      expect(manifest.ui_extensions).toBeUndefined();
      expect(readdirSync(targetDir)).toContain("src");
      if (withUi) expect(readdirSync(targetDir)).toContain("ui");
      else expect(readdirSync(targetDir)).not.toContain("ui");
    });
  }

  it("generates sibling Rust utility tests without inline modules", () => {
    const root = mkdtempSync(join(tmpdir(), "create-plugin-"));
    const targetDir = join(root, "fixture-driver");
    scaffold({ slug: "fixture-driver", displayName: "Fixture Driver", dbType: "network", quote: "\"", withUi: false, targetDir, gitInit: false, pluginApiVersion: "0.1.0", minNexoraVersion: "0.9.20" });
    for (const utility of ["identifiers", "pagination"]) {
      const source = readFileSync(join(targetDir, "src", "utils", `${utility}.rs`), "utf8");
      expect(source).toContain("#[cfg(test)]\nmod tests;");
      expect(source).not.toMatch(/#\[cfg\(test\)\][\s\S]*mod\s+\w+\s*\{/);
      expect(readFileSync(join(targetDir, "src", "utils", utility, "tests.rs"), "utf8")).toContain("#[test]");
    }
  });

  it("preserves non-empty target rejection", () => {
    const root = mkdtempSync(join(tmpdir(), "create-plugin-"));
    writeFileSync(join(root, "occupied"), "x");
    expect(() => scaffold({ slug: "fixture", displayName: "Fixture", dbType: "network", quote: "\"", withUi: false, targetDir: root, gitInit: false, pluginApiVersion: "0.1.0", minNexoraVersion: "0.9.20" })).toThrow();
  });
});
