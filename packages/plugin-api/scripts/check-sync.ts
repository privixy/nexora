import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  comparePublicContracts,
  extractPublicContract,
  formatSyncFailure,
  type ContractBaseline,
} from "./public-contract";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { version: string };
const baseline = JSON.parse(readFileSync(resolve(packageRoot, "contracts/public-contract-baseline.json"), "utf8")) as ContractBaseline & {
  pluginPackageVersion: string;
  pluginApiVersion: string;
  hostApiVersion: string;
};
const host = extractPublicContract(
  resolve(repositoryRoot, "apps/desktop/src/features/plugins/lib/pluginApi.ts"),
  resolve(repositoryRoot, "apps/desktop/src/features/plugins/state/PluginSlotProvider.tsx"),
);
const pkg = extractPublicContract(resolve(packageRoot, "src/index.ts"), resolve(packageRoot, "src/version.ts"));
const comparison = comparePublicContracts(host, pkg, baseline);
if (packageJson.version !== baseline.pluginPackageVersion) {
  comparison.versionMismatches.push(`pluginPackageVersion=${packageJson.version} expected=${baseline.pluginPackageVersion}`);
}
if (pkg.version !== baseline.pluginApiVersion) {
  comparison.versionMismatches.push(`pluginApiVersion=${pkg.version ?? "missing"} expected=${baseline.pluginApiVersion}`);
}
if (host.version !== baseline.hostApiVersion) {
  comparison.versionMismatches.push(`hostApiVersion=${host.version ?? "missing"} expected=${baseline.hostApiVersion}`);
}
const failed = comparison.newDrift.length > 0 || comparison.changedDrift.length > 0 || comparison.resolvedDrift.length > 0 || comparison.staleAllowlistEntries.length > 0 || comparison.versionMismatches.length > 0;
if (failed) {
  console.error(formatSyncFailure(comparison));
  process.exit(1);
}
console.log("[plugin-api check:sync] normalized host and package contracts match the reasoned baseline");
