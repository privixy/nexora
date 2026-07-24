import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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

function filesRecursively(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => filesRecursively(resolve(path, entry.name)));
}

const buildInputs = ["package.json", "tsup.config.ts", "src"].flatMap((path) => filesRecursively(resolve(root, path)));
const templateInputs = filesRecursively(resolve(root, "templates"));
const newestBuildInput = Math.max(...buildInputs.map((path) => statSync(path).mtimeMs));
if (statSync(buildCli).mtimeMs < newestBuildInput) throw new Error(`Build output is stale: ${relative(root, buildCli)}`);
const stagedTemplates = resolve(root, ".tmp/templates");
if (!existsSync(stagedTemplates)) throw new Error(`Build output is stale: ${relative(root, stagedTemplates)}`);
for (const input of templateInputs) {
  const staged = resolve(stagedTemplates, relative(resolve(root, "templates"), input));
  if (!existsSync(staged) || statSync(staged).mtimeMs < statSync(input).mtimeMs) {
    throw new Error(`Build output is stale for template input: ${relative(root, input)}`);
  }
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
