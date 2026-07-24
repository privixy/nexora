import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncVersion } from "./version-sync.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const versionIndex = args.indexOf("--version");
const version = versionIndex >= 0 ? args[versionIndex + 1] : undefined;

try {
  await syncVersion({ root, check, version });
  console.log(check ? "Version mirrors are synchronized" : `Version synchronized to ${version ?? "package.json"}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
