import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "apps/desktop/src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(entry.name)
        ? [path]
        : [];
  });
}

describe("domain contract ownership", () => {
  it("keeps feature public entry points contract-only", () => {
    const featureNames = [
      "settings",
      "plugins",
      "schema",
      "connections",
      "editor",
      "notebooks",
      "visual-explain",
      "ai",
      "tasks",
      "data-grid",
      "explorer",
      "mcp",
    ];

    for (const featureName of featureNames) {
      const indexPath = join(sourceRoot, "features", featureName, "index.ts");
      const source = readFileSync(indexPath, "utf8");
      expect(source, relative(sourceRoot, indexPath)).not.toMatch(/export\s+\*/);
      expect(source, relative(sourceRoot, indexPath)).not.toMatch(/export\s*\{(?!\s*type\b)/);
    }
  });

  it("does not import types from React contexts or components", () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles(sourceRoot)) {
      const source = readFileSync(filePath, "utf8");
      for (const match of source.matchAll(/import\s+type[\s\S]*?from\s+["']([^"']+)["']/g)) {
        const importTarget = match[1];
        if (importTarget.includes("/components/") || /contexts\/(Database|Editor|Settings)Context$/.test(importTarget)) {
          violations.push(`${relative(sourceRoot, filePath)} -> ${importTarget}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("has one canonical connection parameter contract", () => {
    const definitions = sourceFiles(sourceRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /interface\s+ConnectionParams\b/.test(source)
        ? [relative(sourceRoot, filePath)]
        : [];
    });

    expect(definitions).toEqual(["features/connections/contracts.ts"]);
  });
});
