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
