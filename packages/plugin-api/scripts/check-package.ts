import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
  version: string;
  engines?: Record<string, string>;
  exports: Record<string, unknown>;
  publishConfig: Record<string, string>;
};
const name = `nexora-plugin-api-${packageJson.version}.tgz`;
const tarball = resolve(packageRoot, ".tmp/package", name);
const checksum = `${tarball}.sha256`;
if (!existsSync(tarball) || !existsSync(checksum)) throw new Error("Canonical plugin-api tarball and checksum are required");
const expected = readFileSync(checksum, "utf8").trim().split(/\s+/)[0];
const before = createHash("sha256").update(readFileSync(tarball)).digest("hex");
if (before !== expected) throw new Error("Plugin API tarball checksum mismatch");
const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).trim().split("\n");
for (const required of ["package/package.json", "package/dist/index.js", "package/dist/index.d.ts", "package/README.md", "package/LICENSE"]) {
  if (!entries.includes(required)) throw new Error(`Missing packed file: ${required}`);
}
if (entries.some((entry) => entry.includes("src/") || entry.includes("tests/") || entry.includes("scripts/"))) {
  throw new Error("Plugin API tarball contains private source or tooling");
}
const unpack = mkdtempSync(join(tmpdir(), "plugin-api-pack-"));
try {
  execFileSync("tar", ["-xzf", tarball, "-C", unpack]);
  const packed = JSON.parse(readFileSync(resolve(unpack, "package/package.json"), "utf8")) as Record<string, unknown>;
  if (JSON.stringify(packed.exports) !== JSON.stringify(packageJson.exports)) throw new Error("Packed exports metadata changed");
  if (JSON.stringify(packed.publishConfig) !== JSON.stringify(packageJson.publishConfig)) throw new Error("Packed access metadata changed");
  if (JSON.stringify(packed.engines) !== JSON.stringify(packageJson.engines)) throw new Error("Packed engines metadata changed");
  if ("private" in packed || "scripts" in packed || "devDependencies" in packed) throw new Error("Packed metadata contains private fields");
} finally {
  rmSync(unpack, { recursive: true, force: true });
}
const after = createHash("sha256").update(readFileSync(tarball)).digest("hex");
if (after !== expected) throw new Error("Plugin API tarball changed during inspection");
