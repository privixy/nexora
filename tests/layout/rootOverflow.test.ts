import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("root layout overflow", () => {
  it("locks document-level scrolling so app pages own their scroll areas", () => {
    const css = readFileSync("src/index.css", "utf8");
    const html = readFileSync("index.html", "utf8");

    expect(css).toContain("html,\nbody,\n#root {");
    expect(css).toContain("height: 100%;");
    expect(css).toContain("overflow: hidden;");
    expect(html).toContain("height: 100%;");
    expect(html).toContain("overflow: hidden;");
  });
});
