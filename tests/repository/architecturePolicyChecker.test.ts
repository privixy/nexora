import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { collectViolations, countLines } from "../../scripts/check-architecture.mjs";

function writeFixture(root: string, file: string, content: string) {
  const filePath = join(root, file);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

describe("architecture policy", () => {
  it("reports forbidden root desktop paths", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-architecture-"));

    try {
      mkdirSync(join(tempRoot, "src"));
      const violations = collectViolations(tempRoot, {
        forbiddenRootDesktopPaths: ["src"],
        frontendTestRoots: [],
        forbiddenFrontendTestRoots: [],
        repositoryTestRoots: [],
        rootTestRoots: [],
        repositoryTestForbiddenImportRoots: [],
        rustInlineTestAllowlist: [],
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: [],
      }, {
        trackedFiles: [],
        workspacePackageDirectories: [],
      });

      expect(violations).toEqual([
        "src: desktop-owned paths must live under apps/desktop, not repository root",
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("counts trailing-newline-terminated lines", () => {
    expect(countLines("one\ntwo\n")).toBe(2);
  });

  it("reports architecture policy violations", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-architecture-"));

    try {
      writeFixture(tempRoot, "package.json", JSON.stringify({ name: "nexora", dependencies: { "@nexora/plugin-api": "workspace:*" } }));
      writeFixture(tempRoot, "packages/plugin-api/package.json", JSON.stringify({ name: "@nexora/plugin-api" }));
      writeFixture(tempRoot, "src/NewFeature.test.tsx", "test(\"x\", () => undefined);\n");
      writeFixture(tempRoot, "tests/NewFeature.spec.ts", "test(\"x\", () => undefined);\n");
      writeFixture(tempRoot, "tests/repository/importsDesktop.test.ts", "import { value } from \"../../src/value\";\n");
      writeFixture(tempRoot, "tests/repository/helper.ts", "export { value } from \"../../src-tauri/value\";\n");
      writeFixture(tempRoot, "src/value.ts", "export const value = true;\n");
      writeFixture(tempRoot, "src/Oversized.ts", `${"line\n".repeat(501)}`);
      writeFixture(tempRoot, "src/Ratcheted.tsx", "one\ntwo\n");
      writeFixture(tempRoot, "src-tauri/src/lib.rs", "#[cfg(test)]\nmod tests {\n}\n");

      const fixtureFiles = [
        "package.json",
        "packages/plugin-api/package.json",
        "src/NewFeature.test.tsx",
        "tests/NewFeature.spec.ts",
        "tests/repository/importsDesktop.test.ts",
        "tests/repository/helper.ts",
        "src/value.ts",
        "src/Oversized.ts",
        "src/Ratcheted.tsx",
        "src-tauri/src/lib.rs",
      ];
      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["tests"],
        forbiddenFrontendTestRoots: ["src"],
        frontendTestAllowlist: [],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["src", "src-tauri"],
        rustInlineTestAllowlist: [],
        allowedWorkspaceDependencies: {
          nexora: [],
          "@nexora/plugin-api": [],
        },
        fileSizeBaselines: {
          "src/Ratcheted.tsx": 1,
        },
        sourceRoots: ["src", "src-tauri/src"],
      }, {
        trackedFiles: fixtureFiles,
        workspacePackageDirectories: [".", "packages/plugin-api"],
      });

      expect(violations).toContain("frontend test must not live in production source: src/NewFeature.test.tsx");
      expect(violations).toContain("tests/NewFeature.spec.ts: .spec test files are forbidden; use .test.ts or .test.tsx");
      expect(violations).toContain("tests/repository/importsDesktop.test.ts: repository tests may inspect files but must not import desktop-private modules from src");
      expect(violations).toContain("tests/repository/helper.ts: repository tests may inspect files but must not import desktop-private modules from src-tauri");
      expect(violations).toContain("src/Oversized.ts: 501 lines exceeds soft limit 500; split the file or add a ratcheted baseline with architecture approval");
      expect(violations).toContain("src/Ratcheted.tsx: 2 lines exceeds ratcheted baseline 1");
      expect(violations).toContain("src-tauri/src/lib.rs: inline Rust test modules must move to sibling tests.rs or be documented in the owning inline-test allowlist");
      expect(violations).toContain("package.json: nexora may not depend on workspace package @nexora/plugin-api");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("enforces normalized frontend and Rust test ownership", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-test-architecture-"));

    try {
      const fixtureFiles = [
        "apps/desktop/src/foo.test.ts",
        "apps/desktop/src/components/Foo.tsx",
        "apps/desktop/src/components/ContractOwner.tsx",
        "apps/desktop/tests/components/Foo.test.tsx",
        "apps/desktop/tests/components/Contract.test.tsx",
        "apps/desktop/tests/wrong/Foo.test.tsx",
        "apps/desktop/tests/repository/rootOverflow.test.ts",
        "tests/foo.test.ts",
        "tests/repository/workspaceLayout.test.ts",
        "apps/desktop/src-tauri/src/foo.rs",
        "apps/desktop/src-tauri/src/foo/tests.rs",
        "apps/desktop/src-tauri/src/foo_tests.rs",
        "apps/desktop/src-tauri/src/inline.rs",
        "apps/desktop/src-tauri/src/inline_same_line.rs",
        "apps/desktop/src-tauri/src/inline_with_attribute.rs",
        "apps/desktop/src-tauri/src/inline_multiline_attribute.rs",
        "apps/desktop/src-tauri/src/inline_visible.rs",
        "apps/desktop/src-tauri/src/visible_declaration.rs",
        "apps/desktop/src-tauri/src/unrelated_item.rs",
        "apps/desktop/src-tauri/tests/database_integration.rs",
        "apps/desktop/src-tauri/tests/unknown.rs",
      ];
      for (const file of fixtureFiles) {
        const content = file.endsWith("inline_multiline_attribute.rs")
          ? "#[cfg(test)]\n#[allow(\n  dead_code\n)]\npub(crate) mod tests {\n}\n"
          : file.endsWith("inline_visible.rs")
            ? "#[cfg(test)]\npub mod tests {\n}\n"
            : file.endsWith("visible_declaration.rs")
              ? "#[cfg(test)]\npub(super) mod tests;\n"
              : file.endsWith("inline_with_attribute.rs")
                ? "#[cfg(test)]\n#[allow(dead_code)]\nmod tests {\n}\n"
                : file.endsWith("unrelated_item.rs")
            ? "#[cfg(test)]\nfn helper() {}\n#[allow(dead_code)]\nmod tests {\n}\n"
            : file.endsWith("inline_same_line.rs")
              ? "#[cfg(test)] mod tests {\n}\n"
              : file.endsWith("inline.rs")
            ? "#[cfg(test)]\nmod tests {\n}\n"
            : file.endsWith("foo.rs")
            ? "#[cfg(test)]\nmod tests;\n"
            : "export {};\n";
        writeFixture(tempRoot, file, content);
      }

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["apps/desktop/tests", "tests/repository"],
        forbiddenFrontendTestRoots: ["apps/desktop/src"],
        frontendTestAllowlist: [],
        repositoryTestRoots: ["tests/repository", "apps/desktop/tests/repository"],
        frontendTestOwners: {
          "apps/desktop/tests/components/Contract.test.tsx": [
            "apps/desktop/src/components/ContractOwner.tsx",
          ],
        },
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["apps/desktop/src", "apps/desktop/src-tauri"],
        rustInlineTestAllowlist: [],
        rustCrateLevelTestAllowlist: [],
        rustIntegrationTests: {
          "apps/desktop/src-tauri/tests/database_integration.rs": {
            classification: "external-infrastructure",
            defaultMode: "ignored",
            explicitRun: "cargo test --test database_integration -- --ignored",
          },
        },
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: ["apps/desktop/src", "apps/desktop/src-tauri/src"],
      }, {
        trackedFiles: fixtureFiles,
        workspacePackageDirectories: [],
      });

      expect(violations).toContain("frontend test must not live in production source: apps/desktop/src/foo.test.ts");
      expect(violations).toContain("frontend test must mirror desktop source or use an approved repository namespace: apps/desktop/tests/wrong/Foo.test.tsx");
      expect(violations).toContain("root tests must live under tests/repository: tests/foo.test.ts");
      expect(violations).toContain("crate-level Rust peer test module is forbidden: apps/desktop/src-tauri/src/foo_tests.rs");
      expect(violations).toContain("inline Rust test module is forbidden: apps/desktop/src-tauri/src/inline.rs");
      expect(violations).toContain("inline Rust test module is forbidden: apps/desktop/src-tauri/src/inline_same_line.rs");
      expect(violations).toContain("inline Rust test module is forbidden: apps/desktop/src-tauri/src/inline_with_attribute.rs");
      expect(violations).toContain("inline Rust test module is forbidden: apps/desktop/src-tauri/src/inline_multiline_attribute.rs");
      expect(violations).toContain("inline Rust test module is forbidden: apps/desktop/src-tauri/src/inline_visible.rs");
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/src-tauri/src/visible_declaration.rs"));
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/src-tauri/src/unrelated_item.rs"));
      expect(violations).toContain("Rust integration test is not classified: apps/desktop/src-tauri/tests/unknown.rs");
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/tests/components/Foo.test.tsx"));
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/tests/components/Contract.test.tsx"));
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/tests/repository/rootOverflow.test.ts"));
      expect(violations).not.toContain(expect.stringContaining("tests/repository/workspaceLayout.test.ts"));
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/src-tauri/src/foo/tests.rs"));
      expect(violations).not.toContain(expect.stringContaining("apps/desktop/src-tauri/tests/database_integration.rs"));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects unsupported frontend and repository test extensions", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-test-extensions-"));

    try {
      const supportedFiles = [
        "apps/desktop/tests/components/Supported.test.ts",
        "apps/desktop/tests/components/SupportedView.test.tsx",
        "tests/repository/supported.test.ts",
      ];
      const unsupportedFiles = [
        "apps/desktop/tests/components/Hidden.test.js",
        "apps/desktop/tests/components/HiddenView.test.jsx",
        "tests/repository/hidden.test.mjs",
        "tests/repository/hidden.test.cts",
      ];
      const specFiles = ["apps/desktop/tests/components/Hidden.spec.ts", "tests/repository/hidden.spec.tsx", "tests/repository/hidden.spec.js"];
      for (const file of [...supportedFiles, ...unsupportedFiles, ...specFiles]) {
        writeFixture(tempRoot, file, "export {};\n");
      }
      writeFixture(tempRoot, "apps/desktop/src/components/Supported.ts", "export {};\n");
      writeFixture(tempRoot, "apps/desktop/src/components/SupportedView.tsx", "export {};\n");

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["apps/desktop/tests", "tests/repository"],
        forbiddenFrontendTestRoots: [],
        frontendTestAllowlist: [],
        repositoryTestRoots: ["tests/repository"],
        frontendTestOwners: {
          "apps/desktop/tests/components/Supported.test.ts": ["apps/desktop/src/components/Supported.ts"],
          "apps/desktop/tests/components/SupportedView.test.tsx": ["apps/desktop/src/components/SupportedView.tsx"],
        },
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: [],
        rustInlineTestAllowlist: [],
        rustCrateLevelTestAllowlist: [],
        rustIntegrationTests: {},
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: ["apps/desktop/src"],
      }, {
        trackedFiles: [
          ...supportedFiles,
          ...unsupportedFiles,
          ...specFiles,
          "apps/desktop/src/components/Supported.ts",
          "apps/desktop/src/components/SupportedView.tsx",
        ],
        workspacePackageDirectories: [],
      });

      for (const file of unsupportedFiles) {
        expect(violations).toContain(`${file}: unsupported test extension; use .test.ts or .test.tsx`);
      }
      for (const file of specFiles) {
        expect(violations).toContain(`${file}: .spec test files are forbidden; use .test.ts or .test.tsx`);
      }
      for (const file of supportedFiles) {
        expect(violations).not.toContain(expect.stringContaining(file));
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects stale frontend ownership metadata and policy exceptions", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-test-metadata-"));

    try {
      const testFile = "apps/desktop/tests/components/Contract.test.tsx";
      const arbitraryFile = "apps/desktop/tests/components/Arbitrary.ts";
      const repositoryFile = "apps/desktop/tests/repository/Contract.test.ts";
      const specFile = "apps/desktop/tests/components/Contract.spec.tsx";
      writeFixture(tempRoot, testFile, "export {};\n");
      writeFixture(tempRoot, arbitraryFile, "export {};\n");
      writeFixture(tempRoot, repositoryFile, "export {};\n");
      writeFixture(tempRoot, specFile, "export {};\n");
      writeFixture(tempRoot, "apps/desktop/src/components/Contract.tsx", "export {};\n");
      writeFixture(tempRoot, "apps/desktop/src/components/Existing.tsx", "export {};\n");

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["apps/desktop/tests"],
        forbiddenFrontendTestRoots: ["apps/desktop/src"],
        frontendTestAllowlist: ["apps/desktop/src/missing.test.ts"],
        repositoryTestRoots: ["apps/desktop/tests/repository"],
        frontendTestOwners: {
          [testFile]: ["apps/desktop/src/components/Contract.tsx"],
          [arbitraryFile]: ["apps/desktop/src/components/Existing.tsx"],
          [repositoryFile]: ["apps/desktop/src/components/Existing.tsx"],
          [specFile]: ["apps/desktop/src/components/Existing.tsx"],
          "apps/desktop/tests/components/Unused.test.tsx": [
            "apps/desktop/src/components/Existing.tsx",
          ],
          "apps/desktop/tests/components/Wildcard.test.tsx": [
            "apps/desktop/src/components/*",
          ],
          "apps/desktop/tests/components/Outside.test.tsx": ["package.json"],
          "apps/desktop/tests/components/Stale.test.tsx": [
            "apps/desktop/src/components/Missing.tsx",
          ],
        },
        rootTestRoots: [],
        repositoryTestForbiddenImportRoots: [],
        rustInlineTestAllowlist: ["apps/desktop/src-tauri/src/missing.rs"],
        rustCrateLevelTestAllowlist: ["apps/desktop/src-tauri/src/missing_tests.rs"],
        rustIntegrationTests: {},
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: ["apps/desktop/src", "apps/desktop/src-tauri/src"],
      }, {
        trackedFiles: [
          testFile,
          arbitraryFile,
          repositoryFile,
          specFile,
          "apps/desktop/src/components/Contract.tsx",
          "apps/desktop/src/components/Existing.tsx",
        ],
        workspacePackageDirectories: [],
      });

      expect(violations).toContain(`${testFile}: frontendTestOwners entry is unused because the test already mirrors apps/desktop/src/components/Contract.tsx`);
      for (const invalidFile of [arbitraryFile, repositoryFile, specFile]) {
        expect(violations).toContain(`${invalidFile}: frontendTestOwners key must be an exact *.test.ts or *.test.tsx file below apps/desktop/tests outside the repository namespace`);
      }
      expect(violations).toContain("apps/desktop/tests/components/Unused.test.tsx: frontendTestOwners entry points to a missing tracked test");
      expect(violations).toContain("apps/desktop/src/components/*: frontendTestOwners owner must be an exact existing file below apps/desktop/src");
      expect(violations).toContain("package.json: frontendTestOwners owner must be an exact existing file below apps/desktop/src");
      expect(violations).toContain("apps/desktop/src/components/Missing.tsx: frontendTestOwners owner must be an exact existing file below apps/desktop/src");
      expect(violations).toContain("apps/desktop/src/missing.test.ts: frontendTestAllowlist entry points to a missing tracked file");
      expect(violations).toContain("apps/desktop/src-tauri/src/missing.rs: rustInlineTestAllowlist entry points to a missing tracked file");
      expect(violations).toContain("apps/desktop/src-tauri/src/missing_tests.rs: rustCrateLevelTestAllowlist entry points to a missing tracked file");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects stale template inline-test entries while accepting exact existing entries", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-template-inline-tests-"));

    try {
      const templateRoot = "packages/create-plugin/templates/rust-driver/src";
      const existingFile = `${templateRoot}/utils/identifiers.rs`;
      const missingFile = `${templateRoot}/utils/missing.rs`;
      writeFixture(tempRoot, existingFile, "#[cfg(test)] mod tests {\n}\n");

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: [],
        forbiddenFrontendTestRoots: [],
        frontendTestAllowlist: [],
        repositoryTestRoots: [],
        rootTestRoots: [],
        rustInlineTestAllowlist: [],
        rustTemplateInlineTestRoots: [templateRoot],
        rustTemplateInlineTestAllowlist: [existingFile, missingFile],
        rustCrateLevelTestAllowlist: [],
        rustIntegrationTests: {},
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: [templateRoot],
      }, {
        trackedFiles: [existingFile],
        workspacePackageDirectories: [],
      });

      expect(violations).toContain(`${missingFile}: rustTemplateInlineTestAllowlist entry points to a missing tracked file`);
      expect(violations).not.toContain(expect.stringContaining(existingFile));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("does not allow template inline-test exceptions to exempt desktop Rust", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-architecture-"));

    try {
      const desktopFile = "apps/desktop/src-tauri/src/commands.rs";
      writeFixture(tempRoot, desktopFile, "#[cfg(test)]\nmod tests {\n}\n");

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: [],
        forbiddenFrontendTestRoots: [],
        frontendTestAllowlist: [],
        repositoryTestRoots: [],
        rootTestRoots: [],
        rustInlineTestAllowlist: [],
        rustTemplateInlineTestRoots: ["packages/create-plugin/templates/rust-driver/src"],
        rustTemplateInlineTestAllowlist: [desktopFile],
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: ["apps/desktop/src-tauri/src"],
      }, {
        trackedFiles: [desktopFile],
        workspacePackageDirectories: [],
      });

      expect(violations).toContain(
        `${desktopFile}: rustTemplateInlineTestAllowlist entries must be under rustTemplateInlineTestRoots`,
      );
      expect(violations).toContain(
        `inline Rust test module is forbidden: ${desktopFile}`,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("enforces Rust backend layer and compatibility ownership", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-rust-boundaries-"));

    try {
      const files = {
        "apps/desktop/src-tauri/src/commands/query.rs": "use sqlx::Row;\npub use crate::infrastructure::command_services::query::*;\n",
        "apps/desktop/src-tauri/src/domains/query.rs": "use tauri::AppHandle;\n",
        "apps/desktop/src-tauri/src/drivers/mysql.rs": "use crate::commands;\n",
        "apps/desktop/src-tauri/src/infrastructure/files.rs": "use crate::commands;\n#[tauri::command]\nfn read_file() {}\n",
        "apps/desktop/src-tauri/src/infrastructure/connections/workflows/mod.rs": "pub fn catch_all() {}\n",
        "apps/desktop/src-tauri/src/config.rs": "pub use crate::infrastructure::config::*;\nfn logic() {}\n",
        "apps/desktop/src-tauri/src/count_query_compat.rs": "#[tauri::command]\nfn run() { let _ = \"SELECT COUNT(*) FROM ({}) as count_wrapper\"; }\n",
      };
      for (const [file, content] of Object.entries(files)) writeFixture(tempRoot, file, content);

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: [],
        forbiddenFrontendTestRoots: [],
        repositoryTestRoots: [],
        rootTestRoots: [],
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: ["apps/desktop/src-tauri/src"],
        rustBackendBoundaries: {
          sourceRoot: "apps/desktop/src-tauri/src",
          pureCompatibilityFacades: ["apps/desktop/src-tauri/src/config.rs"],
          frozenSqlOwners: {
            "apps/desktop/src-tauri/src/count_query_compat.rs": {
              patterns: ["SELECT COUNT(*) FROM ({}) as count_wrapper"],
              owner: "future backend behavior program",
              removeAfter: "behavior-approved DatabaseDriver operation replaces this workflow",
            },
          },
          legacyTransferOwners: {},
        },
      }, {
        trackedFiles: Object.keys(files),
        workspacePackageDirectories: [],
      });

      expect(violations).toEqual(expect.arrayContaining([
        expect.stringContaining("commands/query.rs: Rust commands may not depend on sqlx"),
        expect.stringContaining("domains/query.rs: Rust domains may not depend on tauri"),
        expect.stringContaining("drivers/mysql.rs: Rust drivers may not depend on commands or domains"),
        expect.stringContaining("infrastructure/files.rs: Rust infrastructure may not depend on commands"),
        expect.stringContaining("infrastructure/files.rs: Tauri handlers must live under commands"),
        expect.stringContaining("commands/query.rs: command modules must own adapters directly"),
        expect.stringContaining("connections/workflows/mod.rs: catch-all workflow modules are forbidden"),
        expect.stringContaining("config.rs: compatibility facade must contain re-exports only"),
        expect.stringContaining("count_query_compat.rs: frozen SQL owner must not declare a Tauri command"),
      ]));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects frozen SQL outside its exact owner", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-rust-sql-owner-"));

    try {
      const owner = "apps/desktop/src-tauri/src/count_query_compat.rs";
      const offender = "apps/desktop/src-tauri/src/domains/query.rs";
      const sql = "SELECT COUNT(*) FROM ({}) as count_wrapper";
      writeFixture(tempRoot, owner, `fn run() { let _ = "${sql}"; }\n`);
      writeFixture(tempRoot, offender, `fn count() { let _ = "${sql}"; }\n`);

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: [],
        forbiddenFrontendTestRoots: [],
        repositoryTestRoots: [],
        rootTestRoots: [],
        allowedWorkspaceDependencies: {},
        fileSizeBaselines: {},
        sourceRoots: ["apps/desktop/src-tauri/src"],
        rustBackendBoundaries: {
          sourceRoot: "apps/desktop/src-tauri/src",
          pureCompatibilityFacades: [],
          frozenSqlOwners: {
            [owner]: {
              patterns: [sql],
              owner: "future backend behavior program",
              removeAfter: "behavior-approved DatabaseDriver operation replaces this workflow",
            },
          },
          legacyTransferOwners: {},
        },
      }, {
        trackedFiles: [owner, offender],
        workspacePackageDirectories: [],
      });

      expect(violations).toContain(`${offender}: frozen SQL pattern is owned by ${owner}`);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects desktop alias imports from repository tests without flagging package aliases", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-architecture-"));

    try {
      writeFixture(tempRoot, "package.json", JSON.stringify({ name: "nexora" }));
      writeFixture(
        tempRoot,
        "tests/repository/aliases.test.ts",
        [
          'import { value } from "@/utils/data\\"base";',
          "import(\n  '@/contexts/DatabaseContext'\n);",
          'export { APP_VERSION }\nfrom "@/version";',
          'import "@testing-library/react";',
          '// import "@/comments/line";',
          '/* export { value } from "@/comments/block"; */',
          'const fixture = "import(\\"@/fixtures/string\\")";',
          "const single = 'export { value } from \\\"@/fixtures/single\\\"';",
          'const template = `import "@/fixtures/template"`;',
          'const regex = /export { value } from "@\\/fixtures\\/regex"[a-z/]+/giu;',
          'const ratio = total / count;',
        ].join("\n"),
      );

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["tests/repository"],
        forbiddenFrontendTestRoots: [],
        frontendTestAllowlist: [],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["apps/desktop/src"],
        repositoryTestImportAliases: { "@": "apps/desktop/src" },
        rustInlineTestAllowlist: [],
        allowedWorkspaceDependencies: { nexora: [] },
        fileSizeBaselines: {},
        sourceRoots: [],
      }, {
        trackedFiles: ["package.json", "tests/repository/aliases.test.ts"],
        workspacePackageDirectories: ["."],
      });

      expect(violations).toEqual([
        "tests/repository/aliases.test.ts: repository tests may inspect files but must not import desktop-private modules from apps/desktop/src",
        "tests/repository/aliases.test.ts: repository tests may inspect files but must not import desktop-private modules from apps/desktop/src",
        "tests/repository/aliases.test.ts: repository tests may inspect files but must not import desktop-private modules from apps/desktop/src",
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("ignores untracked and ignored source files and non-workspace package manifests", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-architecture-inventory-"));

    try {
      writeFixture(tempRoot, "package.json", JSON.stringify({ name: "nexora" }));
      writeFixture(tempRoot, "src/tracked.ts", "export const tracked = true;\n");
      writeFixture(tempRoot, "src/untracked.spec.ts", "test(\"x\", () => undefined);\n");
      writeFixture(tempRoot, "src/ignored.ts", "line\n".repeat(501));
      writeFixture(tempRoot, "vendor/package.json", JSON.stringify({ name: "vendor", dependencies: { nexora: "workspace:*" } }));

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["tests"],
        forbiddenFrontendTestRoots: ["src"],
        frontendTestAllowlist: [],
        repositoryTestRoots: ["tests/repository"],
        rootTestRoots: ["tests/repository"],
        repositoryTestForbiddenImportRoots: ["src", "src-tauri"],
        rustInlineTestAllowlist: [],
        allowedWorkspaceDependencies: { nexora: [] },
        fileSizeBaselines: {},
        sourceRoots: ["src"],
      }, {
        trackedFiles: ["package.json", "src/tracked.ts", "vendor/package.json"],
        workspacePackageDirectories: ["."],
      });

      expect(violations).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
