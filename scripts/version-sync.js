import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const paths = [
  "package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/Cargo.lock",
  "apps/desktop/src/app/config/version.ts",
  "README.md",
];

export function updateCargoToml(source, version) {
  const packageBlock = /\[package\][\s\S]*?(?=\n\[|$)/;
  const match = source.match(packageBlock);
  if (!match || !/^version = "[^"]+"$/m.test(match[0])) throw new Error("Unable to locate root Cargo package version");
  return source.replace(packageBlock, match[0].replace(/^version = "[^"]+"$/m, `version = "${version}"`));
}

export function updateCargoLock(source, version) {
  const blocks = source.split(/(?=\[\[package\]\])/);
  let updated = false;
  const result = blocks.map((block) => {
    if (!/^name = "nexora"$/m.test(block)) return block;
    if (updated) throw new Error("Cargo.lock contains multiple nexora packages");
    updated = true;
    return block.replace(/^version = "[^"]+"$/m, `version = "${version}"`);
  }).join("");
  if (!updated) throw new Error("Unable to locate nexora package in Cargo.lock");
  return result;
}

function semver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid version: ${version}`);
}

export async function syncVersion(options) {
  const originals = new Map(paths.map((path) => [path, readFileSync(join(options.root, path), "utf8")]));
  const rootPackage = JSON.parse(originals.get("package.json"));
  const version = options.version ?? rootPackage.version;
  semver(version);
  const desktopPackage = JSON.parse(originals.get("apps/desktop/package.json"));
  const tauri = JSON.parse(originals.get("apps/desktop/src-tauri/tauri.conf.json"));
  const outputs = new Map(originals);
  rootPackage.version = version;
  desktopPackage.version = version;
  tauri.version = version;
  if (tauri.package) tauri.package.version = version;
  const replaceJsonVersion = (source) => source.replace(/("version"\s*:\s*")[^"]+("\s*[,}])/, `$1${version}$2`);
  outputs.set("package.json", replaceJsonVersion(originals.get("package.json")));
  outputs.set("apps/desktop/package.json", replaceJsonVersion(originals.get("apps/desktop/package.json")));
  outputs.set("apps/desktop/src-tauri/tauri.conf.json", replaceJsonVersion(originals.get("apps/desktop/src-tauri/tauri.conf.json")));
  outputs.set("apps/desktop/src-tauri/Cargo.toml", updateCargoToml(originals.get("apps/desktop/src-tauri/Cargo.toml"), version));
  outputs.set("apps/desktop/src-tauri/Cargo.lock", updateCargoLock(originals.get("apps/desktop/src-tauri/Cargo.lock"), version));
  outputs.set("apps/desktop/src/app/config/version.ts", `export const APP_VERSION = "${version}";\n`);
  outputs.set("README.md", originals.get("README.md").replace(/releases\/download\/v\d+\.\d+\.\d+\//g, `releases/download/v${version}/`).replace(/Nexora_\d+\.\d+\.\d+_/g, `Nexora_${version}_`));
  if (options.check) {
    const mismatches = [...outputs].filter(([path, content]) => originals.get(path) !== content).map(([path]) => path);
    if (mismatches.length > 0) throw new Error(`Version mismatch: ${mismatches.join(", ")}`);
    return;
  }
  const runner = options.runner ?? ((command, args) => { execFileSync(command, args, { cwd: options.root, stdio: "inherit" }); });
  try {
    for (const [path, content] of outputs) {
      const target = join(options.root, path);
      mkdirSync(dirname(target), { recursive: true });
      const temporary = `${target}.version-sync.tmp`;
      writeFileSync(temporary, content);
      renameSync(temporary, target);
    }
    runner("cargo", ["metadata", "--manifest-path", join(options.root, "apps/desktop/src-tauri/Cargo.toml"), "--offline", "--locked", "--no-deps", "--format-version", "1"]);
  } catch (error) {
    for (const [path, content] of originals) writeFileSync(join(options.root, path), content);
    for (const path of paths) rmSync(`${join(options.root, path)}.version-sync.tmp`, { force: true });
    throw error;
  }
}
