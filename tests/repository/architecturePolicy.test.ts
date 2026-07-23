import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { collectViolations } from "../../scripts/check-architecture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function writeFixture(rootPath: string, file: string, content: string) {
  const filePath = join(rootPath, file);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function basePolicy(overrides: Record<string, unknown> = {}) {
  return {
    sourceRoots: [],
    frontendTestRoots: [],
    forbiddenFrontendTestRoots: [],
    repositoryTestRoots: [],
    rootTestRoots: [],
    rustInlineTestAllowlist: [],
    rustCrateLevelTestAllowlist: [],
    rustIntegrationTests: {},
    allowedWorkspaceDependencies: {},
    fileSizeBaselines: {},
    ...overrides,
  };
}

function boundaryViolations(
  imports: Record<string, string>,
  temporaryExceptions: object[] = [],
  directTauriExceptions: object[] = [],
  sourceOwners: object[] = [],
  sourceFiles: Record<string, string> = {},
  plannedCharacterizationTests: object[] = [],
  tauriGatewayOwnership: object[] = [],
) {
  const tempRoot = mkdtempSync(join(tmpdir(), "nexora-frontend-boundaries-"));
  const trackedFiles = ["package.json"];
  writeFixture(tempRoot, "package.json", JSON.stringify({ name: "nexora" }));

  for (const [file, importTarget] of Object.entries(imports)) {
    writeFixture(tempRoot, file, sourceFiles[file] ?? (/^`/.test(importTarget) ? `import(${importTarget});\n` : `import(${JSON.stringify(importTarget)});\n`));
    trackedFiles.push(file);
  }

  try {
    return collectViolations(tempRoot, {
      sourceRoots: ["apps/desktop/src"],
      frontendTestRoots: [],
      forbiddenFrontendTestRoots: [],
      repositoryTestRoots: [],
      rootTestRoots: [],
      allowedWorkspaceDependencies: { nexora: [] },
      fileSizeBaselines: {},
      frontendBoundaries: {
        sourceRoot: "apps/desktop/src",
        temporaryExceptions,
        directTauriExceptions,
        sourceOwners,
        plannedCharacterizationTests,
        tauriGatewayOwnership,
      },
    }, { trackedFiles, workspacePackageDirectories: ["."] });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const policy = JSON.parse(readFileSync(resolve(root, "architecture/policy.json"), "utf8")) as {
  forbiddenRootDesktopPaths: string[];
  frontendTestRoots: string[];
  forbiddenFrontendTestRoots: string[];
  repositoryTestRoots: string[];
  frontendTestOwners: Record<string, string[]>;
  repositoryTestForbiddenImportRoots: string[];
  repositoryTestImportAliases: Record<string, string>;
  rustInlineTestAllowlist: string[];
  rustTemplateInlineTestRoots: string[];
  rustTemplateInlineTestAllowlist: string[];
  rustCrateLevelTestAllowlist: string[];
  rustLegacyTransferOwners: Record<string, { owner: string; removeAfter: string }>;
  allowedWorkspaceDependencies: Record<string, string[]>;
  fileSizeBaselines: Record<string, number>;
  sourceRoots: string[];
  frontendTestAllowlist: string[];
};

describe("architecture policy", () => {
  it("records current roots and target-protection rules", () => {
    expect(policy.forbiddenRootDesktopPaths).toEqual([
      "src",
      "public",
      "src-tauri",
      "index.html",
      "postcss.config.js",
      "vite.config.ts",
      "tsconfig.app.json",
      "tsconfig.node.json",
    ]);
    expect(policy.frontendTestRoots).toEqual([
      "apps/desktop/tests",
      "tests/repository",
      "packages/create-plugin/tests",
    ]);
    expect(policy.frontendTestRoots).toContain("apps/desktop/tests");
    expect(policy.forbiddenFrontendTestRoots).toContain("apps/desktop/src");
    expect(policy.frontendTestAllowlist).toEqual([]);
    expect(policy.repositoryTestRoots).toEqual([
      "tests/repository",
      "apps/desktop/tests/repository",
    ]);
    expect(policy.frontendTestOwners).toMatchObject({
      "apps/desktop/tests/features/data-grid/publicApi.test.ts": [
        "apps/desktop/src/features/data-grid/index.ts",
        "apps/desktop/src/features/schema/index.ts",
        "apps/desktop/src/features/settings/index.ts",
      ],
      "apps/desktop/tests/features/explorer/lib/sidebarTableItemProps.test.ts": [
        "apps/desktop/src/features/explorer/lib/sidebarTableItem.ts",
      ],
      "apps/desktop/tests/components/modals/NewConnectionModal.credentials.test.tsx": [
        "apps/desktop/src/features/connections/components/NewConnectionModal/NewConnectionModal.tsx",
      ],
      "apps/desktop/tests/contexts/DatabaseProvider.context-tuples.test.tsx": [
        "apps/desktop/src/features/connections/state/DatabaseProvider.tsx",
        "apps/desktop/src/features/connections/state/DatabaseContext.ts",
        "apps/desktop/src/features/connections/hooks/useDatabase.ts",
      ],
      "apps/desktop/tests/utils/minimax.test.ts": [
        "apps/desktop/src/utils/settings.ts",
        "apps/desktop/src/features/settings/lib/settingsUI.ts",
        "apps/desktop/src/features/settings/state/SettingsContext.ts",
      ],
      "apps/desktop/tests/utils/sqlSplitter/dialects.test.ts": [
        "apps/desktop/src/features/editor/lib/sqlSplitter/index.ts",
        "apps/desktop/src/features/editor/lib/sqlSplitter/splitter.ts",
        "apps/desktop/src/features/editor/lib/sqlSplitter/tokenizer.ts",
      ],
    });
    expect(policy.repositoryTestImportAliases).toEqual({ "@": "apps/desktop/src" });
    expect(policy.repositoryTestForbiddenImportRoots).toEqual([
      "apps/desktop/src",
      "apps/desktop/src-tauri",
    ]);
    expect(policy.rustInlineTestAllowlist).toEqual([]);
    expect(policy.rustTemplateInlineTestRoots).toEqual([
      "packages/create-plugin/templates/rust-driver/src",
    ]);
    expect(policy.rustTemplateInlineTestAllowlist).toEqual([
      "packages/create-plugin/templates/rust-driver/src/utils/identifiers.rs",
      "packages/create-plugin/templates/rust-driver/src/utils/pagination.rs",
    ]);
    expect(policy.rustCrateLevelTestAllowlist).toEqual([]);
    expect(policy.rustLegacyTransferOwners).toEqual({
      "apps/desktop/src-tauri/src/export.rs": {
        owner: "future DatabaseDriver semantic transfer program",
        removeAfter: "behavior-approved DatabaseDriver export operations",
      },
      "apps/desktop/src-tauri/src/dump_commands.rs": {
        owner: "future DatabaseDriver semantic transfer program",
        removeAfter: "behavior-approved DatabaseDriver dump and import operations",
      },
      "apps/desktop/src-tauri/src/clipboard_import.rs": {
        owner: "future DatabaseDriver semantic transfer program",
        removeAfter: "behavior-approved DatabaseDriver clipboard transfer operations",
      },
    });
    expect(policy.allowedWorkspaceDependencies["@nexora/plugin-api"]).toEqual([]);
    expect(
      policy.fileSizeBaselines["apps/desktop/src/features/editor/pages/EditorPage.tsx"],
    ).toBeGreaterThan(0);
    expect(policy.sourceRoots).toEqual([
      "apps/desktop/src",
      "apps/desktop/src-tauri/src",
      "packages/plugin-api/src",
      "packages/create-plugin/src",
      "packages/create-plugin/templates/rust-driver/src",
    ]);
  });

  it("ratchets file-size baselines to current tracked file sizes", () => {
    expect(policy.fileSizeBaselines["apps/desktop/src-tauri/src/drivers/mysql/mod.rs"]).toBe(2340);
  });

  it("confines legacy transfer behavior to exact root owners", () => {
    const rustRoot = resolve(root, "apps/desktop/src-tauri/src");
    const collectRustFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory()
          ? collectRustFiles(path)
          : entry.isFile() && entry.name.endsWith(".rs")
            ? [path]
            : [];
      });
    const forbiddenPatterns = [
      /\bsqlx::/,
      /get_(?:mysql|postgres|sqlite)_pool/,
    ];
    const protectedRoots = ["commands", "domains", "infrastructure"]
      .flatMap((directory) => collectRustFiles(resolve(rustRoot, directory)))
      .filter((file) => !file.includes("/infrastructure/pools/"));

    for (const file of protectedRoots) {
      const source = readFileSync(file, "utf8");
      expect(
        forbiddenPatterns.some((pattern) => pattern.test(source)),
        `${file} contains legacy transfer behavior`,
      ).toBe(false);
    }

    expect(existsSync(resolve(rustRoot, "domains/import_export"))).toBe(false);
    const driverTrait = readFileSync(resolve(rustRoot, "drivers/driver_trait.rs"), "utf8");
    expect(driverTrait).not.toMatch(/fn\s+(?:export|dump|import_database|clipboard_import)\b/);
  });

  it.each([
    ["apps/desktop/src/features/editor/pages/EditorPage.tsx", "@/features/data-grid/components/DataGrid"],
    ["apps/desktop/src/features/editor/pages/EditorPage.tsx", "@/features/explorer/components/private/Tree"],
    ["apps/desktop/src/shared/ui/Modal.tsx", "@/features/connections"],
    ["apps/desktop/src/shared/ui/Modal.tsx", "@tauri-apps/api/core"],
    ["apps/desktop/src/features/editor/pages/EditorPage.tsx", "@tauri-apps/api/core"],
    ["apps/desktop/src/platform/tauri/queryGateway.ts", "@/features/editor"],
    ["apps/desktop/src/platform/tauri/contracts/queries.ts", "@/features/editor/contracts"],
    ["apps/desktop/src/features/editor/pages/EditorPage.tsx", "@/app/providers"],
  ])("rejects frontend boundary import %s -> %s", (file, importTarget) => {
    expect(boundaryViolations({ [file]: importTarget })).not.toEqual([]);
  });

  it.each([
    {
      "apps/desktop/src/features/a/index.ts": "@/features/b",
      "apps/desktop/src/features/b/index.ts": "@/features/a",
    },
    {
      "apps/desktop/src/features/a/index.ts": "@/features/b",
      "apps/desktop/src/features/b/index.ts": "@/features/c",
      "apps/desktop/src/features/c/index.ts": "@/features/a",
    },
    {
      "apps/desktop/src/features/settings/index.ts": "@/features/plugins",
      "apps/desktop/src/features/plugins/index.ts": "@/features/settings",
    },
    {
      "apps/desktop/src/features/settings/index.ts": "@/features/visual-explain",
      "apps/desktop/src/features/visual-explain/index.ts": "@/features/settings",
    },
    {
      "apps/desktop/src/features/schema/index.ts": "@/features/editor",
      "apps/desktop/src/features/editor/index.ts": "@/features/schema",
    },
  ])("rejects feature cycles", (imports) => {
    expect(boundaryViolations(imports)).toEqual(expect.arrayContaining([
      expect.stringContaining("feature dependency cycle"),
    ]));
  });

  it("models connection-dependent plugin UI separately from plugin core", () => {
    expect(boundaryViolations({
      "apps/desktop/src/features/connections/index.ts": "../plugins",
      "apps/desktop/src/features/plugins/components/PluginsTab.tsx": "../../connections",
    })).not.toEqual(expect.arrayContaining([
      expect.stringContaining("feature dependency cycle"),
    ]));
  });

  it("detects feature cycles while unrelated temporary exceptions remain", () => {
    const exception = {
      path: "apps/desktop/src/app/routes.tsx",
      importTarget: "../features/editor/pages/EditorPage",
      owner: "app",
      reason: "Unrelated deep import debt",
      removeByTask: 41,
    };

    expect(boundaryViolations({
      "apps/desktop/src/app/routes.tsx": "../features/editor/pages/EditorPage",
      "apps/desktop/src/features/a/index.ts": "../b",
      "apps/desktop/src/features/b/index.ts": "../a",
    }, [exception])).toEqual(expect.arrayContaining([
      expect.stringContaining("feature dependency cycle"),
    ]));
  });

  it("includes excepted cross-feature imports in cycle detection", () => {
    const exception = {
      path: "apps/desktop/src/features/a/index.ts",
      importTarget: "../b/private",
      owner: "a",
      reason: "Temporary deep import debt",
      removeByTask: 41,
    };

    expect(boundaryViolations({
      "apps/desktop/src/features/a/index.ts": "../b/private",
      "apps/desktop/src/features/b/index.ts": "../a",
    }, [exception])).toEqual(expect.arrayContaining([
      expect.stringContaining("feature dependency cycle"),
    ]));
  });

  it("allows app composition of feature public roots, platform, and shared", () => {
    expect(boundaryViolations({
      "apps/desktop/src/app/routes.tsx": "@/features/editor",
      "apps/desktop/src/app/providers.tsx": "@/platform/tauri",
      "apps/desktop/src/app/shell.tsx": "@/shared/ui",
      "apps/desktop/src/features/editor/index.ts": "@/shared/ui",
      "apps/desktop/src/features/settings/index.ts": "@/platform/tauri",
    })).toEqual([]);
  });

  it.each([
    ["apps/desktop/src/shared/ui/Modal.tsx", "@/app/providers"],
    ["apps/desktop/src/shared/ui/Modal.tsx", "../../app/providers"],
    ["apps/desktop/src/platform/tauri/queryGateway.ts", "@/app/providers"],
    ["apps/desktop/src/platform/tauri/queryGateway.ts", "../../app/providers"],
  ])("rejects shared and platform imports of app modules: %s -> %s", (file, importTarget) => {
    expect(boundaryViolations({ [file]: importTarget })).toEqual(expect.arrayContaining([
      expect.stringContaining("may not import app modules"),
    ]));
  });

  it.each([
    "../features/editor",
    "../features/editor/index",
    "../features/editor/index.ts",
    "../features/editor/index.tsx",
  ])("allows app composition through resolved relative feature public roots: %s", (importTarget) => {
    expect(boundaryViolations({
      "apps/desktop/src/app/routes.tsx": importTarget,
    })).toEqual([]);
  });

  it.each([
    "../../schema",
    "../../schema/index",
    "../../schema/index.ts",
    "../../schema/index.tsx",
  ])("allows cross-feature imports through resolved relative public roots: %s", (importTarget) => {
    expect(boundaryViolations({
      "apps/desktop/src/features/editor/pages/EditorPage.tsx": importTarget,
    })).toEqual([]);
  });

  it.each([
    ["apps/desktop/src/app/routes.tsx", "../features/editor/pages/EditorPage", "app imports must use the public feature root"],
    ["apps/desktop/src/features/schema/index.ts", "../editor/pages/EditorPage", "cross-feature imports must use the public feature root"],
  ])("rejects resolved relative feature deep imports: %s -> %s", (file, importTarget, message) => {
    expect(boundaryViolations({ [file]: importTarget })).toEqual(expect.arrayContaining([
      expect.stringContaining(message),
    ]));
  });

  it("rejects app deep imports into features", () => {
    expect(boundaryViolations({
      "apps/desktop/src/app/routes.tsx": "@/features/editor/pages/EditorPage",
    })).toEqual(expect.arrayContaining([expect.stringContaining("app imports must use the public feature root")]));
  });

  it("enforces static template-literal dynamic imports", () => {
    expect(boundaryViolations({
      "apps/desktop/src/app/routes.tsx": "`@/features/editor/pages/EditorPage`",
    })).toEqual(expect.arrayContaining([expect.stringContaining("app imports must use the public feature root")]));
    expect(boundaryViolations({
      "apps/desktop/src/features/editor/index.ts": "`@tauri-apps/api/core`",
    })).toEqual(expect.arrayContaining([expect.stringContaining("direct Tauri import outside platform is forbidden")]));
  });

  it("rejects every non-static dynamic import target but ignores ordinary template strings", () => {
    const file = "apps/desktop/src/features/editor/index.ts";
    for (const target of [
      "featurePath",
      "'@/features/' + feature",
      "resolveFeature(feature)",
      "`@/features/${feature}`",
      "'@/features/editor', options",
    ]) {
      expect(boundaryViolations({ [file]: "unused" }, [], [], [], {
        [file]: `import(${target});\n`,
      })).toEqual(expect.arrayContaining([expect.stringContaining("dynamic import target must be static")]));
    }
    expect(boundaryViolations({ [file]: "unused" }, [], [], [], {
      [file]: "const message = `ordinary ${template}`;\n",
    })).toEqual([]);
  });

  it("requires exact Task 39 direct Tauri inventory rows", () => {
    const importer = "apps/desktop/src/features/editor/index.ts";
    const importTarget = "@tauri-apps/api/core";
    const characterizationTest = "apps/desktop/tests/features/editor/EditorPage.test.tsx";
    const gatewayOrAdapter = "apps/desktop/src/platform/tauri/queryGateway.ts";
    const exception = {
      importer,
      importTarget,
      owner: "editor",
      characterizationTest,
      gatewayOrAdapter,
      removeByTask: 39,
    };
    const sourceOwners = [{ source: importer, destination: importer, owner: "editor", moveTask: 14 }];
    const plannedTests = [{ importer, destination: characterizationTest, task: 34 }];
    const gateways = [{ owner: "editor", importTarget, destination: gatewayOrAdapter, task: 9 }];
    expect(boundaryViolations({ [importer]: importTarget }, [], [exception], sourceOwners, {}, plannedTests, gateways)).toEqual([]);
    expect(boundaryViolations({ [importer]: "@tauri-apps/api/event" }, [], [exception], sourceOwners, {}, plannedTests, gateways)).toEqual(expect.arrayContaining([
      expect.stringContaining("exception is unused"),
      expect.stringContaining("direct Tauri import outside platform is forbidden"),
    ]));
  });

  it.each([
    ["legacy path", { importer: undefined, path: "apps/desktop/src/features/editor/index.ts" }, "exact importer"],
    ["missing characterization", { characterizationTest: "" }, "characterizationTest"],
    ["wildcard characterization", { characterizationTest: "apps/desktop/tests/features/editor/*" }, "characterizationTest"],
    ["unplanned characterization", { characterizationTest: "apps/desktop/tests/features/editor/Missing.test.tsx" }, "existing test or exact planned"],
    ["generic gateway", { gatewayOrAdapter: "windows/events/dialogs/files" }, "gatewayOrAdapter"],
    ["unowned gateway", { gatewayOrAdapter: "apps/desktop/src/platform/tauri/unknownGateway.ts" }, "gatewayOrAdapter"],
  ])("rejects %s in direct Tauri inventory", (_name, override, message) => {
    const importer = "apps/desktop/src/features/editor/index.ts";
    const importTarget = "@tauri-apps/api/core";
    const characterizationTest = "apps/desktop/tests/features/editor/EditorPage.test.tsx";
    const gatewayOrAdapter = "apps/desktop/src/platform/tauri/queryGateway.ts";
    const exception = { importer, importTarget, owner: "editor", characterizationTest, gatewayOrAdapter, removeByTask: 39, ...override };
    const sourceOwners = [{ source: importer, destination: importer, owner: "editor", moveTask: 14 }];
    const plannedTests = [{ importer, destination: characterizationTest, task: 34 }];
    const gateways = [{ owner: "editor", importTarget, destination: gatewayOrAdapter, task: 9 }];
    expect(boundaryViolations({ [importer]: importTarget }, [], [exception], sourceOwners, {}, plannedTests, gateways)).toEqual(expect.arrayContaining([
      expect.stringContaining(message),
    ]));
  });

  it("audits every direct Tauri inventory row against exact characterization and platform staging", () => {
    const inventory = JSON.parse(readFileSync(resolve(root, "architecture/frontend-tauri-exceptions.json"), "utf8")) as object[];
    expect(inventory).toHaveLength(0);
    expect(inventory.filter((row) => (row as { removeByTask?: number }).removeByTask === 32)).toHaveLength(0);
    expect(inventory.every((row) => Object.keys(row).sort().join(",") === [
      "characterizationTest",
      "gatewayOrAdapter",
      "importTarget",
      "importer",
      "owner",
      "removeByTask",
    ].join(","))).toBe(true);
    expect(new Set(inventory.map((row) => JSON.stringify(row))).size).toBe(0);
  });

  it("has no remaining direct Tauri inventory debt", () => {
    const inventory = JSON.parse(
      readFileSync(resolve(root, "architecture/frontend-tauri-exceptions.json"), "utf8"),
    ) as Array<Record<string, unknown>>;
    expect(inventory).toEqual([]);
  });

  it("requires direct Tauri inventory ownership and removal task to match staging", () => {
    const importer = "apps/desktop/src/features/editor/index.ts";
    const importTarget = "@tauri-apps/api/core";
    const characterizationTest = "apps/desktop/tests/features/editor/EditorPage.test.tsx";
    const gatewayOrAdapter = "apps/desktop/src/platform/tauri/queryGateway.ts";
    const imports = { [importer]: importTarget };
    const sourceOwners = [{ source: importer, destination: importer, owner: "editor", moveTask: 14 }];
    const plannedTests = [{ importer, destination: characterizationTest, task: 34 }];
    const gateways = [{ owner: "editor", importTarget, destination: gatewayOrAdapter, task: 9 }];
    expect(boundaryViolations(imports, [], [{
      importer,
      importTarget,
      owner: "frontend",
      characterizationTest,
      gatewayOrAdapter,
      removeByTask: 39,
    }], sourceOwners, {}, plannedTests, gateways)).toEqual(expect.arrayContaining([expect.stringContaining("owner must match final source owner editor")]));
    expect(boundaryViolations(imports, [], [{
      importer,
      importTarget,
      owner: "editor",
      characterizationTest,
      gatewayOrAdapter,
      removeByTask: 14,
    }], sourceOwners, {}, plannedTests, gateways)).toEqual(expect.arrayContaining([expect.stringContaining("removeByTask must be 39")]));
  });

  it("accepts only exact Explorer imports staged for Task 32", () => {
    const importer = "apps/desktop/src/features/explorer/components/ExplorerSidebar.tsx";
    const importTarget = "@tauri-apps/api/core";
    const characterizationTest = "apps/desktop/tests/features/explorer/components/ExplorerSidebar.test.tsx";
    const gatewayOrAdapter = "apps/desktop/src/platform/tauri/dataTransferGateway.ts";
    const imports = { [importer]: importTarget };
    const sourceOwners = [{ source: importer, destination: importer, owner: "explorer", moveTask: 30 }];
    const plannedTests = [{ owner: "explorer", destination: characterizationTest, task: 29 }];
    const gateways = [{ owner: "explorer", importTarget, destination: gatewayOrAdapter, task: 9 }];

    expect(boundaryViolations(imports, [], [{
      importer,
      importTarget,
      owner: "explorer",
      characterizationTest,
      gatewayOrAdapter,
      removeByTask: 32,
    }], sourceOwners, {}, plannedTests, gateways)).toEqual([]);

    expect(boundaryViolations({
      "apps/desktop/src/features/editor/components/Editor.tsx": importTarget,
    }, [], [{
      importer: "apps/desktop/src/features/editor/components/Editor.tsx",
      importTarget,
      owner: "editor",
      characterizationTest: "apps/desktop/tests/features/editor/pages/EditorPage.test.tsx",
      gatewayOrAdapter,
      removeByTask: 32,
    }], [], {}, [{ owner: "editor", destination: "apps/desktop/tests/features/editor/pages/EditorPage.test.tsx", task: 34 }], gateways)).toEqual(expect.arrayContaining([
      expect.stringContaining("removeByTask must be 39"),
    ]));
  });

  it("rejects nontrivial inline Rust test modules with any module name", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-inline-rust-tests-"));
    try {
      const files = {
        "apps/desktop/src-tauri/src/named.rs": "#[cfg(test)]\nmod legacy_tests {\n #[test]\n fn legacy() {}\n}\n",
        "apps/desktop/src-tauri/src/attributed.rs": "#[cfg(test)]\n#[allow(dead_code)]\nmod appearance_tests {\n fn helper() {}\n}\n",
        "apps/desktop/src-tauri/src/canonical.rs": "#[cfg(test)]\nmod tests;\n",
        "apps/desktop/src-tauri/src/empty.rs": "#[cfg(test)] mod tests {}\n",
      };
      for (const [file, content] of Object.entries(files)) writeFixture(tempRoot, file, content);
      const violations = collectViolations(tempRoot, basePolicy({ sourceRoots: ["apps/desktop/src-tauri/src"] }), {
        trackedFiles: Object.keys(files), workspacePackageDirectories: [],
      });
      expect(violations).toEqual(expect.arrayContaining([
        "inline Rust test module is forbidden: apps/desktop/src-tauri/src/named.rs",
        "inline Rust test module is forbidden: apps/desktop/src-tauri/src/attributed.rs",
      ]));
      expect(violations).not.toContain(expect.stringContaining("canonical.rs"));
      expect(violations).not.toContain(expect.stringContaining("empty.rs"));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects Rust test-source include and path duplicate inclusions", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "nexora-rust-test-inclusions-"));
    try {
      const files = {
        "apps/desktop/src-tauri/src/commands/tests/included.rs": "include!(\"canonical.rs\");\n",
        "apps/desktop/src-tauri/src/commands/tests/duplicate.rs": "#[path = \"canonical.rs\"]\nmod canonical_again;\n",
        "apps/desktop/src-tauri/src/commands/tests/canonical.rs": "#[test]\nfn canonical() {}\n",
        "apps/desktop/src-tauri/src/commands/production.rs": "include!(\"shared.rs\");\n",
      };
      for (const [file, content] of Object.entries(files)) writeFixture(tempRoot, file, content);
      const violations = collectViolations(tempRoot, basePolicy({ sourceRoots: ["apps/desktop/src-tauri/src"] }), {
        trackedFiles: Object.keys(files), workspacePackageDirectories: [],
      });
      expect(violations).toEqual(expect.arrayContaining([
        "apps/desktop/src-tauri/src/commands/tests/included.rs: include! is forbidden in Rust test sources",
        "apps/desktop/src-tauri/src/commands/tests/duplicate.rs: test-to-test #[path] module inclusion is forbidden: canonical.rs",
      ]));
      expect(violations).not.toContain(expect.stringContaining("production.rs"));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("requires temporary exceptions to match an active exact import", () => {
    const exception = {
      path: "apps/desktop/src/features/schema/index.ts",
      importTarget: "@/features/editor/internal",
      owner: "schema",
      reason: "temporary",
      removeByTask: 36,
    };
    expect(boundaryViolations({
      "apps/desktop/src/features/schema/index.ts": "@/features/editor/internal",
    }, [exception])).toEqual([]);
    expect(boundaryViolations({
      "apps/desktop/src/features/schema/index.ts": "@/features/editor",
    }, [exception])).toEqual(expect.arrayContaining([expect.stringContaining("exception is unused")]));
  });

  it("rejects every old root desktop policy path", () => {
    const policyPaths = [
      ...policy.sourceRoots,
      ...policy.frontendTestRoots,
      ...policy.forbiddenFrontendTestRoots,
      ...policy.repositoryTestRoots,
      ...Object.keys(policy.frontendTestOwners),
      ...Object.values(policy.frontendTestOwners).flat(),
      ...policy.repositoryTestForbiddenImportRoots,
      ...policy.rustInlineTestAllowlist,
      ...policy.rustTemplateInlineTestRoots,
      ...policy.rustTemplateInlineTestAllowlist,
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
});
