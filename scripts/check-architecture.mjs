import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const POLICY_PATH = join(REPO_ROOT, "architecture", "policy.json");
const policy = existsSync(POLICY_PATH) ? JSON.parse(readFileSync(POLICY_PATH, "utf8")) : undefined;

function toPosixPath(filePath) {
  return filePath.split(sep).join("/");
}

function isUnderRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}/`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function collectTrackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z", "--cached"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map(toPosixPath)
    .sort();
}

function workspacePackageDirectories(root) {
  const workspacePath = join(root, "pnpm-workspace.yaml");
  const directories = ["."];

  if (!existsSync(workspacePath)) {
    return directories;
  }

  const content = readFileSync(workspacePath, "utf8");
  const packageSection = content.match(/^packages:\s*\n((?:^[ \t]+-\s+.+\n?)*)/m)?.[1] ?? "";
  for (const match of packageSection.matchAll(/^\s*-\s+["']?([^"'\s]+)["']?\s*$/gm)) {
    const pattern = match[1];
    if (pattern.endsWith("/*")) {
      const parent = pattern.slice(0, -2);
      const prefix = `${parent}/`;
      const packageDirectories = collectTrackedFiles(root)
        .filter((file) => file.startsWith(prefix) && file.endsWith("/package.json"))
        .map((file) => dirname(file));
      directories.push(...packageDirectories);
    } else if (!pattern.includes("*")) {
      directories.push(pattern);
    }
  }

  return [...new Set(directories)].sort();
}

function packageDependencyNames(packageJson) {
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const names = new Set();

  for (const section of sections) {
    const dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      continue;
    }

    for (const name of Object.keys(dependencies)) {
      names.add(name);
    }
  }

  return [...names].sort();
}

function collectPackageManifests(root, trackedFiles, packageDirectories) {
  return packageDirectories
    .map((directory) => directory === "." ? "package.json" : `${directory}/package.json`)
    .filter((file) => trackedFiles.has(file) && existsSync(join(root, file)))
    .map((file) => ({ file, json: readJson(join(root, file)) }))
    .filter(({ json }) => typeof json.name === "string");
}

function hasInlineRustTests(root, file) {
  const content = readFileSync(join(root, file), "utf8");
  const cfgTest = /#\s*\[\s*cfg\s*\(\s*(?:test\b|all\s*\([^)]*\btest\b[^)]*\))[^)]*\)\s*\]/g;
  for (const match of content.matchAll(cfgTest)) {
    const remainder = content.slice(match.index + match[0].length);
    const module = remainder.match(/^(?:\s*#\s*\[(?:[^\[\]]|\[[^\]]*\])*\])*\s*(?:pub(?:\s*\([^)]*\))?\s+)?mod\s+[A-Za-z_][A-Za-z0-9_]*\s*([;{])/);
    if (module?.[1] === "{") return true;
  }
  return false;
}

function isRustTestSource(file) {
  return file.split("/").includes("tests") || file.endsWith("/tests.rs");
}

function rustTestInclusionViolations(root, file) {
  if (!isRustTestSource(file)) return [];
  const source = readFileSync(join(root, file), "utf8");
  const violations = [];
  if (/\binclude\s*!\s*[({\[]/m.test(source)) {
    violations.push(`${file}: include! is forbidden in Rust test sources`);
  }
  for (const match of source.matchAll(/#\s*\[\s*path\s*=\s*(?:r#*)?"([^"]+)"#*\s*\]\s*(?:pub(?:\s*\([^)]*\))?\s+)?mod\s+[A-Za-z_][A-Za-z0-9_]*\s*;/gm)) {
    violations.push(`${file}: test-to-test #[path] module inclusion is forbidden: ${match[1]}`);
  }
  return violations;
}

function canStartRegex(tokens) {
  const previous = tokens.at(-1);
  return !previous
    || (previous.type === "punctuation" && "([{=,:;!?&|+-*%^~<>".includes(previous.value))
    || (previous.type === "identifier" && ["case", "delete", "return", "throw", "typeof", "void", "yield"].includes(previous.value));
}

function sourceTokens(content) {
  const tokens = [];
  let index = 0;

  while (index < content.length) {
    const character = content[index];
    const next = content[index + 1];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") {
      index = content.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (character === "/" && next === "*") {
      index = content.indexOf("*/", index + 2);
      if (index === -1) break;
      index += 2;
      continue;
    }
    if (character === "/" && canStartRegex(tokens)) {
      let inCharacterClass = false;
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\" && index + 1 < content.length) {
          index += 2;
        } else if (content[index] === "[") {
          inCharacterClass = true;
          index += 1;
        } else if (content[index] === "]") {
          inCharacterClass = false;
          index += 1;
        } else if (content[index] === "/" && !inCharacterClass) {
          index += 1;
          while (index < content.length && /[A-Za-z]/.test(content[index])) index += 1;
          break;
        } else {
          index += 1;
        }
      }
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      let value = "";
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\" && index + 1 < content.length) {
          value += content[index + 1];
          index += 2;
        } else if (content[index] === quote) {
          index += 1;
          break;
        } else {
          value += content[index];
          index += 1;
        }
      }
      tokens.push({ type: "string", value });
      continue;
    }
    if (character === "`") {
      let value = "";
      let interpolated = false;
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\" && index + 1 < content.length) {
          value += content[index + 1];
          index += 2;
        } else if (content[index] === "$" && content[index + 1] === "{") {
          interpolated = true;
          index += 2;
        } else if (content[index] === "`") {
          index += 1;
          break;
        } else {
          value += content[index];
          index += 1;
        }
      }
      tokens.push({ type: interpolated ? "template-interpolated" : "string", value });
      continue;
    }
    if (/[A-Za-z_$]/.test(character)) {
      let value = character;
      index += 1;
      while (index < content.length && /[A-Za-z0-9_$]/.test(content[index])) {
        value += content[index];
        index += 1;
      }
      tokens.push({ type: "identifier", value });
      continue;
    }
    tokens.push({ type: "punctuation", value: character });
    index += 1;
  }

  return tokens;
}

function importSpecifiers(content) {
  const tokens = sourceTokens(content);
  const specifiers = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "identifier" || (token.value !== "import" && token.value !== "export")) {
      continue;
    }
    if (token.value === "import" && tokens[index + 1]?.value === "(") {
      if (tokens[index + 2]?.type === "string" && tokens[index + 3]?.value === ")") {
        specifiers.push(tokens[index + 2].value);
      } else {
        specifiers.push(undefined);
      }
      continue;
    }
    if (token.value === "import" && tokens[index + 1]?.type === "string") {
      specifiers.push(tokens[index + 1].value);
      continue;
    }
    for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].value !== ";"; cursor += 1) {
      if (tokens[cursor].value === "from" && tokens[cursor + 1]?.type === "string") {
        specifiers.push(tokens[cursor + 1].value);
        break;
      }
    }
  }

  return specifiers;
}

function resolveSourceImport(importer, specifier, sourceRoot) {
  if (specifier === "@") return sourceRoot;
  if (specifier.startsWith("@/")) return `${sourceRoot}/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return undefined;
  return toPosixPath(relative(".", join(dirname(importer), specifier)));
}

function featureName(file, sourceRoot) {
  const match = file.match(new RegExp(`^${sourceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/features/([^/]+)(?:/|$)`));
  return match?.[1];
}

function featureLayer(file, sourceRoot) {
  const feature = featureName(file, sourceRoot);
  if (feature !== "plugins") return feature;
  if (
    isUnderRoot(file, `${sourceRoot}/features/plugins/components`)
    || file === `${sourceRoot}/features/plugins/hooks/usePluginApi.ts`
  ) {
    return "plugins-ui";
  }
  return "plugins-core";
}

function isFeaturePublicRoot(resolved, importedFeature, sourceRoot) {
  if (!resolved || !importedFeature) return false;
  const normalized = resolved.replace(/\.(?:ts|tsx)$/, "");
  const featureRoot = `${sourceRoot}/features/${importedFeature}`;
  return normalized === featureRoot || normalized === `${featureRoot}/index`;
}

function exceptionMatches(exception, file, importTarget) {
  const importer = exception?.importer ?? exception?.path;
  return importer === file
    && exception?.importTarget === importTarget
    && typeof exception?.owner === "string"
    && Number.isInteger(exception?.removeByTask);
}

function isExactRepositoryPath(value, pattern) {
  return typeof value === "string"
    && value.length > 0
    && !value.includes("*")
    && !value.includes("\\")
    && pattern.test(value);
}

function collectFrontendBoundaryViolations(root, trackedFiles, boundaries) {
  if (!boundaries) return [];
  const violations = [];
  const sourceRoot = boundaries.sourceRoot ?? "apps/desktop/src";
  const exceptions = boundaries.temporaryExceptions ?? [];
  const tauriExceptions = boundaries.directTauriExceptions ?? [];
  const sourceOwners = boundaries.sourceOwners ?? [];
  const plannedCharacterizationTests = boundaries.plannedCharacterizationTests ?? [];
  const tauriGatewayOwnership = boundaries.tauriGatewayOwnership ?? [];
  const featureEdges = new Map();
  const sourceOwnerSources = new Set();
  const sourceOwnerDestinations = new Set();

  for (const row of sourceOwners) {
    if (sourceOwnerSources.has(row?.source)) violations.push(`${row?.source}: duplicate frontend source-owner source row`);
    if (sourceOwnerDestinations.has(row?.destination)) violations.push(`${row?.destination}: duplicate frontend source-owner destination row`);
    sourceOwnerSources.add(row?.source);
    sourceOwnerDestinations.add(row?.destination);
  }

  for (const exception of [...exceptions, ...tauriExceptions]) {
    const isTauriException = tauriExceptions.includes(exception);
    const importer = isTauriException ? exception?.importer : exception?.path;
    if (
      !exception
      || !isExactRepositoryPath(importer, /^apps\/desktop\/src\/.+\.tsx?$/)
      || typeof exception.importTarget !== "string"
      || exception.importTarget.includes("*")
      || typeof exception.owner !== "string"
      || !Number.isInteger(exception.removeByTask)
      || (!isTauriException && typeof exception.reason !== "string")
    ) {
      violations.push(isTauriException
        ? "direct Tauri inventory rows require exact importer, importTarget, owner, characterizationTest, gatewayOrAdapter, and removeByTask fields"
        : "frontend boundary exceptions require exact path, importTarget, owner, reason, and removeByTask fields");
      continue;
    }
    if (!trackedFiles.has(importer) || !existsSync(join(root, importer))) {
      violations.push(`${importer}: frontend boundary exception points to a missing tracked importer`);
    }
    if (isTauriException) {
      const validCharacterizationPath = isExactRepositoryPath(exception.characterizationTest, /^apps\/desktop\/tests\/.+\.test\.tsx?$/);
      const characterizationExists = validCharacterizationPath
        && trackedFiles.has(exception.characterizationTest)
        && existsSync(join(root, exception.characterizationTest));
      const plannedCharacterization = validCharacterizationPath && plannedCharacterizationTests.some(({ importer: plannedImporter, owner, destination, task }) =>
        (plannedImporter === importer || owner === exception.owner)
          && destination === exception.characterizationTest
          && Number.isInteger(task)
          && task > 1
          && task <= 39,
      );
      if (!validCharacterizationPath) {
        violations.push(`${importer}: direct Tauri inventory characterizationTest must be a non-empty exact desktop test path`);
      } else if (!characterizationExists && !plannedCharacterization) {
        violations.push(`${importer}: direct Tauri inventory characterizationTest must reference an existing test or exact planned later task/destination`);
      }
      const validGatewayPath = isExactRepositoryPath(exception.gatewayOrAdapter, /^apps\/desktop\/src\/platform\/tauri\/.+\.ts$/);
      const gatewayOwned = validGatewayPath && tauriGatewayOwnership.some(({ owner, importTarget, destination, task }) =>
        (owner === undefined || owner === exception.owner)
          && (importTarget === undefined || importTarget === exception.importTarget)
          && destination === exception.gatewayOrAdapter
          && (task === 9 || task === 39),
      );
      if (!validGatewayPath || !gatewayOwned) {
        violations.push(`${importer}: direct Tauri inventory gatewayOrAdapter must be an exact owner/import target destination staged by Task 9 or 39`);
      }
      const sourceOwner = sourceOwners.find(({ source, destination }) => source === importer || destination === importer);
      if (sourceOwner && exception.owner !== sourceOwner.owner) {
        violations.push(`${importer}: direct Tauri exception owner must match final source owner ${sourceOwner.owner}`);
      }
      const isTask32ExplorerException = exception.removeByTask === 32
        && exception.owner === "explorer"
        && importer.startsWith(`${sourceRoot}/features/explorer/`);
      if (exception.removeByTask !== 39 && !isTask32ExplorerException) {
        violations.push(`${importer}: direct Tauri exception removeByTask must be 39 unless it is exact Task 32 Explorer debt`);
      }
    }
  }

  const sourceFiles = [...trackedFiles]
    .filter((file) => isUnderRoot(file, sourceRoot) && [".ts", ".tsx"].includes(extname(file)))
    .sort();
  const activeImports = new Set(sourceFiles.flatMap((file) =>
    importSpecifiers(readFileSync(join(root, file), "utf8"))
      .filter((importTarget) => importTarget !== undefined)
      .map((importTarget) => `${file}\0${importTarget}`),
  ));
  for (const exception of [...exceptions, ...tauriExceptions]) {
    const importer = tauriExceptions.includes(exception) ? exception.importer : exception.path;
    if (exceptionMatches(exception, importer, exception.importTarget) && !activeImports.has(`${importer}\0${exception.importTarget}`)) {
      violations.push(`${importer}: frontend boundary exception is unused: ${exception.importTarget}`);
    }
  }

  for (const file of sourceFiles) {
    const importerFeature = featureName(file, sourceRoot);
    const importerLayer = featureLayer(file, sourceRoot);
    if (importerLayer === "plugins-ui") {
      if (!featureEdges.has(importerLayer)) featureEdges.set(importerLayer, new Set());
      featureEdges.get(importerLayer).add("plugins-core");
    }
    const content = readFileSync(join(root, file), "utf8");
    for (const importTarget of importSpecifiers(content)) {
      if (importTarget === undefined) {
        violations.push(`${file}: dynamic import target must be static`);
        continue;
      }
      const resolved = resolveSourceImport(file, importTarget, sourceRoot);
      const importedFeature = resolved ? featureName(resolved, sourceRoot) : undefined;
      const importedLayer = resolved ? featureLayer(resolved, sourceRoot) : undefined;
      const importsFeaturePublicRoot = isFeaturePublicRoot(resolved, importedFeature, sourceRoot);
      const isExcepted = exceptions.some((exception) => exceptionMatches(exception, file, importTarget));
      const isTauri = importTarget.startsWith("@tauri-apps/");
      const isPlatform = isUnderRoot(file, `${sourceRoot}/platform`);
      const isShared = isUnderRoot(file, `${sourceRoot}/shared`);
      const isApp = isUnderRoot(file, `${sourceRoot}/app`);
      const importsApp = resolved && isUnderRoot(resolved, `${sourceRoot}/app`);

      if (isTauri && !isPlatform) {
        if (tauriExceptions.some((exception) => exceptionMatches(exception, file, importTarget))) {
          console.warn(`[architecture] frontend Tauri debt: ${file} -> ${importTarget}`);
        } else {
          violations.push(`${file}: direct Tauri import outside platform is forbidden: ${importTarget}`);
        }
      }
      if ((isPlatform || isShared) && importedFeature && !isExcepted) {
        violations.push(`${file}: ${isPlatform ? "platform" : "shared"} modules may not import features: ${importTarget}`);
      }
      if ((importerFeature || isPlatform || isShared) && importsApp && !isExcepted) {
        const importerLayer = importerFeature ? "features" : isPlatform ? "platform" : "shared";
        violations.push(`${file}: ${importerLayer} may not import app modules: ${importTarget}`);
      }
      if (isApp && importedFeature && !importsFeaturePublicRoot && !isExcepted) {
        violations.push(`${file}: app imports must use the public feature root: ${importTarget}`);
      }
      if (importerFeature && importedFeature && importerFeature !== importedFeature) {
        if (!importsFeaturePublicRoot && !isExcepted) {
          violations.push(`${file}: cross-feature imports must use the public feature root: ${importTarget}`);
        }
        if (!featureEdges.has(importerLayer)) featureEdges.set(importerLayer, new Set());
        featureEdges.get(importerLayer).add(importedLayer);
      }
      if (isExcepted) {
        console.warn(`[architecture] frontend boundary debt: ${file} -> ${importTarget}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(feature) {
    if (visiting.has(feature)) {
      const start = stack.indexOf(feature);
      violations.push(`feature dependency cycle: ${[...stack.slice(start), feature].join(" -> ")}`);
      return;
    }
    if (visited.has(feature)) return;
    visiting.add(feature);
    stack.push(feature);
    for (const dependency of featureEdges.get(feature) ?? []) visit(dependency);
    stack.pop();
    visiting.delete(feature);
    visited.add(feature);
  }
  for (const feature of [...featureEdges.keys()].sort()) visit(feature);
  return violations;
}

function rustDriverAliases(source) {
  const aliases = new Set(["drivers"]);
  for (const match of source.matchAll(/\buse\s+crate::drivers\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)) aliases.add(match[1]);
  for (const match of source.matchAll(/\buse\s+crate::drivers::\{[\s\S]*?\bself\s+as\s+([A-Za-z_][A-Za-z0-9_]*)[\s\S]*?};/g)) aliases.add(match[1]);
  return aliases;
}

function usesBuiltInRustDriver(source) {
  for (const alias of rustDriverAliases(source)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}::(?:mysql|postgres|sqlite)(?:::|\\b)`).test(source)) return true;
  }
  return /\bcrate::drivers::(?:mysql|postgres|sqlite)(?:::|\b)/.test(source);
}

function collectRustBackendViolations(root, trackedFiles, boundaries) {
  if (!boundaries) return [];
  const violations = [];
  const sourceRoot = boundaries.sourceRoot ?? "apps/desktop/src-tauri/src";
  const rustFiles = [...trackedFiles]
    .filter((file) => isUnderRoot(file, sourceRoot) && extname(file) === ".rs")
    .sort();
  const sources = new Map(rustFiles.map((file) => [file, readFileSync(join(root, file), "utf8")]));

  const domainWorkflowAdapters = `${sourceRoot}/domains/connections/workflow_support.rs`;
  const dependencyRules = [
    [`${sourceRoot}/commands`, [
      ["sqlx", /\bsqlx(?:::|\b)/],
      ["built-in drivers", usesBuiltInRustDriver],
      ["pool constructors", /\b(?:get|create)_(?:mysql|postgres|sqlite)_pool\b/],
    ]],
    [`${sourceRoot}/domains`, [
      ["tauri", /\btauri(?:::|\b)/],
      ["built-in drivers", usesBuiltInRustDriver],
      ["direct pools", /\b(?:get|create)_(?:mysql|postgres|sqlite)_pool\b/],
    ]],
    [`${sourceRoot}/drivers`, [
      ["commands or domains", /\bcrate::(?:commands|domains)(?:::|\b)/],
    ]],
    [`${sourceRoot}/infrastructure`, [
      ["commands", /\bcrate::commands(?:::|\b)/],
    ]],
  ];

  const commandsRoot = `${sourceRoot}/commands`;
  const approvedLegacyCommandOwners = new Set(Object.keys(boundaries.legacyTransferOwners ?? {}));
  for (const [ownerPath, metadata] of Object.entries(boundaries.legacyTransferOwners ?? {})) {
    if (!isExactRepositoryPath(ownerPath, /^apps\/desktop\/src-tauri\/src\/[^/]+\.rs$/)) {
      violations.push(`${ownerPath}: legacy transfer owner must be an exact Rust root source path`);
    }
    if (!sources.has(ownerPath)) violations.push(`${ownerPath}: legacy transfer owner points to a missing tracked file`);
    if (typeof metadata?.owner !== "string" || typeof metadata?.removeAfter !== "string") {
      violations.push(`${ownerPath}: legacy transfer owner requires owner and removeAfter metadata`);
    }
  }

  for (const [file, source] of sources) {
    if (file.split("/").includes("tests") || file.endsWith("/tests.rs")) continue;
    for (const [directory, forbidden] of dependencyRules) {
      if (!isUnderRoot(file, directory)) continue;
      for (const [label, pattern] of forbidden) {
        if (directory === `${sourceRoot}/domains` && label === "tauri" && isUnderRoot(file, domainWorkflowAdapters)) continue;
        if ((typeof pattern === "function" ? pattern(source) : pattern.test(source))) violations.push(`${file}: Rust ${directory.slice(sourceRoot.length + 1)} may not depend on ${label}`);
      }
    }
    if (source.includes("#[tauri::command]") && !isUnderRoot(file, commandsRoot) && !approvedLegacyCommandOwners.has(file)) {
      violations.push(`${file}: Tauri handlers must live under commands or an approved legacy root owner`);
    }
    if (isUnderRoot(file, commandsRoot) && source.includes("pub use crate::infrastructure::command_services::")) {
      violations.push(`${file}: command modules must own adapters directly instead of re-exporting infrastructure command services`);
    }
    if (file === `${sourceRoot}/infrastructure/connections/workflows/mod.rs`) {
      violations.push(`${file}: catch-all workflow modules are forbidden`);
    }
  }

  for (const facade of boundaries.pureCompatibilityFacades ?? []) {
    const source = sources.get(facade);
    if (source === undefined) {
      violations.push(`${facade}: compatibility facade points to a missing tracked file`);
      continue;
    }
    const substantive = source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && line !== "};" && !line.startsWith("//") && !line.startsWith("pub use ") && !/^[A-Za-z0-9_, ]+$/.test(line) && !line.startsWith("#[cfg(test)]") && !/^mod tests;$/.test(line));
    if (substantive.length > 0) violations.push(`${facade}: compatibility facade must contain re-exports only`);
  }

  for (const [ownerPath, metadata] of Object.entries(boundaries.frozenSqlOwners ?? {})) {
    const ownerSource = sources.get(ownerPath);
    if (ownerSource === undefined) {
      violations.push(`${ownerPath}: frozen SQL owner points to a missing tracked file`);
      continue;
    }
    if (typeof metadata.owner !== "string" || typeof metadata.removeAfter !== "string") {
      violations.push(`${ownerPath}: frozen SQL owner requires owner and removeAfter metadata`);
    }
    if (ownerSource.includes("#[tauri::command]")) {
      violations.push(`${ownerPath}: frozen SQL owner must not declare a Tauri command`);
    }
    if (/^\s*pub\s+(?:use|mod)\b/m.test(ownerSource)) {
      violations.push(`${ownerPath}: frozen SQL owner must remain crate-private and non-re-exporting`);
    }
    for (const pattern of metadata.patterns ?? []) {
      for (const [file, source] of sources) {
        if (file !== ownerPath && !file.split("/").includes("tests") && !file.endsWith("/tests.rs") && source.includes(pattern)) {
          violations.push(`${file}: frozen SQL pattern is owned by ${ownerPath}`);
        }
      }
    }
  }

  return violations;
}

function resolvesToForbiddenRoot(importer, specifier, forbiddenRoot, importAliases) {
  if (specifier === forbiddenRoot || specifier.startsWith(`${forbiddenRoot}/`)) {
    return true;
  }

  for (const [alias, target] of Object.entries(importAliases)) {
    if ((specifier === alias || specifier.startsWith(`${alias}/`)) && isUnderRoot(target, forbiddenRoot)) {
      return true;
    }
  }

  if (!specifier.startsWith(".")) {
    return false;
  }

  const importerDirectory = dirname(importer);
  const normalized = toPosixPath(relative(".", join(importerDirectory, specifier)));
  return isUnderRoot(normalized, forbiddenRoot);
}

export function countLines(content) {
  if (content.length === 0) {
    return 0;
  }

  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

export function collectViolations(root, policy, inventory = {}) {
  const violations = [];
  if (Object.hasOwn(policy, "rustLegacyTransferOwners")) {
    violations.push("rustLegacyTransferOwners is forbidden; define legacyTransferOwners only under rustBackendBoundaries");
  }
  const trackedFiles = new Set(inventory.trackedFiles ?? collectTrackedFiles(root));
  const sourceRoots = policy.sourceRoots ?? [];
  const files = [...trackedFiles]
    .filter((file) =>
      sourceRoots.some((sourceRoot) => isUnderRoot(file, sourceRoot))
      || policy.frontendTestRoots.some((testRoot) => isUnderRoot(file, testRoot))
      || isUnderRoot(file, "tests")
      || isUnderRoot(file, "apps/desktop/src-tauri/tests")
    )
    .sort();
  const frontendTestAllowlist = new Set(policy.frontendTestAllowlist ?? []);
  const rustInlineTestAllowlist = new Set(policy.rustInlineTestAllowlist ?? []);
  const rustTemplateInlineTestRoots = policy.rustTemplateInlineTestRoots ?? [];
  const rustTemplateInlineTestEntries = policy.rustTemplateInlineTestAllowlist ?? [];
  const rustTemplateInlineTestAllowlist = new Set(
    rustTemplateInlineTestEntries.filter((file) =>
      rustTemplateInlineTestRoots.some((templateRoot) => isUnderRoot(file, templateRoot)),
    ),
  );
  const repositoryTestRoots = policy.repositoryTestRoots ?? [];
  const rootTestRoots = policy.rootTestRoots ?? [];
  const frontendTestOwners = policy.frontendTestOwners ?? {};
  const rustCrateLevelTestAllowlist = new Set(policy.rustCrateLevelTestAllowlist ?? []);
  const rustIntegrationTests = policy.rustIntegrationTests ?? {};
  const repositoryTestForbiddenImportRoots = policy.repositoryTestForbiddenImportRoots ?? [];
  const repositoryTestImportAliases = policy.repositoryTestImportAliases ?? {};
  const fileSizeBaselines = policy.fileSizeBaselines ?? {};

  violations.push(...collectRustBackendViolations(root, trackedFiles, policy.rustBackendBoundaries));

  const frontendBoundaries = policy.frontendBoundaries
    ? {
      ...policy.frontendBoundaries,
      directTauriExceptions: policy.frontendBoundaries.directTauriExceptionsFile
        ? readJson(join(root, policy.frontendBoundaries.directTauriExceptionsFile))
        : policy.frontendBoundaries.directTauriExceptions,
      sourceOwners: policy.frontendBoundaries.sourceOwnersFile
        ? readJson(join(root, policy.frontendBoundaries.sourceOwnersFile))
        : policy.frontendBoundaries.sourceOwners,
    }
    : undefined;
  violations.push(...collectFrontendBoundaryViolations(root, trackedFiles, frontendBoundaries));

  for (const [testFile, owners] of Object.entries(frontendTestOwners)) {
    const validTestKey = /^apps\/desktop\/tests\/(?!repository\/).+\.test\.(?:ts|tsx)$/.test(testFile);
    if (!validTestKey) {
      violations.push(`${testFile}: frontendTestOwners key must be an exact *.test.ts or *.test.tsx file below apps/desktop/tests outside the repository namespace`);
    }
    if (!trackedFiles.has(testFile) || !existsSync(join(root, testFile))) {
      violations.push(`${testFile}: frontendTestOwners entry points to a missing tracked test`);
    } else if (validTestKey) {
      const relativeTest = testFile.slice("apps/desktop/tests/".length);
      const sourceRelative = relativeTest.replace(/\.test(?=\.(?:ts|tsx)$)/, "");
      const sourceFile = `apps/desktop/src/${sourceRelative}`;
      if (trackedFiles.has(sourceFile) && existsSync(join(root, sourceFile))) {
        violations.push(`${testFile}: frontendTestOwners entry is unused because the test already mirrors ${sourceFile}`);
      }
    }
    if (!Array.isArray(owners) || owners.length === 0) {
      violations.push(`${testFile}: frontendTestOwners must contain a non-empty owner list`);
      continue;
    }
    for (const owner of owners) {
      if (
        typeof owner !== "string"
        || owner.includes("*")
        || !isUnderRoot(owner, "apps/desktop/src")
        || !trackedFiles.has(owner)
        || !existsSync(join(root, owner))
      ) {
        violations.push(`${owner}: frontendTestOwners owner must be an exact existing file below apps/desktop/src`);
      }
    }
  }

  for (const [name, entries] of [
    ["frontendTestAllowlist", frontendTestAllowlist],
    ["rustInlineTestAllowlist", rustInlineTestAllowlist],
    ["rustTemplateInlineTestAllowlist", rustTemplateInlineTestAllowlist],
    ["rustCrateLevelTestAllowlist", rustCrateLevelTestAllowlist],
  ]) {
    for (const file of entries) {
      if (!trackedFiles.has(file) || !existsSync(join(root, file))) {
        violations.push(`${file}: ${name} entry points to a missing tracked file`);
      }
    }
  }

  for (const path of policy.forbiddenRootDesktopPaths ?? []) {
    if (existsSync(join(root, path))) {
      violations.push(`${path}: desktop-owned paths must live under apps/desktop, not repository root`);
    }
  }

  for (const file of rustTemplateInlineTestEntries) {
    if (!rustTemplateInlineTestRoots.some((templateRoot) => isUnderRoot(file, templateRoot))) {
      violations.push(`${file}: rustTemplateInlineTestAllowlist entries must be under rustTemplateInlineTestRoots`);
    }
  }

  for (const file of files) {
    const basename = file.split("/").at(-1) ?? file;
    const isTestFile = /\.(test|spec)\.[^.]+$/.test(basename);
    const isConfiguredTestFile = isTestFile
      && policy.frontendTestRoots.some((testRoot) => isUnderRoot(file, testRoot));
    const isSupportedTestFile = /\.test\.(?:ts|tsx)$/.test(basename);

    if (isConfiguredTestFile && /\.spec\.[^.]+$/.test(basename)) {
      violations.push(`${file}: .spec test files are forbidden; use .test.ts or .test.tsx`);
    } else if (isConfiguredTestFile && !isSupportedTestFile) {
      violations.push(`${file}: unsupported test extension; use .test.ts or .test.tsx`);
    }

    if (isTestFile && policy.forbiddenFrontendTestRoots.some((root) => isUnderRoot(file, root)) && !frontendTestAllowlist.has(file)) {
      violations.push(`frontend test must not live in production source: ${file}`);
    }

    if (isTestFile && isUnderRoot(file, "apps/desktop/tests") && !isUnderRoot(file, "apps/desktop/tests/repository")) {
      const relativeTest = file.slice("apps/desktop/tests/".length);
      const sourceRelative = relativeTest.replace(/\.test(?=\.(?:ts|tsx)$)/, "");
      const sourceFile = `apps/desktop/src/${sourceRelative}`;
      const mirrorsSource = trackedFiles.has(sourceFile) && existsSync(join(root, sourceFile));
      if (!mirrorsSource && !Object.hasOwn(frontendTestOwners, file)) {
        violations.push(`frontend test must mirror desktop source or use an approved repository namespace: ${file}`);
      }
    }

    if (isTestFile && isUnderRoot(file, "tests") && !rootTestRoots.some((testRoot) => isUnderRoot(file, testRoot))) {
      violations.push(`root tests must live under tests/repository: ${file}`);
    }

    if (repositoryTestRoots.some((root) => isUnderRoot(file, root))) {
      const content = readFileSync(join(root, file), "utf8");
      for (const specifier of importSpecifiers(content)) {
        const forbiddenRoot = repositoryTestForbiddenImportRoots.find((root) => resolvesToForbiddenRoot(file, specifier, root, repositoryTestImportAliases));
        if (forbiddenRoot) {
          violations.push(`${file}: repository tests may inspect files but must not import desktop-private modules from ${forbiddenRoot}`);
        }
      }
    }

    const extension = extname(file);
    if (extension === ".ts" || extension === ".tsx" || extension === ".rs") {
      const lineCount = countLines(readFileSync(join(root, file), "utf8"));
      const baseline = fileSizeBaselines[file];
      const softLimit = extension === ".rs" ? 800 : 500;

      if (typeof baseline === "number") {
        if (lineCount > baseline) {
          violations.push(`${file}: ${lineCount} lines exceeds ratcheted baseline ${baseline}`);
        } else if (lineCount <= softLimit) {
          violations.push(`${file}: ${lineCount} lines no longer exceeds soft limit ${softLimit}; remove its ratcheted baseline`);
        } else if (lineCount < baseline) {
          violations.push(`${file}: ratcheted baseline ${baseline} is stale; current line count is ${lineCount}`);
        }
      } else if (lineCount > softLimit) {
        violations.push(`${file}: ${lineCount} lines exceeds soft limit ${softLimit}; split the file or add a ratcheted baseline with architecture approval`);
      }
    }

    if (extension === ".rs") {
      violations.push(...rustTestInclusionViolations(root, file));
    }

    if (
      extension === ".rs"
      && isUnderRoot(file, "apps/desktop/src-tauri/src")
      && /(?:^|\/)[^/]+_tests\.rs$/.test(file)
      && !rustCrateLevelTestAllowlist.has(file)
    ) {
      violations.push(`crate-level Rust peer test module is forbidden: ${file}`);
    }

    if (
      extension === ".rs"
      && hasInlineRustTests(root, file)
      && !rustInlineTestAllowlist.has(file)
      && !rustTemplateInlineTestAllowlist.has(file)
    ) {
      if (isUnderRoot(file, "apps/desktop/src-tauri/src")) {
        violations.push(`inline Rust test module is forbidden: ${file}`);
      } else {
        violations.push(`${file}: inline Rust test modules must move to sibling tests.rs or be documented in the owning inline-test allowlist`);
      }
    }
  }

  for (const file of trackedFiles) {
    if (
      /^apps\/desktop\/src-tauri\/tests\/[^/]+\.rs$/.test(file)
      && !Object.hasOwn(rustIntegrationTests, file)
    ) {
      violations.push(`Rust integration test is not classified: ${file}`);
    }
  }

  const integrationClassifications = new Set(["external-infrastructure", "public-api-contract", "source-contract"]);
  for (const [file, metadata] of Object.entries(rustIntegrationTests)) {
    if (!trackedFiles.has(file) || !existsSync(join(root, file))) {
      violations.push(`${file}: rustIntegrationTests entry points to a missing tracked file`);
    }
    const testName = file.match(/^apps\/desktop\/src-tauri\/tests\/([^/]+)\.rs$/)?.[1];
    const defaultMode = metadata?.defaultMode;
    const expectedRun = testName
      ? `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test ${testName}${defaultMode === "ignored" ? " -- --ignored" : ""}`
      : undefined;
    if (
      !metadata
      || Object.keys(metadata).sort().join(",") !== "classification,defaultMode,explicitRun"
      || !integrationClassifications.has(metadata.classification)
      || !["enabled", "ignored"].includes(defaultMode)
      || metadata.explicitRun !== expectedRun
      || (metadata.classification === "external-infrastructure") !== (defaultMode === "ignored")
    ) {
      violations.push(`${file}: rustIntegrationTests entry must use a supported classification/defaultMode and exact explicitRun command`);
    }
  }

  const packageDirectories = inventory.workspacePackageDirectories ?? workspacePackageDirectories(root);
  const manifests = collectPackageManifests(root, trackedFiles, packageDirectories);
  const workspaceNames = new Set(manifests.map(({ json }) => json.name));

  for (const { file, json } of manifests) {
    const packageName = json.name;
    const allowed = policy.allowedWorkspaceDependencies[packageName];

    if (!allowed) {
      violations.push(`${file}: missing allowedWorkspaceDependencies entry for ${packageName}`);
      continue;
    }

    const allowedDependencies = new Set(allowed);
    for (const dependencyName of packageDependencyNames(json)) {
      if (workspaceNames.has(dependencyName) && !allowedDependencies.has(dependencyName)) {
        violations.push(`${file}: ${packageName} may not depend on workspace package ${dependencyName}`);
      }
    }
  }

  for (const file of Object.keys(fileSizeBaselines)) {
    if (!trackedFiles.has(file) || !existsSync(join(root, file))) {
      violations.push(`${file}: ratcheted baseline points to a missing tracked file`);
    }
  }

  return violations;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = collectViolations(REPO_ROOT, policy);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exitCode = 1;
  } else {
    console.log("[architecture] OK");
  }
}
