import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("root layout overflow", () => {
  it("locks document-level scrolling so app pages own their scroll areas", () => {
    const css = readFileSync(resolve(desktopRoot, "src/app/index.css"), "utf8");
    const html = readFileSync(resolve(desktopRoot, "index.html"), "utf8");

    expect(css).toContain("html,\nbody,\n#root {");
    expect(css).toContain("height: 100%;");
    expect(css).toContain("overflow: hidden;");
    expect(html).toContain("height: 100%;");
    expect(html).toContain("overflow: hidden;");
  });
});
