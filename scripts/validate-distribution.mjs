import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(root, path) { return readFileSync(resolve(root, path), "utf8"); }

export function validateDistribution(options = {}) {
  const root = options.root ?? process.cwd();
  const version = options.version ?? "1.2.3";
  const deb = options.debName ?? `Nexora_${version}_amd64.deb`;
  const windows = options.windowsName ?? `Nexora_${version}_x64-setup.exe`;
  const errors = [];
  const warnings = [];
  const snap = read(root, "snap/snapcraft.yaml");
  const snapWorkflow = read(root, ".github/workflows/snap.yml");
  const aur = read(root, "aur/PKGBUILD");
  const aurWorkflow = read(root, ".github/workflows/aur.yml");
  const winget = read(root, ".github/workflows/winget.yml");
  if (!snap.includes("source: nexora.deb") || !snapWorkflow.includes("-o snap/nexora.deb") || !snapWorkflow.includes("path: snap")) errors.push("Snap source filename/path mismatch");
  if (!/^name: nexora$/m.test(snap)) errors.push("Unexpected Snap package name");
  if (!/^pkgname=nexora-bin$/m.test(aur)) errors.push("Unexpected AUR package name");
  if (!/license=\('Apache-2.0'\)/.test(aur)) errors.push("AUR license must be Apache-2.0");
  if (!aur.includes("https://github.com/") || !aur.includes("Nexora_${pkgver}_amd64.deb")) errors.push("AUR source must reference the versioned release DEB URL");
  if (!aurWorkflow.includes("Nexora_${{ steps.version.outputs.version }}_amd64.deb")) errors.push("AUR workflow release asset casing mismatch");
  if (!winget.includes("identifier: Nexora.Nexora")) errors.push("Unexpected WinGet identifier");
  if (!winget.includes("release-tag") || !winget.includes("release-tag: ${{ inputs.release-tag }}")) errors.push("WinGet manual release tag is required");
  if (!/_x64-setup\\\.exe\$/.test(winget) || !/_x64-setup\.exe$/.test(windows)) errors.push("WinGet installer regex does not match release asset");
  if (!/^Nexora_\d+\.\d+\.\d+_amd64\.deb$/.test(deb)) errors.push("Invalid DEB release asset name");
  for (const workflow of [snapWorkflow, aurWorkflow, winget]) if (!workflow.includes("ENABLE_STORE_PUBLISH == 'true'")) errors.push("Store workflow lacks publication guard");
  return { errors, warnings };
}

if (process.argv[1]?.endsWith("validate-distribution.mjs")) {
  const value = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
  const result = validateDistribution({ version: value("--version"), debName: value("--deb-name"), windowsName: value("--windows-name") });
  if (result.errors.length) { for (const error of result.errors) console.error(error); process.exitCode = 1; }
  else console.log("Distribution metadata and workflows are consistent");
}
