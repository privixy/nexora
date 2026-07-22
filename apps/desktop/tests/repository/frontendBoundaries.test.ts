import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { collectViolations } from "../../../../scripts/check-architecture.mjs";

function violations(imports: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "nexora-frontend-boundaries-"));
  const trackedFiles = ["package.json"];
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "nexora" }));

  for (const [file, importTarget] of Object.entries(imports)) {
    const filePath = join(root, file);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `import ${JSON.stringify(importTarget)};\n`);
    trackedFiles.push(file);
  }

  try {
    return collectViolations(root, {
      sourceRoots: ["apps/desktop/src"],
      frontendTestRoots: [],
      forbiddenFrontendTestRoots: [],
      repositoryTestRoots: [],
      rootTestRoots: [],
      allowedWorkspaceDependencies: { nexora: [] },
      fileSizeBaselines: {},
      frontendBoundaries: {
        sourceRoot: "apps/desktop/src",
        temporaryExceptions: [],
        directTauriExceptions: [],
      },
    }, { trackedFiles, workspacePackageDirectories: ["."] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("frontend boundaries", () => {
  it("allows public feature roots and neutral roots", () => {
    expect(violations({
      "apps/desktop/src/app/routes.tsx": "@/features/editor",
      "apps/desktop/src/features/editor/index.ts": "@/shared/ui",
      "apps/desktop/src/features/settings/index.ts": "@/platform/tauri",
    })).toEqual([]);
  });

  it("rejects reverse composition and feature cycles", () => {
    expect(violations({
      "apps/desktop/src/features/settings/index.ts": "@/features/plugins",
      "apps/desktop/src/features/plugins/index.ts": "@/features/settings",
    })).toEqual(expect.arrayContaining([expect.stringContaining("feature dependency cycle")]));
    expect(violations({
      "apps/desktop/src/features/schema/index.ts": "@/features/editor",
      "apps/desktop/src/features/editor/index.ts": "@/features/schema",
    })).toEqual(expect.arrayContaining([expect.stringContaining("feature dependency cycle")]));
  });
});
