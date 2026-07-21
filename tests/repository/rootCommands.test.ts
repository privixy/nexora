import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
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
});
