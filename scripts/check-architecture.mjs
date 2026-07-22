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
  return /^[ \t]*#\[cfg\(test\)\](?:\s*#\[(?:[^\[\]]|\[[^\]]*\])*\])*\s*(?:pub(?:\s*\([^)]*\))?\s+)?mod\s+tests\s*\{/m.test(content);
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
      index += 1;
      while (index < content.length) {
        if (content[index] === "\\" && index + 1 < content.length) {
          index += 2;
        } else if (content[index] === "`") {
          index += 1;
          break;
        } else {
          index += 1;
        }
      }
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
    if (token.value === "import" && tokens[index + 1]?.value === "(" && tokens[index + 2]?.type === "string") {
      specifiers.push(tokens[index + 2].value);
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

    if (/\.spec\.[^.]+$/.test(basename)) {
      violations.push(`${file}: rename .spec test files to .test files`);
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
        }
      } else if (lineCount > softLimit) {
        violations.push(`${file}: ${lineCount} lines exceeds soft limit ${softLimit}; split the file or add a ratcheted baseline with architecture approval`);
      }
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

  for (const file of Object.keys(rustIntegrationTests)) {
    if (!trackedFiles.has(file) || !existsSync(join(root, file))) {
      violations.push(`${file}: rustIntegrationTests entry points to a missing tracked file`);
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
