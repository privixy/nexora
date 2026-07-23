import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";

export async function registryPreflight(specifier, options = {}) {
  const match = /^(@?[^@]+(?:\/[^@]+)?)@([^@]+)$/.exec(specifier);
  if (!match) throw new Error(`Invalid package specifier: ${specifier}`);
  const [, packageName, version] = match;
  const root = mkdtempSync(join(tmpdir(), "nexora-npm-preflight-"));
  const userconfig = join(root, "npmrc");
  writeFileSync(userconfig, "registry=https://registry.npmjs.org/\n");
  const runner = options.runner ?? ((command, args, runOptions) => new Promise((resolve) => {
    execFile(command, args, runOptions, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
  }));
  const env = { ...process.env, npm_config_userconfig: userconfig, npm_config_registry: "https://registry.npmjs.org/" };
  for (const key of Object.keys(env)) if (/token|auth/i.test(key)) delete env[key];
  try {
    const result = await runner("pnpm", ["view", specifier, "name", "version", "--json", "--registry=https://registry.npmjs.org/"], { env, timeout: options.timeout ?? 15000 });
    if (!result.error) {
      const value = JSON.parse(result.stdout);
      if (value?.name === packageName && value?.version === version) return { status: "present", packageName, version };
      throw new Error("Registry response did not identify the exact package version");
    }
    let details;
    try { details = JSON.parse(result.stdout || result.stderr); } catch { throw result.error; }
    if (details?.error?.code === "E404" && details?.error?.summary?.includes(`'${specifier}'`) && details?.error?.summary?.includes("registry.npmjs.org")) {
      return { status: "absent", packageName, version };
    }
    throw result.error;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith("npm-registry-preflight.mjs")) {
  const index = process.argv.indexOf("--package");
  registryPreflight(process.argv[index + 1]).then((result) => {
    if (result.status === "present") throw new Error(`${result.packageName}@${result.version} already exists`);
    console.log(`${result.packageName}@${result.version} is absent from the public registry`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
