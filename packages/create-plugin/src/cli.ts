import { readFileSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { printCreated, printError, printHelp } from "./print";
import { scaffold } from "./scaffold";
import { titleCase, validateDbType, validateName, validateQuote } from "./validate";

function findPackageVersion(from: string): string {
  let directory = dirname(from);
  while (directory !== parse(directory).root) {
    const packagePath = resolve(directory, "package.json");
    try {
      const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "@nexora/create-plugin" && pkg.version) return pkg.version;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }
  throw new Error("Unable to locate @nexora/create-plugin package.json");
}

const PACKAGE_VERSION = findPackageVersion(fileURLToPath(import.meta.url));
const PLUGIN_API_VERSION = "0.1.0";
const MIN_NEXORA_VERSION = "0.9.20";

function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "db-type": { type: "string" },
        quote: { type: "string" },
        "with-ui": { type: "boolean", default: false },
        "no-git": { type: "boolean", default: false },
        dir: { type: "string" },
        version: { type: "boolean", short: "v", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      strict: true,
    });
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    printHelp();
    return 1;
  }

  if (parsed.values.help) {
    printHelp();
    return 0;
  }
  if (parsed.values.version) {
    console.log(PACKAGE_VERSION);
    return 0;
  }

  const rawName = parsed.positionals[0];
  if (!rawName) {
    printError("missing <name> argument");
    printHelp();
    return 1;
  }

  const nameCheck = validateName(rawName);
  if (!nameCheck.ok) {
    printError(`invalid name: ${nameCheck.reason}`);
    if (nameCheck.slug) {
      printError(`(slugified to "${nameCheck.slug}", which still failed)`);
    }
    return 1;
  }

  let dbType, quote;
  try {
    dbType = validateDbType(parsed.values["db-type"] as string | undefined);
    quote = validateQuote(parsed.values.quote as string | undefined);
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (parsed.values["with-ui"] && dbType !== "network") {
    printError("--with-ui requires --db-type=network");
    return 1;
  }

  const slug = nameCheck.slug;
  const targetDir = resolve(
    (parsed.values.dir as string | undefined) ?? slug,
  );

  try {
    scaffold({
      slug,
      displayName: titleCase(slug),
      dbType,
      quote,
      withUi: Boolean(parsed.values["with-ui"]),
      targetDir,
      gitInit: !parsed.values["no-git"],
      pluginApiVersion: PLUGIN_API_VERSION,
      minNexoraVersion: MIN_NEXORA_VERSION,
    });
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    return 1;
  }

  printCreated(slug, targetDir, Boolean(parsed.values["with-ui"]));
  return 0;
}

const exitCode = main(process.argv.slice(2));
if (exitCode !== 0) process.exit(exitCode);
