import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "node:url";

// File paths
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const paths = {
  package: resolve(REPO_ROOT, "package.json"),
  desktopPackage: resolve(REPO_ROOT, "apps/desktop/package.json"),
  tauri: resolve(REPO_ROOT, "apps/desktop/src-tauri/tauri.conf.json"),
  cargo: resolve(REPO_ROOT, "apps/desktop/src-tauri/Cargo.toml"),
  appVersion: resolve(REPO_ROOT, "apps/desktop/src/version.ts"),
  readme: resolve(REPO_ROOT, "README.md"),
};

// 1. Read the new version from package.json (already updated by npm version)
const pkg = JSON.parse(readFileSync(paths.package, "utf-8"));
const newVersion = pkg.version;

console.log(`🔄 Syncing version to ${newVersion}...`);

const desktopPackage = JSON.parse(readFileSync(paths.desktopPackage, "utf-8"));
desktopPackage.version = newVersion;
writeFileSync(paths.desktopPackage, `${JSON.stringify(desktopPackage, null, 2)}\n`);
console.log("✅ Updated apps/desktop/package.json");

// 2. Update tauri.conf.json
const tauriConf = JSON.parse(readFileSync(paths.tauri, "utf-8"));
tauriConf.version = newVersion;
// Also update the version in the package node if present
if (tauriConf.package) tauriConf.package.version = newVersion;
writeFileSync(paths.tauri, JSON.stringify(tauriConf, null, 2));
console.log("✅ Updated tauri.conf.json");

// 3. Update Cargo.toml
let cargo = readFileSync(paths.cargo, "utf-8");
// Use a regex to replace only the version in the [package] block
cargo = cargo.replace(/^version = ".*"/m, `version = "${newVersion}"`);
writeFileSync(paths.cargo, cargo);
console.log("✅ Updated Cargo.toml");

// 4. Update src/version.ts
const versionContent = `export const APP_VERSION = "${newVersion}";\n`;
writeFileSync(paths.appVersion, versionContent);
console.log("✅ Updated src/version.ts");

let readme = readFileSync(paths.readme, "utf-8");

// Update download links in README
readme = readme.replace(
  /releases\/download\/v.*?\//g,
  `releases/download/v${newVersion}/`,
);

readme = readme.replace(
  /nexora_\d+\.\d+\.\d+_/g,
  `nexora_${newVersion}_`,
);

writeFileSync(paths.readme, readme);
console.log("✅ Updated README.md");
