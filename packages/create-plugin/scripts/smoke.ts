import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, ".tmp/build/cli.js");
const args = new Set(process.argv.slice(2));
const skipCargo = args.has("--skip-cargo");
const keepTemp = args.has("--keep-temp");
const unknown = [...args].filter((arg) => arg !== "--skip-cargo" && arg !== "--keep-temp");
if (unknown.length > 0) throw new Error(`Unknown smoke option: ${unknown.join(", ")}`);

function run(command: string, commandArgs: string[], cwd: string): void {
  execFileSync(command, commandArgs, { cwd, stdio: "inherit" });
}

function requireFiles(target: string, paths: string[]): void {
  for (const path of paths) {
    const absolute = join(target, path);
    if (!existsSync(absolute) || statSync(absolute).size === 0) throw new Error(`missing or empty: ${absolute}`);
  }
}

function validateUi(target: string): void {
  requireFiles(target, ["ui/package.json", "ui/vite.config.ts", "ui/tsconfig.json", "ui/src/index.tsx", "ui/README.md"]);
  const packageJson = JSON.parse(readFileSync(join(target, "ui/package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };
  if (packageJson.dependencies?.["@nexora/plugin-api"] !== "^0.1.0" || packageJson.scripts?.build !== "vite build") {
    throw new Error("UI static validation failed");
  }
  const vite = readFileSync(join(target, "ui/vite.config.ts"), "utf8");
  const source = readFileSync(join(target, "ui/src/index.tsx"), "utf8");
  if (!vite.includes('__nexora_plugin__') || !vite.includes('fileName: () => "index.js"') || !source.includes('defineSlot("data-grid.toolbar.actions"')) {
    throw new Error("UI static validation failed");
  }
}

function scaffold(smokeRoot: string, kind: "network" | "file" | "folder" | "api", withUi: boolean): string {
  const target = join(smokeRoot, `${kind}${withUi ? "-ui" : ""}`);
  run(process.execPath, [cli, `${kind}-driver`, `--db-type=${kind}`, "--no-git", `--dir=${target}`, ...(withUi ? ["--with-ui"] : [])], smokeRoot);
  requireFiles(target, ["Cargo.toml", "manifest.json", "src/main.rs", "justfile"]);
  if (withUi) validateUi(target);
  if (!skipCargo) run("mise", ["exec", "rust", "--", "cargo", "check", "--quiet"], target);
  console.log(`${kind}${withUi ? "+ui" : ""} validated`);
  return target;
}

function main(): void {
  if (!existsSync(cli)) throw new Error(`CLI not built at ${cli}`);
  const smokeRoot = mkdtempSync(join(tmpdir(), "create-plugin-smoke-"));
  console.log(`Temporary smoke root: ${smokeRoot}`);
  try {
    for (const kind of ["network", "file", "folder", "api"] as const) scaffold(smokeRoot, kind, false);
    const uiTarget = scaffold(smokeRoot, "network", true);
    console.log("UI static validation passed");
    if (!skipCargo) {
      const pluginApiTarball = resolve(root, "../plugin-api/.tmp/package/nexora-plugin-api-0.1.0.tgz");
      if (!existsSync(pluginApiTarball)) throw new Error(`Canonical plugin API tarball required for UI build: ${pluginApiTarball}`);
      const localTarball = join(uiTarget, "ui", "nexora-plugin-api.tgz");
      copyFileSync(pluginApiTarball, localTarball);
      const uiPackagePath = join(uiTarget, "ui", "package.json");
      const uiPackage = JSON.parse(readFileSync(uiPackagePath, "utf8")) as { dependencies: Record<string, string> };
      uiPackage.dependencies["@nexora/plugin-api"] = "file:./nexora-plugin-api.tgz";
      writeFileSync(uiPackagePath, `${JSON.stringify(uiPackage, null, 2)}\n`);
      run("pnpm", ["install", "--ignore-workspace", "--frozen-lockfile=false"], join(uiTarget, "ui"));
      run("pnpm", ["run", "build"], join(uiTarget, "ui"));
    }
    for (const kind of ["file", "folder", "api"] as const) {
      try {
        run(process.execPath, [cli, `${kind}-ui-driver`, `--db-type=${kind}`, "--with-ui", "--no-git", `--dir=${join(smokeRoot, `${kind}-ui-rejected`)}`], smokeRoot);
        throw new Error(`non-network UI was accepted for ${kind}`);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === undefined || status === 0) throw error;
      }
    }
    console.log("non-network UI rejection validated");
  } finally {
    if (!keepTemp) rmSync(smokeRoot, { recursive: true, force: true });
  }
}

main();
