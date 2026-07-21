import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { collectViolations, countLines } from "../../scripts/check-architecture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const policy = JSON.parse(readFileSync(resolve(root, "architecture/policy.json"), "utf8")) as {
  forbiddenRootDesktopPaths: string[];
  frontendTestRoots: string[];
  forbiddenFrontendTestRoots: string[];
  rootTestExceptionRoots: string[];
  repositoryTestForbiddenImportRoots: string[];
  repositoryTestImportAliases: Record<string, string>;
  rustInlineTestAllowlist: string[];
  allowedWorkspaceDependencies: Record<string, string[]>;
  fileSizeBaselines: Record<string, number>;
  sourceRoots: string[];
};

function writeFixture(root: string, file: string, content: string) {
  const filePath = join(root, file);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

describe("architecture policy", () => {
  it("records current roots and target-protection rules", () => {
    expect(policy.forbiddenRootDesktopPaths).toEqual([
      "src",
      "public",
      "src-tauri",
      "index.html",
      "postcss.config.js",
      "vite.config.ts",
      "vitest.config.ts",
      "tsconfig.app.json",
      "tsconfig.node.json",
    ]);
    expect(policy.frontendTestRoots).toEqual([
      "apps/desktop/tests",
      "tests/repository",
      "packages/create-plugin/tests",
    ]);
    expect(policy.forbiddenFrontendTestRoots).toContain("apps/desktop/src");
    expect(policy.rootTestExceptionRoots).toEqual(["tests/repository"]);
    expect(policy.repositoryTestImportAliases).toEqual({ "@": "apps/desktop/src" });
    expect(policy.repositoryTestForbiddenImportRoots).toEqual([
      "apps/desktop/src",
      "apps/desktop/src-tauri",
    ]);
    expect(policy.rustInlineTestAllowlist).toContain(
      "apps/desktop/src-tauri/src/commands.rs",
    );
    expect(policy.allowedWorkspaceDependencies["@nexora/plugin-api"]).toEqual([]);
    expect(
      policy.fileSizeBaselines["apps/desktop/src/pages/Editor.tsx"],
    ).toBeGreaterThan(0);
    expect(policy.sourceRoots).toEqual([
      "apps/desktop/src",
      "apps/desktop/src-tauri/src",
      "packages/plugin-api/src",
      "packages/create-plugin/src",
      "packages/create-plugin/templates/rust-driver/src",
    ]);
  });

  it("rejects every old root desktop policy path", () => {
    const policyPaths = [
      ...policy.sourceRoots,
      ...policy.frontendTestRoots,
      ...policy.forbiddenFrontendTestRoots,
      ...policy.rootTestExceptionRoots,
      ...policy.repositoryTestForbiddenImportRoots,
      ...policy.rustInlineTestAllowlist,
      ...Object.keys(policy.fileSizeBaselines),
    ];

    expect(
      policyPaths.filter((path) =>
        ["src", "public", "src-tauri"].some(
          (prefix) => path === prefix || path.startsWith(`${prefix}/`),
        ),
      ),
    ).toEqual([]);
  });

  it("reports forbidden root desktop paths", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-architecture-"));

    try {
      mkdirSync(join(tempRoot, "src"));
      const violations = collectViolations(tempRoot, {
        forbiddenRootDesktopPaths: ["src"],
        frontendTestRoots: [],
        forbiddenFrontendTestRoots: [],
        rootTestExceptionRoots: [],
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
        rootTestExceptionRoots: ["tests/repository"],
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

      expect(violations).toContain("src/NewFeature.test.tsx: frontend tests must live under tests unless allowlisted");
      expect(violations).toContain("tests/NewFeature.spec.ts: rename .spec test files to .test files");
      expect(violations).toContain("tests/repository/importsDesktop.test.ts: repository tests may inspect files but must not import desktop-private modules from src");
      expect(violations).toContain("tests/repository/helper.ts: repository tests may inspect files but must not import desktop-private modules from src-tauri");
      expect(violations).toContain("src/Oversized.ts: 501 lines exceeds soft limit 500; split the file or add a ratcheted baseline with architecture approval");
      expect(violations).toContain("src/Ratcheted.tsx: 2 lines exceeds ratcheted baseline 1");
      expect(violations).toContain("src-tauri/src/lib.rs: inline Rust test modules must move to sibling tests.rs or be documented in rustInlineTestAllowlist");
      expect(violations).toContain("package.json: nexora may not depend on workspace package @nexora/plugin-api");
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
          "im" + 'port "@/utils/database";',
          "im" + 'port("@/contexts/DatabaseContext");',
          "ex" + 'port { APP_VERSION } from "@/version";',
          "im" + 'port "@testing-library/react";',
        ].join("\n"),
      );

      const violations = collectViolations(tempRoot, {
        frontendTestRoots: ["tests/repository"],
        forbiddenFrontendTestRoots: [],
        frontendTestAllowlist: [],
        rootTestExceptionRoots: ["tests/repository"],
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
        rootTestExceptionRoots: ["tests/repository"],
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
