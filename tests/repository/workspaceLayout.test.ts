import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

describe("current workspace layout", () => {
  it("keeps the desktop application at the documented current paths", () => {
    expect(existsSync(resolve(root, "src/main.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "tests/setup.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src-tauri/Cargo.toml"))).toBe(true);
    expect(existsSync(resolve(root, "vite.config.ts"))).toBe(true);
  });
});
