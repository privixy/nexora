import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "apps/desktop/src/features/editor/pages/EditorPage.tsx"),
  "utf8",
);

describe("editor notebook boundary", () => {
  it("keeps notebook runtime composition outside the editor feature", () => {
    expect(source).not.toMatch(/from ["'][^"']*features\/notebooks/);
    expect(source).not.toMatch(/from ["']\.\.\/\.\.\/notebooks["']/);
  });
});
