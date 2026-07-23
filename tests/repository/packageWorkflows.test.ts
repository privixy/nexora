import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("workspace package workflows", () => {
  it("splits independently diagnosable CI jobs", () => {
    const workflow = read(".github/workflows/ci.yml");
    for (const job of ["repository:", "desktop:", "plugin-api:", "create-plugin:", "rust:"]) expect(workflow).toContain(job);
    expect(workflow).toContain("pnpm --filter @nexora/plugin-api check");
    expect(workflow).toContain("pnpm --filter @nexora/create-plugin check");
    expect(workflow).toContain("workspaces: apps/desktop/src-tauri");
    expect(workflow).not.toMatch(/run: (npm|yarn) /);
  });

  it("makes create-plugin CI self-contained before full smoke validation", () => {
    const workflow = read(".github/workflows/ci.yml");
    const createPluginJob = workflow.slice(workflow.indexOf("  create-plugin:"), workflow.indexOf("  rust:"));
    const commands = [
      "pnpm --filter @nexora/plugin-api build",
      "pnpm --filter @nexora/plugin-api check:sync",
      "pnpm --filter @nexora/plugin-api pack:stage",
      "pnpm --filter @nexora/plugin-api pack:check",
      "pnpm --filter @nexora/create-plugin check",
    ];
    for (const [index, command] of commands.entries()) {
      expect(createPluginJob).toContain(`run: ${command}`);
      if (index > 0) expect(createPluginJob.indexOf(commands[index - 1]!)).toBeLessThan(createPluginJob.indexOf(command));
    }
  });

  it("runs the complete plugin contract in package-plan lifecycle order", () => {
    const rootPackage = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(rootPackage.scripts["test:plugin-contract"]).toBe(
      "pnpm test tests/repository/pluginManifestSchema.test.ts -- --run && pnpm --filter @nexora/desktop typecheck:plugin-contract && pnpm --filter @nexora/desktop test tests/features/plugins/lib/pluginModuleLoader.test.ts tests/features/plugins/state/PluginSlotProvider.test.tsx -- --run && cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests",
    );

    const workflow = read(".github/workflows/ci.yml");
    const desktopJob = workflow.slice(workflow.indexOf("  desktop:"), workflow.indexOf("  plugin-api:"));
    expect(desktopJob.indexOf("run: pnpm test:desktop -- --run")).toBeLessThan(
      desktopJob.indexOf("run: pnpm --filter @nexora/desktop typecheck:plugin-contract"),
    );
    expect(desktopJob.indexOf("run: pnpm --filter @nexora/desktop typecheck:plugin-contract")).toBeLessThan(
      desktopJob.indexOf("run: pnpm typecheck"),
    );

    const rustJob = workflow.slice(workflow.indexOf("  rust:"));
    expect(rustJob.indexOf("run: pnpm test:plugin-contract")).toBeLessThan(
      rustJob.indexOf("run: pnpm lint:rust"),
    );
    expect(rustJob.indexOf("run: pnpm lint:rust")).toBeLessThan(
      rustJob.indexOf("run: pnpm test:rust"),
    );
  });

  it("publishes only canonical validated tarballs", () => {
    const workflow = read(".github/workflows/npm-publish.yml");
    const plugin = "packages/plugin-api/.tmp/package/nexora-plugin-api-0.1.0.tgz";
    const creator = "packages/create-plugin/.tmp/package/nexora-create-plugin-0.1.1.tgz";
    expect(workflow).toContain(plugin);
    expect(workflow).toContain(creator);
    expect(workflow).toContain("sha256sum --check");
    expect(workflow).toContain(`pnpm publish "${plugin}"`);
    expect(workflow).toContain(`pnpm publish "${creator}"`);
    expect(workflow).not.toContain("pnpm pack");
    expect(workflow).toContain("ENABLE_STORE_PUBLISH == 'true'");
  });
});
