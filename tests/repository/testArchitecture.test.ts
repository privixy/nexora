import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const policy = JSON.parse(read("architecture/policy.json")) as {
  frontendTestOwners?: Record<string, string[]>;
  rustIntegrationTests?: Record<
    string,
    {
      classification: string;
      defaultMode: string;
      explicitRun: string;
    }
  >;
};
const expectedRustPeerTests: string[] = [];

describe("test architecture", () => {
  it("keeps root tests in the repository namespace", () => {
    expect(existsSync(resolve(repoRoot, "tests/repository"))).toBe(true);
    expect(read("vitest.config.ts")).toContain('name: "repository"');
    expect(read("vitest.config.ts")).toContain(
      '"./apps/desktop/vitest.config.ts"',
    );
  });

  it("keeps desktop tests and setup inside the desktop workspace", () => {
    const config = read("apps/desktop/vitest.config.ts");
    expect(config).toContain('name: "desktop"');
    expect(config).toContain('setupFiles: ["./tests/setup.ts"]');
    expect(config).toContain('include: ["tests/**/*.{test.ts,test.tsx}"]');
    expect(config).not.toContain('src/**/*.{test,spec}');
  });

  it("keeps command test inventories disjoint", () => {
    const listedTests = execFileSync(
      "cargo",
      [
        "test",
        "--manifest-path",
        "apps/desktop/src-tauri/Cargo.toml",
        "commands::tests::",
        "--",
        "--list",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .split(/\r?\n/)
      .filter((line) => line.endsWith(": test"));

    const exportImportTests = listedTests.filter((line) =>
      line.startsWith("commands::tests::export_import::"),
    );
    const groupTreeTests = listedTests.filter((line) =>
      line.startsWith("commands::tests::group_tree::"),
    );
    const commandTests = listedTests.filter(
      (line) =>
        line.startsWith("commands::tests::") &&
        !line.startsWith("commands::tests::export_import::") &&
        !line.startsWith("commands::tests::group_tree::"),
    );
    const unrelatedTests = listedTests.filter(
      (line) => !line.startsWith("commands::tests::"),
    );

    expect(commandTests).toHaveLength(109);
    expect(exportImportTests).toHaveLength(7);
    expect(groupTreeTests).toHaveLength(17);
    expect(unrelatedTests).toEqual([
      "connection_import_commands::tests::cache_requires_preview_and_removes_secret_envelope_once: test",
      "connection_import_commands::tests::foreign_preview_and_apply_preserve_one_shot_secret_cache_workflow: test",
      "connection_import_commands::tests::nexora_preview_and_apply_preserve_load_transform_apply_order: test",
      "connection_import_commands::tests::source_listing_preserves_availability_then_count_order_and_fields: test",
      "dump_commands::tests::legacy_dump_import_orchestration_contract_is_preserved: test",
      "dump_commands::tests::test_escape_sql_value: test",
      "dump_commands::tests::test_zip_import_logic: test",
    ]);
    expect([
      ...commandTests,
      ...exportImportTests,
      ...groupTreeTests,
      ...unrelatedTests,
    ].sort()).toEqual([...listedTests].sort());
  });

  it("classifies every non-mirroring desktop frontend suite with exact owners", () => {
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
    for (const sameNameSuite of ["classify", "splitter", "tokenizer"]) {
      expect(policy.frontendTestOwners).not.toHaveProperty(
        `apps/desktop/tests/utils/sqlSplitter/${sameNameSuite}.test.ts`,
      );
    }
  });

  it("classifies every Rust integration test and preserves external infrastructure semantics", () => {
    const integrationTests = execFileSync(
      "git",
      ["ls-files", "apps/desktop/src-tauri/tests/*.rs"],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();

    expect(Object.keys(policy.rustIntegrationTests ?? {}).sort()).toEqual(integrationTests);
    expect(policy.rustIntegrationTests).toHaveProperty(
      "apps/desktop/src-tauri/tests/database_integration.rs",
      {
        classification: "external-infrastructure",
        defaultMode: "ignored",
        explicitRun:
          "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --ignored",
      },
    );
  });

  it("rejects Rust peer-test files", () => {
    const rustPeerTests = execFileSync(
      "git",
      [
        "ls-files",
        "apps/desktop/src-tauri/src/*_tests.rs",
        "apps/desktop/src-tauri/src/**/*_tests.rs",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();

    expect(rustPeerTests).toEqual(expectedRustPeerTests);
  });
});
