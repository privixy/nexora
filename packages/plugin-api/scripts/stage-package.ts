import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = resolve(packageRoot, ".tmp/build");
const stagingRoot = resolve(packageRoot, ".tmp/staging");
const outputRoot = resolve(packageRoot, ".tmp/package");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
  name: string;
  version: string;
};
const outputName = `nexora-plugin-api-${packageJson.version}.tgz`;
const outputPath = resolve(outputRoot, outputName);

const buildFiles = [resolve(buildRoot, "index.js"), resolve(buildRoot, "index.d.ts")];
if (buildFiles.some((path) => !existsSync(path))) {
  throw new Error("Fresh .tmp/build/index.js and .tmp/build/index.d.ts are required before staging");
}
const inputs = ["package.json", "README.md", "LICENSE", "tsup.config.ts", "src/index.ts", "src/types.ts", "src/slots.ts", "src/hooks.ts", "src/host.ts", "src/version.ts"]
  .map((path) => resolve(packageRoot, path));
const newestInput = Math.max(...inputs.map((path) => statSync(path).mtimeMs));
for (const path of buildFiles) {
  if (statSync(path).mtimeMs < newestInput) throw new Error(`Build output is stale: ${relative(packageRoot, path)}`);
}

rmSync(outputRoot, { recursive: true, force: true });
rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(resolve(stagingRoot, "dist"), { recursive: true });
mkdirSync(outputRoot, { recursive: true });
cpSync(buildRoot, resolve(stagingRoot, "dist"), { recursive: true });
for (const file of ["README.md", "LICENSE"]) cpSync(resolve(packageRoot, file), resolve(stagingRoot, file));
const stagedPackage = { ...packageJson, scripts: undefined, devDependencies: undefined };
writeFileSync(resolve(stagingRoot, "package.json"), `${JSON.stringify(stagedPackage, null, 2)}\n`);
const packed = execFileSync("pnpm", ["pack", "--pack-destination", outputRoot], {
  cwd: stagingRoot,
  encoding: "utf8",
  env: { ...process.env, npm_config_ignore_scripts: "true" },
}).trim();
const packedPath = resolve(outputRoot, basename(packed));
if (packedPath !== outputPath) renameSync(packedPath, outputPath);
const digest = createHash("sha256").update(readFileSync(outputPath)).digest("hex");
writeFileSync(`${outputPath}.sha256`, `${digest}  ${outputName}\n`);
rmSync(stagingRoot, { recursive: true, force: true });
