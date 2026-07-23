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
      writeFixture(root, file, ['import "../../apps/desktop/src/../src/private";', 'import "../../../outside";', 'import "/apps/desktop/src/private";', 'import "file:///apps/desktop/src/private";', 'import "@desktop/private";', 'import "@desktop/../../../../outside";', 'import "@escape/private";'].join("\n"));
      const violations = collectViolations(root, {
        ...basePolicy,
        frontendTestRoots: ["tests/repository"],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["apps/desktop/src/../src"],
        repositoryTestImportAliases: { "@desktop": "apps/desktop/src/../src", "@desktop/private": "packages/private", "@escape": "../outside" },
        sourceRoots: [],
      }, { trackedFiles: [file], workspacePackageDirectories: [] });
      expect(violations).toContain(`${file}: repository import path escapes the repository: ../../../outside`);
      expect(violations).toContain(`${file}: absolute repository import path is forbidden: /apps/desktop/src/private`);
      expect(violations).toContain(`${file}: absolute repository import path is forbidden: file:///apps/desktop/src/private`);
      expect(violations).toContain(`${file}: repository import alias is ambiguous: @desktop/private`);
      expect(violations).toContain(`${file}: repository import path escapes the repository: @desktop/../../../../outside`);
      expect(violations).toContain(`${file}: repository import path escapes the repository: @escape/private`);
      expect(violations.filter((violation) => violation.includes("must not import desktop-private modules"))).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects import.meta glob references and non-static forbidden contexts", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-meta-glob-"));
    try {
      const file = "tests/repository/globs.test.ts";
      writeFixture(root, file, ['import.meta.glob("../../apps/desktop/src/**/*.ts", { eager: true });', 'import.meta.globEager(["@/features/*.ts", "./safe/*.ts"], { import: "default" });', "import.meta.glob(`@/features/${name}.ts`);", 'const text = "import.meta.glob(\\"@/ignored/*.ts\\")";', '// import.meta.glob("@/ignored/*.ts");'].join("\n"));
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
      expect(violations.filter((violation) => violation.includes("target must be a static string or string array"))).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects nested Rust test cfg predicates and production test-gated include macros", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-rust-cfg-"));
    try {
      const inline = "apps/desktop/src-tauri/src/nested.rs";
      const included = "apps/desktop/src-tauri/src/included.rs";
      const nestedIncluded = "apps/desktop/src-tauri/src/nested_included.rs";
      writeFixture(root, inline, "#[cfg(any(unix, all(feature = \"x\", not(not(test)))))]\nmod hidden { fn test() {} }\n");
      writeFixture(root, included, "#[cfg_attr(feature = \"x\", cfg(any(unix, test)))]\ninclude!(\"tests.rs\");\n");
      writeFixture(root, nestedIncluded, "#[cfg(test)]\nmod hidden { include!(\"tests.rs\"); }\n");
      const violations = collectViolations(root, { ...basePolicy, sourceRoots: ["apps/desktop/src-tauri/src"] }, { trackedFiles: [inline, included, nestedIncluded], workspacePackageDirectories: [] });
      expect(violations).toContain(`inline Rust test module is forbidden: ${inline}`);
      expect(violations).toContain(`${included}: test-gated include! is forbidden in Rust production sources`);
      expect(violations).toContain(`${nestedIncluded}: test-gated include! is forbidden in Rust production sources`);
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
        "parameterized_alias.rs": "use tauri::command as handler;\n#[handler(rename_all = \"snake_case\")]\nfn bypass() {}\n",
        "parameterized_crate_alias.rs": "use tauri as shell;\n#[shell::command(async)]\nfn bypass() {}\n",
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
        "glob.rs": "use std::fs::*;\nfn run() { read(\"x\").unwrap(); }\n",
        "grouped_glob.rs": "use std::{fs::*, path::Path};\nfn run() { remove_file(\"x\").unwrap(); }\n",
        "absolute_glob.rs": "use ::std::fs::*;\nfn run() { copy(\"x\", \"y\").unwrap(); }\n",
        "absolute.rs": "fn run() { ::std::fs::read(\"x\").unwrap(); }\n",
        "std_alias.rs": "use std as standard;\nfn run() { standard::fs::write(\"x\", \"y\").unwrap(); }\n",
        "file.rs": "use std::fs::File;\nfn run() { File::open(\"x\").unwrap(); }\n",
        "file_alias.rs": "use std::fs::File as Handle;\nfn run() { Handle::create(\"x\").unwrap(); }\n",
        "qualified_file.rs": "fn run() { std::fs::File::options().open(\"x\").unwrap(); }\n",
        "generic.rs": "fn run() { std::fs::read::<&str>(\"x\").unwrap(); }\n",
        "aliased_generic.rs": "use std::fs as disk;\nfn run() { disk::read::<&str>(\"x\").unwrap(); }\n",
      };
      const safe = "apps/desktop/src-tauri/src/commands/safe.rs";
      const excepted = "apps/desktop/src-tauri/src/commands/excepted.rs";
      const files = Object.keys(cases).map((name) => `apps/desktop/src-tauri/src/commands/${name}`);
      Object.entries(cases).forEach(([name, source]) => writeFixture(root, `apps/desktop/src-tauri/src/commands/${name}`, source));
      writeFixture(root, safe, '// use std::fs as disk; disk::read("x");\nfn run() { let value = "std::fs::write File::open include!( path ="; }\n');
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

  it("resolves TypeScript import-equals, import options, and typed glob syntax", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-typescript-imports-"));
    try {
      const cases = {
        "import-equals.test.ts": 'import privateModule = require("@desktop/private");\n',
        "dynamic-options.test.ts": 'const privateModule = import("@desktop/private", { with: { type: "json" } });\n',
        "typed-glob.test.ts": 'const privateModules = import.meta.glob<Record<string, unknown>>("@desktop/private/*.ts", { eager: true });\n',
      };
      const safe = "tests/repository/import-text.test.ts";
      const files = Object.keys(cases).map((name) => `tests/repository/${name}`);
      Object.entries(cases).forEach(([name, source]) => writeFixture(root, `tests/repository/${name}`, source));
      writeFixture(root, safe, 'const text = "import privateModule = require(\\\"@desktop/private\\\") import.meta.glob<T>(\\\"@desktop/private\\\")";\n// import("@desktop/private", { with: {} });\n');
      const violations = collectViolations(root, {
        ...basePolicy,
        frontendTestRoots: ["tests/repository"],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["apps/desktop/src"],
        repositoryTestImportAliases: { "@desktop": "apps/desktop/src" },
        sourceRoots: [],
      }, { trackedFiles: [...files, safe], workspacePackageDirectories: [] });
      for (const file of files) expect(violations).toContain(`${file}: repository tests may inspect files but must not import desktop-private modules from apps/desktop/src`);
      expect(violations.some((violation) => violation.startsWith(`${safe}:`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves absolute and extern-crate aliases for Tauri command attributes", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-tauri-adversarial-"));
    try {
      const cases = {
        "absolute.rs": "#[::tauri::command]\nfn bypass() {}\n",
        "extern_alias.rs": "extern crate tauri as shell;\n#[shell::command]\nfn bypass() {}\n",
      };
      const safe = "apps/desktop/src-tauri/src/domains/text.rs";
      const files = Object.keys(cases).map((name) => `apps/desktop/src-tauri/src/domains/${name}`);
      Object.entries(cases).forEach(([name, source]) => writeFixture(root, `apps/desktop/src-tauri/src/domains/${name}`, source));
      writeFixture(root, safe, 'const TEXT: &str = "#[::tauri::command] extern crate tauri as shell";\n// #[tauri::command]\nfn allowed() {}\n');
      const violations = collectViolations(root, {
        ...basePolicy,
        sourceRoots: ["apps/desktop/src-tauri/src"],
        rustBackendBoundaries: { sourceRoot: "apps/desktop/src-tauri/src", legacyTransferOwners: {} },
      }, { trackedFiles: [...files, safe], workspacePackageDirectories: [] });
      for (const file of files) expect(violations).toContain(`${file}: Tauri handlers must live under commands or an approved legacy root owner`);
      expect(violations).not.toContain(`${safe}: Tauri handlers must live under commands or an approved legacy root owner`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("distinguishes test cfg predicates from unrelated test tokens", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-rust-cfg-attr-"));
    try {
      const positive = "apps/desktop/src-tauri/src/positive.rs";
      const nested = "apps/desktop/src-tauri/src/nested_positive.rs";
      const safe = "apps/desktop/src-tauri/src/safe.rs";
      writeFixture(root, positive, "#[cfg(test)]\nmod tests { fn check() {} }\n");
      writeFixture(root, nested, "#[cfg_attr(unix, cfg(any(feature = \"x\", test)))]\nmod tests { fn check() {} }\n");
      writeFixture(root, safe, "#[cfg_attr(unix, allow(test))]\nmod support { fn test() {} }\n");
      const violations = collectViolations(root, { ...basePolicy, sourceRoots: ["apps/desktop/src-tauri/src"] }, { trackedFiles: [positive, nested, safe], workspacePackageDirectories: [] });
      expect(violations).toContain(`inline Rust test module is forbidden: ${positive}`);
      expect(violations).toContain(`inline Rust test module is forbidden: ${nested}`);
      expect(violations.some((violation) => violation.startsWith(`${safe}:`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores include and path text in Rust strings and comments", () => {
    const root = mkdtempSync(join(tmpdir(), "nexora-rust-text-"));
    try {
      const production = "apps/desktop/src-tauri/src/text.rs";
      const testSource = "apps/desktop/src-tauri/src/tests/text.rs";
      const actualPath = "apps/desktop/src-tauri/src/path_module.rs";
      const actualInclude = "apps/desktop/src-tauri/src/tests/included.rs";
      writeFixture(root, production, 'const TEXT: &str = "#[path = \\\"other.rs\\\"] include!(\\\"tests.rs\\\")";\n// #[path = "comment.rs"]\n// include!("comment.rs");\n');
      writeFixture(root, testSource, 'const TEXT: &str = "include!(\\\"other.rs\\\") #[path = \\\"other.rs\\\"] mod other;";\n// include!("comment.rs");\n// #[path = "comment.rs"] mod comment;\n');
      writeFixture(root, actualPath, '#[path = "other.rs"]\nmod other;\n');
      writeFixture(root, actualInclude, 'include!("other.rs");\n');
      const violations = collectViolations(root, { ...basePolicy, sourceRoots: ["apps/desktop/src-tauri/src"] }, { trackedFiles: [production, testSource, actualPath, actualInclude], workspacePackageDirectories: [] });
      expect(violations.some((violation) => violation.startsWith(`${production}:`))).toBe(false);
      expect(violations.some((violation) => violation.startsWith(`${testSource}:`))).toBe(false);
      expect(violations).toContain(`${actualPath}: Rust production modules must use canonical sibling test modules without path attributes`);
      expect(violations).toContain(`${actualInclude}: include! is forbidden in Rust test sources`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
