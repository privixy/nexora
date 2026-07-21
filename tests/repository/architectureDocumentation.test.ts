import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const architecturePath = resolve(root, "docs/architecture/repository-structure.md");
const agentsPath = resolve(root, "AGENTS.md");

describe("living architecture documentation", () => {
  it("provides a canonical architecture reference linked by AGENTS.md", () => {
    expect(existsSync(architecturePath)).toBe(true);
    const architecture = readFileSync(architecturePath, "utf8");
    const agents = readFileSync(agentsPath, "utf8");
    expect(architecture).toContain("## Current enforced state");
    expect(architecture).toContain("## Target state");
    expect(architecture).toContain("## Temporary compatibility exceptions");
    expect(agents).toContain("docs/architecture/repository-structure.md");
    expect(architecture).not.toContain("Existing deep imports");
    for (const path of [
      "apps/desktop/src",
      "apps/desktop/tests",
      "apps/desktop/src-tauri",
    ]) {
      expect(architecture).toContain(path);
      expect(agents).toContain(path);
    }
  });

  it("documents complete temporary exception ownership", () => {
    const architecture = readFileSync(architecturePath, "utf8");
    const section = architecture.split("## Temporary compatibility exceptions")[1]?.split("## Required verification")[0] ?? "";
    const rows = section.split("\n").filter((line) => line.startsWith("| ")).slice(1);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
      expect(cells).toHaveLength(4);
      expect(cells.every((cell) => cell.length > 0)).toBe(true);
    }
  });
});
