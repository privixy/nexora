import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(
  resolve(repoRoot, "packages/plugin-api/scripts/check-sync.ts"),
  "utf8",
);

describe("plugin API host synchronization", () => {
  it("reads the host barrel from the desktop workspace", () => {
    expect(source).toContain('"apps/desktop/src/features/plugins/lib/pluginApi.ts"');
    expect(source).not.toContain('resolve(REPO_ROOT, "src/pluginApi.ts")');
  });

  it("validates the declaration emitted into the staging build", () => {
    expect(source).toContain('resolve(packageRoot, ".tmp/build/index.d.ts")');
    expect(source).not.toContain('resolve(packageRoot, "dist/index.d.ts")');
  });
});
