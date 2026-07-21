import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};
const desktopPackage = JSON.parse(
  readFileSync(resolve(root, "apps/desktop/package.json"), "utf8"),
) as {
  devDependencies?: Record<string, string>;
};

const required = [
  "test",
  "typecheck",
  "lint",
  "build",
  "test:rust",
  "build:plugin-api",
  "check:plugin-api",
  "build:create-plugin",
  "smoke:create-plugin",
  "check:architecture",
];

describe("root command contract", () => {
  it.each(required)("exposes %s from the repository root", (name) => {
    expect(pkg.scripts[name]).toBeTruthy();
  });

  it("exposes the pinned workflow lint launcher", () => {
    expect(pkg.scripts["lint:workflows"]).toBe("node scripts/run-actionlint.mjs");
  });

  it("delegates desktop commands to the desktop workspace", () => {
    expect(pkg.scripts.dev).toBe("pnpm --filter @nexora/desktop dev");
    expect(pkg.scripts.build).toBe("pnpm --filter @nexora/desktop build");
    expect(pkg.scripts.preview).toBe("pnpm --filter @nexora/desktop preview");
    expect(pkg.scripts.test).toBe("pnpm --filter @nexora/desktop test");
    expect(pkg.scripts.typecheck).toBe("pnpm --filter @nexora/desktop typecheck");
    expect(pkg.scripts["test:coverage"]).toBe(
      "pnpm --filter @nexora/desktop test:coverage",
    );
    expect(pkg.scripts.tauri).toBe("pnpm --filter @nexora/desktop tauri");
    expect(pkg.scripts["test:rust"]).toBe(
      "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml",
    );
  });

  it.each([
    ["desktop root paths", ["apps/desktop/tests/version.test.ts", "apps/desktop/tests/layout/rootOverflow.test.ts"]],
    ["desktop package-relative paths", ["tests/version.test.ts", "tests/layout/rootOverflow.test.ts"]],
    ["repository paths", ["tests/repository/workspaceLayout.test.ts"]],
  ])("runs %s through the delegated desktop command", (_, testPaths) => {
    const packageManager = process.env.npm_execpath;
    expect(packageManager).toBeTruthy();

    const result = spawnSync(
      process.execPath,
      [packageManager!, "test", ...testPaths, "--", "--run"],
      {
        cwd: root,
        env: process.env,
        stdio: "pipe",
      },
    );

    expect(result.status, result.stderr.toString()).toBe(0);
  });

  it("keeps lint and its runtime dependencies at the repository root", () => {
    expect(pkg.scripts.lint).toBe("eslint .");
    for (const dependency of [
      "@eslint/js",
      "eslint",
      "eslint-plugin-react-hooks",
      "eslint-plugin-react-refresh",
      "globals",
      "typescript-eslint",
    ]) {
      expect(pkg.devDependencies).toHaveProperty(dependency);
      expect(desktopPackage.devDependencies ?? {}).not.toHaveProperty(dependency);
    }
  });
});
