import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

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
});
