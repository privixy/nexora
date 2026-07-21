import { spawnSync } from "node:child_process";

const packageManager = process.env.npm_execpath;
if (!packageManager) {
  throw new Error("npm_execpath is required to run desktop tests");
}

const desktopPrefix = "apps/desktop/";
const args = process.argv.slice(2).map((arg) =>
  arg.startsWith(desktopPrefix) ? arg.slice(desktopPrefix.length) : arg,
);
const result = spawnSync(
  process.execPath,
  [packageManager, "exec", "vitest", "--config", "vitest.config.ts", ...args],
  { stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
