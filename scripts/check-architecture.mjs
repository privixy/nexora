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
  return /^\s*#\[cfg\(test\)\]\s*\n\s*mod\s+tests\s*\{/m.test(content);
}

function importSpecifiers(content) {
  const specifiers = [];
  const importPattern = /\bimport\s+(?:[^"'()]+?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bexport\s+[^"']+?\s+from\s+["']([^"']+)["']/g;

  for (const match of content.matchAll(importPattern)) {
    specifiers.push(match[1] ?? match[2] ?? match[3]);
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
    .filter((file) => sourceRoots.some((sourceRoot) => isUnderRoot(file, sourceRoot)) || policy.frontendTestRoots.some((testRoot) => isUnderRoot(file, testRoot)))
    .sort();
  const frontendTestAllowlist = new Set(policy.frontendTestAllowlist ?? []);
  const rustInlineTestAllowlist = new Set(policy.rustInlineTestAllowlist ?? []);
  const repositoryTestRoots = policy.rootTestExceptionRoots ?? [];
  const repositoryTestForbiddenImportRoots = policy.repositoryTestForbiddenImportRoots ?? [];
  const repositoryTestImportAliases = policy.repositoryTestImportAliases ?? {};
  const fileSizeBaselines = policy.fileSizeBaselines ?? {};

  for (const path of policy.forbiddenRootDesktopPaths ?? []) {
    if (existsSync(join(root, path))) {
      violations.push(`${path}: desktop-owned paths must live under apps/desktop, not repository root`);
    }
  }

  for (const file of files) {
    const basename = file.split("/").at(-1) ?? file;
    const isTestFile = /\.(test|spec)\.[^.]+$/.test(basename);

    if (/\.spec\.[^.]+$/.test(basename)) {
      violations.push(`${file}: rename .spec test files to .test files`);
    }

    if (isTestFile && policy.forbiddenFrontendTestRoots.some((root) => isUnderRoot(file, root)) && !frontendTestAllowlist.has(file)) {
      violations.push(`${file}: frontend tests must live under ${policy.frontendTestRoots.join(" or ")} unless allowlisted`);
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

    if (extension === ".rs" && hasInlineRustTests(root, file) && !rustInlineTestAllowlist.has(file)) {
      violations.push(`${file}: inline Rust test modules must move to sibling tests.rs or be documented in rustInlineTestAllowlist`);
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
