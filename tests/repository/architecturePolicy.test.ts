import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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
    expect(policy.frontendTestOwners).toEqual({
      "apps/desktop/tests/components/SlotAnchor.test.tsx": [
        "apps/desktop/src/components/ui/SlotAnchor.tsx",
        "apps/desktop/src/components/ui/SlotErrorBoundary.tsx",
        "apps/desktop/src/contexts/PluginSlotProvider.tsx",
        "apps/desktop/src/contexts/PluginSlotContext.ts",
        "apps/desktop/src/contexts/SettingsContext.ts",
        "apps/desktop/src/types/pluginSlots.ts",
      ],
      "apps/desktop/tests/components/layout/sidebar/SidebarTableItem.test.ts": [
        "apps/desktop/src/utils/sidebarTableItem.ts",
      ],
      "apps/desktop/tests/components/modals/NewConnectionModal.credentials.test.tsx": [
        "apps/desktop/src/components/modals/NewConnectionModal.tsx",
      ],
      "apps/desktop/tests/contexts/DatabaseProvider.context-tuples.test.tsx": [
        "apps/desktop/src/contexts/DatabaseProvider.tsx",
        "apps/desktop/src/contexts/DatabaseContext.ts",
        "apps/desktop/src/hooks/useDatabase.ts",
      ],
      "apps/desktop/tests/utils/minimax.test.ts": [
        "apps/desktop/src/utils/settings.ts",
        "apps/desktop/src/utils/settingsUI.ts",
        "apps/desktop/src/contexts/SettingsContext.ts",
      ],
      "apps/desktop/tests/utils/sqlSplitter/dialects.test.ts": [
        "apps/desktop/src/utils/sqlSplitter/index.ts",
        "apps/desktop/src/utils/sqlSplitter/splitter.ts",
        "apps/desktop/src/utils/sqlSplitter/tokenizer.ts",
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

  it("ratchets file-size baselines to current tracked file sizes", () => {
    expect(policy.fileSizeBaselines["apps/desktop/src-tauri/src/drivers/mysql/mod.rs"]).toBe(2340);
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
