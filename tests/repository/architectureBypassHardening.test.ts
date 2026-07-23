import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { collectViolations } from "../../scripts/check-architecture.mjs";

function writeFixture(root: string, file: string, content: string) {
  const filePath = join(root, file);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

const basePolicy = {
  frontendTestRoots: [] as string[],
  forbiddenFrontendTestRoots: [] as string[],
  repositoryTestRoots: [] as string[],
  rootTestRoots: [] as string[],
  allowedWorkspaceDependencies: {},
  fileSizeBaselines: {},
};

describe("architecture policy bypass hardening", () => {
  it("rejects every unsupported JavaScript-family production module extension", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-js-family-"));
    try {
      const files = ["js", "jsx", "mjs", "cjs", "mts", "cts"].map((extension) => `src/bypass.${extension}`);
      for (const file of files) writeFixture(root, file, "export const bypass = true;\n");
      const violations = collectViolations(root, { ...basePolicy, sourceRoots: ["src"] }, { trackedFiles: files, workspacePackageDirectories: [] });
      for (const file of files) expect(violations).toContain(`${file}: unsupported JavaScript-family source extension; use .ts or .tsx`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes repository paths and rejects absolute, escaping, and ambiguous aliases", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-path-normalization-"));
    try {
      const file = "tests/repository/paths.test.ts";
      writeFixture(root, file, ['import "../../apps/desktop/src/../src/private";', 'import "../../../outside";', 'import "/apps/desktop/src/private";', 'import "@desktop/private";'].join("\n"));
      const violations = collectViolations(root, {
        ...basePolicy,
        frontendTestRoots: ["tests/repository"],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["apps/desktop/src/../src"],
        repositoryTestImportAliases: { "@desktop": "apps/desktop/src/../src", "@desktop/private": "packages/private" },
        sourceRoots: [],
      }, { trackedFiles: [file], workspacePackageDirectories: [] });
      expect(violations).toContain(`${file}: repository import path escapes the repository: ../../../outside`);
      expect(violations).toContain(`${file}: absolute repository import path is forbidden: /apps/desktop/src/private`);
      expect(violations).toContain(`${file}: repository import alias is ambiguous: @desktop/private`);
      expect(violations.filter((violation) => violation.includes("must not import desktop-private modules"))).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects import.meta glob references and non-static forbidden contexts", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-meta-glob-"));
    try {
      const file = "tests/repository/globs.test.ts";
      writeFixture(root, file, ['import.meta.glob("../../apps/desktop/src/**/*.ts");', 'import.meta.globEager(["@/features/*.ts", "./safe/*.ts"]);', "import.meta.glob(`@/features/${name}.ts`);", 'const text = "import.meta.glob(\\"@/ignored/*.ts\\")";', '// import.meta.glob("@/ignored/*.ts");'].join("\n"));
      const violations = collectViolations(root, {
        ...basePolicy,
        frontendTestRoots: ["tests/repository"],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["apps/desktop/src"],
        repositoryTestImportAliases: { "@": "apps/desktop/src" },
        sourceRoots: [],
      }, { trackedFiles: [file], workspacePackageDirectories: [] });
      expect(violations.filter((violation) => violation.includes("must not import desktop-private modules"))).toHaveLength(2);
      expect(violations).toContain(`${file}: import.meta.glob target must be a static string or string array`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects nested Rust test cfg predicates and production test-gated include macros", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-rust-cfg-"));
    try {
      const inline = "apps/desktop/src-tauri/src/nested.rs";
      const included = "apps/desktop/src-tauri/src/included.rs";
      writeFixture(root, inline, "#[cfg(any(unix, all(feature = \"x\", not(not(test)))))]\nmod hidden { fn test() {} }\n");
      writeFixture(root, included, "#[cfg_attr(feature = \"x\", cfg(any(unix, test)))]\ninclude!(\"tests.rs\");\n");
      const violations = collectViolations(root, { ...basePolicy, sourceRoots: ["apps/desktop/src-tauri/src"] }, { trackedFiles: [inline, included], workspacePackageDirectories: [] });
      expect(violations).toContain(`inline Rust test module is forbidden: ${inline}`);
      expect(violations).toContain(`${included}: test-gated include! is forbidden in Rust production sources`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves bare, aliased, and grouped Tauri command attributes", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-tauri-attributes-"));
    try {
      const cases = {
        "bare.rs": "use tauri::command;\n#[command]\nfn bypass() {}\n",
        "alias.rs": "use tauri::command as handler;\n#[handler]\nfn bypass() {}\n",
        "grouped.rs": "use tauri::{command, Manager};\n#[command]\nfn bypass() {}\n",
        "grouped_alias.rs": "use tauri::{command as handler, Manager};\n#[handler]\nfn bypass() {}\n",
        "crate_alias.rs": "use tauri as shell;\n#[shell::command]\nfn bypass() {}\n",
      };
      const files = Object.keys(cases).map((name) => `apps/desktop/src-tauri/src/domains/${name}`);
      Object.entries(cases).forEach(([name, source]) => writeFixture(root, `apps/desktop/src-tauri/src/domains/${name}`, source));
      const violations = collectViolations(root, {
        ...basePolicy,
        sourceRoots: ["apps/desktop/src-tauri/src"],
        rustBackendBoundaries: { sourceRoot: "apps/desktop/src-tauri/src", legacyTransferOwners: {} },
      }, { trackedFiles: files, workspacePackageDirectories: [] });
      for (const file of files) expect(violations).toContain(`${file}: Tauri handlers must live under commands or an approved legacy root owner`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves Rust filesystem aliases and imported functions in thin commands", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-rust-fs-aliases-"));
    try {
      const cases = {
        "module.rs": "use std::fs;\nfn run() { fs::read(\"x\").unwrap(); }\n",
        "alias.rs": "use std::fs as disk;\nfn run() { disk::write(\"x\", \"y\").unwrap(); }\n",
        "grouped.rs": "use std::{fs::{self as disk, rename}, path::Path};\nfn run() { disk::read(\"x\").unwrap(); rename(\"x\", \"y\").unwrap(); }\n",
        "function.rs": "use std::fs::remove_file as erase;\nfn run() { erase(\"x\").unwrap(); }\n",
      };
      const safe = "apps/desktop/src-tauri/src/commands/safe.rs";
      const excepted = "apps/desktop/src-tauri/src/commands/excepted.rs";
      const files = Object.keys(cases).map((name) => `apps/desktop/src-tauri/src/commands/${name}`);
      Object.entries(cases).forEach(([name, source]) => writeFixture(root, `apps/desktop/src-tauri/src/commands/${name}`, source));
      writeFixture(root, safe, '// use std::fs as disk; disk::read("x");\nfn run() { let value = "std::fs::write"; }\n');
      writeFixture(root, excepted, "use std::fs as disk;\nfn run() { disk::read(\"x\").unwrap(); }\n");
      const violations = collectViolations(root, {
        ...basePolicy,
        sourceRoots: ["apps/desktop/src-tauri/src"],
        rustBackendBoundaries: {
          sourceRoot: "apps/desktop/src-tauri/src",
          legacyTransferOwners: {},
          commandBusinessLogicPatterns: ["std::fs::"],
          legacyThinCommandExceptions: { [excepted]: { owner: "backend", reason: "migration", expiresOn: "2026-08-15" } },
        },
      }, { trackedFiles: [...files, safe, excepted], workspacePackageDirectories: [], today: "2026-07-24" });
      for (const file of files) expect(violations.some((violation) => violation.startsWith(`${file}: Rust commands must delegate`))).toBe(true);
      expect(violations.some((violation) => violation.startsWith(`${safe}:`))).toBe(false);
      expect(violations.some((violation) => violation.startsWith(`${excepted}:`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
