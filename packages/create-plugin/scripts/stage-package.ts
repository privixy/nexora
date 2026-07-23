import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
const build = resolve(root, ".tmp/build");
const staging = resolve(root, ".tmp/staging");
const output = resolve(root, ".tmp/package");
const name = `nexora-create-plugin-${pkg.version}.tgz`;
const buildCli = resolve(build, "cli.js");
if (!existsSync(buildCli)) throw new Error("Fresh .tmp/build/cli.js is required before staging");
const inputs = ["package.json", "README.md", "LICENSE", "tsup.config.ts", "src/cli.ts", "src/print.ts", "src/scaffold.ts", "src/substitute.ts", "src/validate.ts", "templates/rust-driver/manifest.json.tmpl", "templates/ui-extension/package.json.tmpl"]
  .map((path) => resolve(root, path));
const newestInput = Math.max(...inputs.map((path) => statSync(path).mtimeMs));
for (const path of [buildCli, resolve(root, ".tmp/templates")]) {
  if (!existsSync(path) || statSync(path).mtimeMs < newestInput) throw new Error(`Build output is stale: ${relative(root, path)}`);
}
rmSync(output, { recursive: true, force: true });
rmSync(staging, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
mkdirSync(resolve(staging, "dist"), { recursive: true });
cpSync(build, resolve(staging, "dist"), { recursive: true });
cpSync(resolve(root, ".tmp/templates"), resolve(staging, "templates"), { recursive: true });
for (const path of ["README.md", "LICENSE"]) cpSync(resolve(root, path), resolve(staging, path), { recursive: true });
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as Record<string, unknown>;
delete packageJson.scripts;
delete packageJson.devDependencies;
writeFileSync(resolve(staging, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
const packed = execFileSync("pnpm", ["pack", "--pack-destination", output], { cwd: staging, encoding: "utf8", env: { ...process.env, npm_config_ignore_scripts: "true" } }).trim();
const packedPath = resolve(output, basename(packed));
const target = resolve(output, name);
if (packedPath !== target) renameSync(packedPath, target);
const digest = createHash("sha256").update(readFileSync(target)).digest("hex");
writeFileSync(`${target}.sha256`, `${digest}  ${name}\n`);
rmSync(staging, { recursive: true, force: true });
