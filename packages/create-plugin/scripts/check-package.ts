import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  version: string;
  bin: Record<string, string>;
  engines: Record<string, string>;
  publishConfig: Record<string, string>;
};
const name = `nexora-create-plugin-${packageJson.version}.tgz`;
const tarball = resolve(root, ".tmp/package", name);
const checksum = `${tarball}.sha256`;
const digest = () => createHash("sha256").update(readFileSync(tarball)).digest("hex");
const unpack = mkdtempSync(join(tmpdir(), "create-plugin-pack-"));

if (!existsSync(tarball) || !existsSync(checksum)) throw new Error("Canonical create-plugin tarball and checksum are required");
const expected = readFileSync(checksum, "utf8").trim().split(/\s+/)[0];
if (digest() !== expected) throw new Error("Create-plugin tarball checksum mismatch");

try {
  execFileSync("tar", ["-xzf", tarball, "-C", unpack]);
  const packageRoot = resolve(unpack, "package");
  const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).trim().split("\n");
  const required = [
    "package/package.json", "package/dist/cli.js", "package/README.md", "package/LICENSE",
    "package/templates/rust-driver/Cargo.toml.tmpl", "package/templates/rust-driver/manifest.json.tmpl",
    "package/templates/rust-driver/src/main.rs", "package/templates/rust-driver/src/handlers/crud.rs",
    "package/templates/rust-driver/src/handlers/ddl.rs", "package/templates/rust-driver/src/handlers/metadata.rs",
    "package/templates/rust-driver/src/handlers/query.rs", "package/templates/ui-extension/package.json.tmpl",
    "package/templates/ui-extension/vite.config.ts.tmpl", "package/templates/ui-extension/tsconfig.json",
    "package/templates/ui-extension/src/index.tsx.tmpl",
  ];
  for (const path of required) if (!entries.includes(path)) throw new Error(`Missing packed file: ${path}`);
  if (entries.some((entry) => /(?:^|\/)(?:src\/[^/]+\.ts|tests|scripts|\.tmp|node_modules)(?:\/|$)/.test(entry))) {
    throw new Error("Create-plugin tarball contains private source or tooling");
  }
  const packedPackage = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as Record<string, unknown>;
  if (JSON.stringify(packedPackage.bin) !== JSON.stringify(packageJson.bin)) throw new Error("Packed bin metadata changed");
  if (JSON.stringify(packedPackage.engines) !== JSON.stringify(packageJson.engines)) throw new Error("Packed engines metadata changed");
  if (JSON.stringify(packedPackage.publishConfig) !== JSON.stringify(packageJson.publishConfig)) throw new Error("Packed access metadata changed");
  if ("private" in packedPackage || "scripts" in packedPackage || "devDependencies" in packedPackage) throw new Error("Packed metadata contains private fields");
  const cli = resolve(packageRoot, "dist/cli.js");
  if (!readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node\n")) throw new Error("Packed CLI shebang is missing");
  const target = resolve(unpack, "scaffolded");
  execFileSync(process.execPath, [cli, "packed-driver", "--db-type=network", "--with-ui", "--no-git", `--dir=${target}`]);
  for (const path of ["Cargo.toml", "manifest.json", "src/main.rs", "src/handlers/query.rs", "ui/package.json", "ui/vite.config.ts", "ui/src/index.tsx"]) {
    const absolute = resolve(target, path);
    if (!existsSync(absolute) || statSync(absolute).size === 0) throw new Error(`Scaffolded packed template is incomplete: ${path}`);
  }
  const output = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  if (output !== "0.1.0\n") throw new Error("Packed CLI version contract changed");
} finally {
  rmSync(unpack, { recursive: true, force: true });
}
if (digest() !== expected) throw new Error("Create-plugin tarball changed during inspection");
