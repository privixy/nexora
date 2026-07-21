# Desktop Workspace Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the complete desktop application boundary from repository-root paths into `apps/desktop/` while preserving all runtime behavior, public contracts, and contributor-facing root commands.

**Architecture:** Keep the repository root as a private pnpm orchestration package and make `apps/desktop/package.json` the private desktop workspace package. Execute the migration as small path-only batches: create the workspace contract, move app configuration/assets/source, move desktop tests while preserving `tests/repository/`, move the entire Tauri crate, then repair repository automation, workflows, and packaging references. Each batch updates living documentation and architecture policy to exactly match the branch's current enforced state; no batch splits modules, changes assertions, or changes application behavior.

**Tech Stack:** Node.js 24.18.0, pnpm 10.30.3 workspaces, React 19.2.7, TypeScript 5.9.3, Vite 8.1.5, Vitest 4.1.10, Tauri 2.10.x, Rust 2021 (minimum Rust 1.85), Cargo, GitHub Actions.

## Global Constraints

- The foundation plan `docs/superpowers/plans/2026-07-20-modularization-foundation.md` must be implemented and green before this plan starts.
- Structural changes must not alter runtime behavior, visible UI, SQL, database-specific semantics, state ownership, command names, payload shapes, serialization, errors, timeouts, plugin JSON-RPC, driver capabilities, or published package APIs.
- Use `git mv` for every tracked path move; do not copy/delete files, split modules, rename symbols, reformat moved files, change tests' assertions, or normalize test architecture in these batches.
- Keep `tests/repository/` at the repository root as the only root test namespace; it may inspect repository/workflow files but must not import desktop-private modules.
- Move desktop tests, including the four temporarily colocated tests, without normalizing their placement; test normalization belongs to `2026-07-20-test-architecture-normalization.md`. This migration exclusively owns moving `tests/releaseWorkflow.test.ts` and `tests/releaseDryRunWorkflow.test.ts` directly to their final `tests/repository/` paths; no later plan moves them again.
- Keep root commands `dev`, `build`, `lint`, `preview`, `test`, `typecheck`, `test:coverage`, `test:rust`, `test:all`, `tauri`, `build:plugin-api`, `check:plugin-api`, `build:create-plugin`, `smoke:create-plugin`, `check:architecture`, `roadmap`, and `version` available with equivalent behavior.
- Preserve package names and versions: root `nexora` remains private, the desktop package is private `@nexora/desktop` at version `1.0.3`, `@nexora/plugin-api` remains public, and `@nexora/create-plugin` remains public.
- Keep desktop runtime dependencies and desktop-only build/test tooling in `apps/desktop/package.json`. Keep repository orchestration/versioning/changelog tooling at root, and choose root ownership for lint: root `package.json` retains the `lint` script plus exact ESLint runtime dependencies `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, and `typescript-eslint`; `eslint.config.js` remains root-owned and `pnpm lint` must be directly runnable from root after every batch.
- Keep root workspace/repository assets (`README*.md`, `CHANGELOG.md`, `roadmap.json`, `aur/`, `snap/`, `scripts/`, `packages/`, `plugins/`, `docs/`) at root; move only desktop-owned source, tests, assets, Tauri files, and app-local configuration.
- Preserve the root `pnpm-lock.yaml`; regenerate it only through `pnpm install --lockfile-only` so importer `.` retains only root-owned orchestration/changelog/lint tooling and importer `apps/desktop` owns desktop runtime/build/test/Tauri tooling.
- Documentation must distinguish **current enforced state**, **target state**, and **temporary compatibility exceptions** after every batch; never document a path as current before it exists.
- Before editing a function, class, or method, refresh GitNexus if necessary and run upstream impact analysis; warn and stop for HIGH or CRITICAL risk. Pure file moves and declarative path changes do not authorize symbol/body edits.
- The GitNexus MCP currently reports a LadybugDB storage-version mismatch even after a successful CLI refresh; retry after restarting the MCP client before implementation and record the limitation if it persists.
- Run the narrowest relevant checks first. Before push or PR creation, run the full CI-equivalent gate from the repository root.
- Commit steps are optional instructions only: run them only when the user explicitly requests commits. Before any requested commit, run `gitnexus_detect_changes({scope: "all", repo: "nexora"})` and review the changed flows.

---

## File and Interface Map

### Repository-owned files that remain at root

- `package.json`: private orchestration manifest and compatibility command surface.
- `pnpm-workspace.yaml`: discovers `apps/*` and `packages/*`.
- `pnpm-lock.yaml`: single workspace lockfile.
- `eslint.config.js`: repository-wide lint entry point with desktop-specific globs rooted at `apps/desktop/`; root `package.json` owns its `lint` script and all six imported ESLint packages.
- `scripts/check-architecture.mjs` and `architecture/policy.json`: enforce the current path contract.
- `tests/repository/`: repository-owned contracts only. Its final migration inventory is `architectureDocumentation.test.ts`, `architecturePolicy.test.ts`, `rootCommands.test.ts`, `workspaceLayout.test.ts`, `releaseWorkflow.test.ts`, `releaseDryRunWorkflow.test.ts`, `pluginApiSyncPaths.test.ts`, `versionSyncPaths.test.ts`, `ciWorkspacePaths.test.ts`, and `packagingPaths.test.ts`.
- `.github/workflows/*.yml`: repository CI/release/store orchestration.
- `scripts/sync-version.js`: root version coordinator targeting the desktop workspace.
- `README*.md`, `CHANGELOG.md`, `roadmap.json`, `aur/`, and `snap/`: repository/release metadata.

### Desktop-owned files after migration

- `apps/desktop/package.json`: private package `@nexora/desktop`, desktop dependencies, and local `dev`, `build`, `preview`, `test`, `typecheck`, `test:coverage`, and `tauri` scripts.
- `apps/desktop/{index.html,postcss.config.js,vite.config.ts,vitest.config.ts,tsconfig.json,tsconfig.app.json,tsconfig.node.json}`: app-local frontend configuration.
- `apps/desktop/src/`: the frontend source tree, unchanged except for repository-asset import depth repairs required by the move.
- `apps/desktop/public/`: Vite-served desktop assets.
- `apps/desktop/tests/`: all desktop Vitest tests and `setup.ts`. The two release workflow suites move directly from root `tests/` to their final `tests/repository/` paths in Task 4 and never enter `apps/desktop/tests/`.
- `apps/desktop/src-tauri/`: the entire Tauri crate, including Rust source, tests, capabilities, generated schemas, icons, manifests, and crate-local ignore rules.

### Stable command interfaces

| Root command | Delegated interface after migration |
|---|---|
| `pnpm dev` | `pnpm --filter @nexora/desktop dev` |
| `pnpm build` | `pnpm --filter @nexora/desktop build` |
| `pnpm lint` | root-owned `eslint .`; the root importer owns the ESLint CLI/config dependencies |
| `pnpm preview` | `pnpm --filter @nexora/desktop preview` |
| `pnpm test [args...]` | `pnpm --filter @nexora/desktop test [args...]`; desktop Vitest includes root `tests/repository/**/*.test.ts` |
| `pnpm typecheck` | `pnpm --filter @nexora/desktop typecheck` |
| `pnpm test:coverage` | `pnpm --filter @nexora/desktop test:coverage` |
| `pnpm test:rust` | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` |
| `pnpm tauri [args...]` | `pnpm --filter @nexora/desktop tauri [args...]` |
| package/architecture commands | unchanged root orchestration commands |

### Path-sensitive interfaces

- `apps/desktop/vitest.config.ts` resolves `@` to `apps/desktop/src`, loads `apps/desktop/tests/setup.ts`, includes desktop tests plus root `tests/repository/**/*.test.ts`, and reports coverage only for `apps/desktop/src`. Every root repository suite derives the repository root from its own `import.meta.url`, never from `process.cwd()`, because the stable root command delegates execution to the dependency-owning desktop package.
- `apps/desktop/src-tauri/tauri.conf.json` keeps `frontendDist: "../dist"`; its schema remains package-local at `../node_modules/@tauri-apps/cli/config.schema.json` because the Tauri CLI belongs to `apps/desktop`; `beforeDevCommand` and `beforeBuildCommand` continue invoking desktop-local pnpm scripts.
- `packages/plugin-api/scripts/check-sync.ts` resolves the host barrel at `apps/desktop/src/pluginApi.ts` while preserving its export comparison behavior.
- `scripts/sync-version.js` reads the root `package.json` version and writes `apps/desktop/package.json`, `apps/desktop/src/version.ts`, `apps/desktop/src-tauri/tauri.conf.json`, and `apps/desktop/src-tauri/Cargo.toml` before updating root `README.md`.
- Tauri GitHub Action jobs set `projectPath: apps/desktop`; Cargo caches use `apps/desktop/src-tauri`.

---

### Task 1: Preflight the Foundation and Record the Migration Surface

**Files:**
- Read: `docs/superpowers/specs/2026-07-20-repository-modularization-design.md`
- Read: `docs/superpowers/plans/2026-07-20-repository-modularization-master.md`
- Read: `docs/superpowers/plans/2026-07-20-modularization-foundation.md`
- Read: `docs/architecture/repository-structure.md`
- Read: `architecture/policy.json`
- Read: `scripts/check-architecture.mjs`
- Read/Test: `tests/repository/workspaceLayout.test.ts`
- Read/Test: `tests/repository/rootCommands.test.ts`
- Modify: `docs/architecture/baselines/2026-07-20-verification.md`

**Interfaces:**
- Consumes: the completed foundation's `pnpm check:architecture`, root command contract, current-layout contract, characterization suite, and current line-count/exception policy.
- Produces: a green, recorded pre-migration baseline and a complete list of path-sensitive references; no production/config changes.

- [ ] **Step 1: Create an isolated implementation worktree**

Use the `superpowers:using-git-worktrees` skill before implementation. Work from a clean branch based on the completed foundation branch; do not perform this migration in a workspace containing unrelated changes.

Run:

```bash
git status --short
git branch --show-current
```

Expected: clean status and a dedicated migration branch/worktree. If status is not clean, stop instead of stashing or overwriting user work.

- [ ] **Step 2: Refresh and verify GitNexus**

Run:

```bash
npx gitnexus status
npx gitnexus analyze
```

Expected: the repository is indexed successfully. Then read `gitnexus://repo/nexora/context` and query for desktop build, test, Tauri, release, and plugin API sync flows. If MCP still reports `Database file version: 42, Current build storage version: 40`, restart the MCP client and retry; record the failure in the baseline rather than bypassing required impact analysis for symbol edits.

- [ ] **Step 3: Verify the foundation artifacts exist**

Run:

```bash
test -f docs/architecture/repository-structure.md
test -f architecture/policy.json
test -f scripts/check-architecture.mjs
test -f tests/repository/workspaceLayout.test.ts
test -f tests/repository/rootCommands.test.ts
```

Expected: exit `0` with no output. If any file is absent, stop and implement the foundation plan first.

- [ ] **Step 4: Capture the current path inventory**

Run:

```bash
git ls-files 'src/**' 'public/**' 'tests/**' 'src-tauri/**' 'index.html' 'postcss.config.js' 'vite.config.ts' 'vitest.config.ts' 'tsconfig*.json' > /tmp/nexora-desktop-paths.before
git ls-files -z | node -e 'let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const re=/(^|\/)(src-tauri|src|tests|public)(\/|$)|vite\.config|vitest\.config|tsconfig|postcss\.config|index\.html|projectPath|tauri\.conf/;const hits=s.split("\0").filter(Boolean).filter(p=>re.test(p));if(!hits.length)process.exit(1);process.stdout.write(`${hits.join("\n")}\n`)})' > /tmp/nexora-path-references.before
```

Expected: both temporary files are non-empty and enumerate the current root desktop surface. These portable checks require only Git and the repository-pinned Node runtime; no external search binary is a prerequisite. The files are diagnostic only and must not be committed.

- [ ] **Step 5: Run the complete pre-migration baseline**

Run:

```bash
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm build
pnpm test:rust
pnpm check:architecture
```

Expected: every command exits `0`; `pnpm check:architecture` prints `[architecture] OK`. Stop on any failure and fix it outside this structural migration.

- [ ] **Step 6: Record the baseline**

Append a `Desktop workspace migration preflight` section to `docs/architecture/baselines/2026-07-20-verification.md` containing the exact commit SHA, date, commands from Step 5, PASS results, and the GitNexus MCP status. Do not edit previously recorded outcomes.

- [ ] **Step 7: Verify documentation-only scope**

Run:

```bash
git diff --check
git diff -- docs/architecture/baselines/2026-07-20-verification.md
```

Expected: no whitespace errors and only the new preflight record.

- [ ] **Step 8: Commit when explicitly requested**

Before committing, run GitNexus change detection for all changes. Expected: documentation only.

```bash
git add docs/architecture/baselines/2026-07-20-verification.md
git commit -m "docs: record desktop migration baseline"
```

### Task 2: Add the Desktop Workspace Manifest and Root Compatibility Contract

**Files:**
- Create: `apps/desktop/package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`
- Modify/Test: `tests/repository/workspaceLayout.test.ts`
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the foundation's unchanged root manifest and command contract.
- Produces: an empty private workspace boundary named `@nexora/desktop` and workspace discovery for `apps/*`; root remains the temporary desktop package until Task 3 moves source/config/dependencies atomically.

- [ ] **Step 1: Extend the workspace contract before creating the package**

Update `tests/repository/workspaceLayout.test.ts` to assert:

```ts
const rootPackage = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { private: boolean };
const desktopPackage = JSON.parse(
  readFileSync(resolve(root, "apps/desktop/package.json"), "utf8"),
) as { name: string; private: boolean; version: string };
const workspace = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");

describe("desktop workspace migration", () => {
  it("declares the desktop workspace boundary", () => {
    expect(workspace).toContain("- apps/*");
    expect(desktopPackage).toEqual({
      name: "@nexora/desktop",
      private: true,
      version: "1.0.3",
    });
    expect(rootPackage.private).toBe(true);
  });
});
```

Retain the existing current-path and root-command assertions in this batch because source, tests, configs, dependencies, scripts, and Tauri have not moved yet.

- [ ] **Step 2: Run the workspace contract and confirm failure**

Run:

```bash
pnpm test tests/repository/workspaceLayout.test.ts -- --run
```

Expected: FAIL because `apps/desktop/package.json` and `apps/*` do not exist yet.

- [ ] **Step 3: Create the empty desktop package manifest**

Create `apps/desktop/package.json` exactly as:

```json
{
  "name": "@nexora/desktop",
  "private": true,
  "version": "1.0.3"
}
```

Do not move dependencies or commands yet: with source/config still at root, root remains the only working desktop package in this independently green batch.

- [ ] **Step 4: Register the application workspace**

Set `pnpm-workspace.yaml` to include both ownership roots:

```yaml
packages:
  - apps/*
  - packages/*

ignoredBuiltDependencies:
  - esbuild
```

- [ ] **Step 5: Regenerate only the lockfile importer graph**

Run:

```bash
pnpm install --lockfile-only
```

Expected: exit `0`; `pnpm-lock.yaml` contains importers `.`, `apps/desktop`, `packages/create-plugin`, and `packages/plugin-api`. The new `apps/desktop` importer has no dependencies yet, and all existing resolutions remain unchanged.

- [ ] **Step 6: Update the architecture policy for the empty package**

In `architecture/policy.json`, add an empty desktop dependency contract while preserving the root desktop package's current allowances and all existing file/test paths:

```json
"allowedWorkspaceDependencies": {
  "nexora": ["@nexora/plugin-api", "@nexora/create-plugin"],
  "@nexora/desktop": [],
  "@nexora/plugin-api": [],
  "@nexora/create-plugin": []
}
```

- [ ] **Step 7: Update current-state documentation**

Update `docs/architecture/repository-structure.md` and `AGENTS.md` to state:

- the empty `apps/desktop/package.json` boundary and `apps/*` discovery are current;
- root remains the working desktop package and retains desktop commands/dependencies;
- source, tests, app-local configuration, and `src-tauri` remain temporarily at root;
- the owner of this exception is the desktop migration plan and removal phases are Tasks 3–5;
- contributors continue running commands from root.

Do not change `.rules/testing.md` or `.rules/rust.md` yet because their valid source/test paths have not moved.

- [ ] **Step 8: Verify the independent workspace batch**

Run:

```bash
pnpm install --frozen-lockfile
pnpm test tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm check:architecture
pnpm lint
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm typecheck
pnpm test -- --run
pnpm build
pnpm test:rust
```

Expected: all PASS through unchanged root commands; `pnpm lint` remains directly runnable from root with the existing ESLint dependency set; the empty desktop workspace introduces no behavior or command change.

- [ ] **Step 9: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: workspace/build/test orchestration changes only; no runtime symbol behavior changes.

```bash
git add apps/desktop/package.json pnpm-workspace.yaml pnpm-lock.yaml tests/repository/workspaceLayout.test.ts architecture/policy.json docs/architecture/repository-structure.md AGENTS.md
git commit -m "build: add desktop workspace manifest"
```

### Task 3: Move Desktop Frontend Configuration, Assets, and Source

**Files:**
- Move: `index.html` → `apps/desktop/index.html`
- Move: `postcss.config.js` → `apps/desktop/postcss.config.js`
- Move: `vite.config.ts` → `apps/desktop/vite.config.ts`
- Move: `vitest.config.ts` → `apps/desktop/vitest.config.ts`
- Move: `tsconfig.json` → `apps/desktop/tsconfig.json`
- Move: `tsconfig.app.json` → `apps/desktop/tsconfig.app.json`
- Move: `tsconfig.node.json` → `apps/desktop/tsconfig.node.json`
- Move: `public/` → `apps/desktop/public/`
- Move: `src/` → `apps/desktop/src/`
- Modify: `apps/desktop/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify/Test: `tests/repository/rootCommands.test.ts`
- Modify: `apps/desktop/src/data/changelog.ts`
- Modify: `apps/desktop/src/utils/settings.ts`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `eslint.config.js`
- Modify/Test: `tests/repository/workspaceLayout.test.ts`
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/react.md`
- Modify: `.rules/typescript.md`
- Modify: `.agents/skills/nexora-plugin-driver/SKILL.md`

**Interfaces:**
- Consumes: the empty `@nexora/desktop` boundary and unchanged source-relative imports.
- Produces: the working private desktop package with all existing desktop dependencies/scripts plus source/assets/app-local frontend configuration under `apps/desktop/`; root commands delegate without changing their names or behavior.

- [ ] **Step 1: Change the layout contract to the new frontend paths**

Update `tests/repository/workspaceLayout.test.ts` so the frontend assertion is:

```ts
it("owns frontend source, assets, and app configuration in apps/desktop", () => {
  for (const path of [
    "apps/desktop/src/main.tsx",
    "apps/desktop/public/logo.png",
    "apps/desktop/index.html",
    "apps/desktop/vite.config.ts",
    "apps/desktop/vitest.config.ts",
    "apps/desktop/tsconfig.app.json",
    "apps/desktop/tsconfig.node.json",
    "apps/desktop/postcss.config.js",
  ]) {
    expect(existsSync(resolve(root, path)), path).toBe(true);
  }

  for (const path of [
    "src",
    "public",
    "index.html",
    "vite.config.ts",
    "vitest.config.ts",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "postcss.config.js",
  ]) {
    expect(existsSync(resolve(root, path)), path).toBe(false);
  }
});
```

Keep root `tests/setup.ts` and `src-tauri/Cargo.toml` as current transitional assertions.

- [ ] **Step 2: Run the layout test and confirm failure**

Run:

```bash
pnpm test tests/repository/workspaceLayout.test.ts -- --run
```

Expected: FAIL because frontend paths are still at root.

- [ ] **Step 3: Move frontend source and public assets with `git mv`**

Run:

```bash
git mv public apps/desktop/public
git mv src apps/desktop/src
```

Expected: Git records directory renames; the four colocated frontend tests move with `src/` and remain temporary policy exceptions.

- [ ] **Step 4: Move app-local frontend configuration with `git mv`**

Run:

```bash
git mv index.html apps/desktop/index.html
git mv postcss.config.js apps/desktop/postcss.config.js
git mv vite.config.ts apps/desktop/vite.config.ts
git mv vitest.config.ts apps/desktop/vitest.config.ts
git mv tsconfig.json apps/desktop/tsconfig.json
git mv tsconfig.app.json apps/desktop/tsconfig.app.json
git mv tsconfig.node.json apps/desktop/tsconfig.node.json
```

Expected: Git records seven renames; file contents are unchanged at this step.

- [ ] **Step 5: Move desktop dependencies/scripts and add root command shims atomically**

Replace `apps/desktop/package.json` with the Task 2 identity fields plus:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest --config vitest.config.ts",
    "typecheck": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json",
    "test:coverage": "vitest run --coverage --config vitest.config.ts",
    "tauri": "tauri"
  }
}
```

Move every existing root `dependencies` entry and desktop-only frontend/Tauri `devDependencies` into this manifest, preserving version ranges exactly. Keep root automation dependencies required by root-owned scripts (`conventional-changelog` and `conventional-changelog-angular`) and retain this exact root ESLint ownership:

```json
{
  "@eslint/js": "^10.0.1",
  "eslint": "^10.7.0",
  "eslint-plugin-react-hooks": "^7.1.1",
  "eslint-plugin-react-refresh": "^0.5.3",
  "globals": "^17.7.0",
  "typescript-eslint": "^8.64.0"
}
```

Do not duplicate those six lint packages in `apps/desktop`: `eslint.config.js` and `pnpm lint` are root-owned.

In `tests/repository/rootCommands.test.ts`, add the exact delegation assertions from the Stable command interfaces table, except keep `test:rust` on its old `src-tauri` command until Task 5. Add this root-lint ownership regression:

```ts
expect(pkg.scripts.lint).toBe("eslint .");
for (const dependency of [
  "@eslint/js",
  "eslint",
  "eslint-plugin-react-hooks",
  "eslint-plugin-react-refresh",
  "globals",
  "typescript-eslint",
]) {
  expect(pkg.devDependencies).toHaveProperty(dependency);
  expect(desktopPackage.devDependencies ?? {}).not.toHaveProperty(dependency);
}
```

Then set root scripts to:

```json
{
  "dev": "pnpm --filter @nexora/desktop dev",
  "build": "pnpm --filter @nexora/desktop build",
  "lint": "eslint .",
  "preview": "pnpm --filter @nexora/desktop preview",
  "test": "pnpm --filter @nexora/desktop test",
  "typecheck": "pnpm --filter @nexora/desktop typecheck",
  "test:coverage": "pnpm --filter @nexora/desktop test:coverage",
  "tauri": "pnpm --filter @nexora/desktop tauri"
}
```

Keep package commands, architecture, roadmap, version, `test:all`, and temporary root `test:rust` available. Run `pnpm install --lockfile-only`; expect desktop dependencies to move from lockfile importer `.` to `apps/desktop` without resolution upgrades, while the root importer retains changelog and ESLint tooling.

- [ ] **Step 6: Repair only repository-asset import depths**

Change these two imports and nothing else:

```ts
// apps/desktop/src/data/changelog.ts
import changelogMarkdownRaw from "../../../../CHANGELOG.md?raw";

// apps/desktop/src/utils/settings.ts
import roadmapData from '../../../../roadmap.json';
```

These are required because `CHANGELOG.md` and `roadmap.json` remain repository-owned root files. Do not change exported names or data.

- [ ] **Step 7: Make Vitest desktop-rooted while retaining root repository tests**

In `apps/desktop/vitest.config.ts`, use:

```ts
const repoRoot = path.resolve(__dirname, "../..");
const repositoryTests = path
  .join(repoRoot, "tests/repository/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}")
  .replaceAll(path.sep, "/");

resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
},
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./tests/setup.ts"],
  include: [
    "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    repositoryTests,
  ],
  coverage: {
    provider: "v8",
    reporter: ["text", "json", "html"],
    include: ["src/**/*.ts", "src/**/*.tsx"],
    exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/test/**"],
  },
},
```

`tests/setup.ts` remains temporarily at root in this batch, so temporarily set `setupFiles` to `../../tests/setup.ts`; Task 4 must replace it with `./tests/setup.ts` immediately after the test move. Do not alter test environment, includes, coverage semantics, or aliases beyond path rooting.

- [ ] **Step 8: Update TypeScript and root-owned ESLint path ownership**

Keep `apps/desktop/tsconfig.json` references unchanged because all three TS configs moved together. Keep `apps/desktop/tsconfig.app.json` include entries semantically unchanged; temporarily point its setup include to `../../tests/setup.ts` until Task 4. Keep root `package.json` script `"lint": "eslint ."` and the six ESLint packages named in Step 5. In root `eslint.config.js`:

```js
globalIgnores([
  "**/dist/**",
  "**/tests/**",
  "**/coverage/**",
  "**/src-tauri/target/**",
]),
```

and change the React Refresh block to:

```js
{
  files: ["apps/desktop/src/**/*.tsx"],
  ignores: ["apps/desktop/src/utils/**/*.tsx"],
  extends: [reactRefresh.configs.vite],
},
```

Keep the general TypeScript file matcher unchanged so packages remain linted.

- [ ] **Step 9: Update architecture policy paths atomically**

In `architecture/policy.json`:

- replace forbidden frontend root `src` with `apps/desktop/src`;
- rewrite all four frontend test allowlist entries from `src/...` to `apps/desktop/src/...`;
- rewrite every frontend `fileSizeBaselines` key from `src/...` to `apps/desktop/src/...` without changing counts;
- change `allowedWorkspaceDependencies.nexora` to the root package's actual remaining workspace dependencies and set `allowedWorkspaceDependencies["@nexora/desktop"]` to the desktop manifest's actual workspace dependencies;
- retain `tests` as a frontend test root until Task 4;
- retain `src-tauri/...` Rust paths until Task 5.

- [ ] **Step 10: Update living docs and path-aware instructions**

Update:

- `docs/architecture/repository-structure.md`: mark frontend source/assets/config current under `apps/desktop`; keep root tests and `src-tauri` as temporary exceptions.
- `AGENTS.md`: change frontend source examples to `apps/desktop/src/...`; keep current test and Rust paths until their batches.
- `.rules/react.md` and `.rules/typescript.md`: add the canonical desktop source/config prefix, state that `eslint.config.js`, `pnpm lint`, and the six ESLint packages remain root-owned, and link to the architecture document.
- `.agents/skills/nexora-plugin-driver/SKILL.md`: replace desktop host references such as `src/types/plugins.ts` with `apps/desktop/src/types/plugins.ts`; leave Tauri references unchanged until Task 5.

Do not edit translations that visibly mention `package.json` and `src-tauri/Cargo.toml`; changing user-visible strings is outside this path-only plan.

- [ ] **Step 11: Verify rename purity and frontend compatibility**

Run:

```bash
git diff --summary
git diff --no-renames -- apps/desktop/src apps/desktop/public
pnpm install --frozen-lockfile
pnpm test tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm build
pnpm check:architecture
pnpm check:plugin-api
```

Expected:

- `git diff --summary` reports renames for moved files;
- the no-renames diff contains only the two repository-asset import repairs and required config path repairs, not source-body rewrites;
- `pnpm lint` resolves `eslint.config.js` and all six root-owned ESLint imports without a missing-package error;
- the root lockfile importer retains conventional-changelog plus ESLint tooling, while the desktop importer owns desktop runtime/build dependencies;
- every command exits `0` and architecture prints `[architecture] OK`.

- [ ] **Step 12: Verify development command startup**

Run:

```bash
pnpm dev -- --host 127.0.0.1
```

Expected: Vite reports a local server from `apps/desktop` with no missing `index.html`, source, public asset, `CHANGELOG.md`, or `roadmap.json` errors. Stop the server after startup verification.

- [ ] **Step 13: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: path moves and build/test path resolution only; no runtime behavior changes.

```bash
git add apps/desktop package.json pnpm-lock.yaml eslint.config.js tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts architecture/policy.json docs/architecture/repository-structure.md AGENTS.md .rules/react.md .rules/typescript.md .agents/skills/nexora-plugin-driver/SKILL.md
git commit -m "refactor: move desktop frontend into workspace"
```

### Task 4: Move Desktop Tests While Preserving Root Repository Tests

**Files:**
- Move: `tests/components/` → `apps/desktop/tests/components/`
- Move: `tests/contexts/` → `apps/desktop/tests/contexts/`
- Move: `tests/hooks/` → `apps/desktop/tests/hooks/`
- Move: `tests/layout/` → `apps/desktop/tests/layout/`
- Move: `tests/pages/` → `apps/desktop/tests/pages/`
- Move: `tests/themes/` → `apps/desktop/tests/themes/`
- Move: `tests/utils/` → `apps/desktop/tests/utils/`
- Move: `tests/workers/` → `apps/desktop/tests/workers/`
- Move: `tests/setup.ts` → `apps/desktop/tests/setup.ts`
- Move: `tests/version.test.ts` → `apps/desktop/tests/version.test.ts`
- Move: `tests/releaseWorkflow.test.ts` → `tests/repository/releaseWorkflow.test.ts`
- Move: `tests/releaseDryRunWorkflow.test.ts` → `tests/repository/releaseDryRunWorkflow.test.ts`
- Keep: `tests/repository/`
- Modify: all moved desktop test imports that traverse to `src/`
- Modify: `apps/desktop/tests/layout/rootOverflow.test.ts`
- Modify: every existing `tests/repository/**/*.test.ts` repository-root helper
- Modify: `tests/repository/releaseWorkflow.test.ts`
- Modify: `tests/repository/releaseDryRunWorkflow.test.ts`
- Modify: `tests/repository/rootCommands.test.ts`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/tsconfig.app.json`
- Modify/Test: `tests/repository/workspaceLayout.test.ts`
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/testing.md`

**Interfaces:**
- Consumes: desktop-rooted Vitest alias/config from Task 3 and root repository-test inclusion.
- Produces: desktop tests under `apps/desktop/tests`; release/workflow contracts join the independently owned root `tests/repository` namespace and still run through `pnpm test`.

- [ ] **Step 1: Add the final test-layout contract**

Update `tests/repository/workspaceLayout.test.ts` with:

```ts
it("separates desktop tests from root repository contracts", () => {
  expect(existsSync(resolve(root, "apps/desktop/tests/setup.ts"))).toBe(true);
  expect(existsSync(resolve(root, "apps/desktop/tests/utils"))).toBe(true);
  expect(existsSync(resolve(root, "tests/repository"))).toBe(true);
  expect(existsSync(resolve(root, "tests/repository/releaseWorkflow.test.ts"))).toBe(true);
  expect(existsSync(resolve(root, "tests/repository/releaseDryRunWorkflow.test.ts"))).toBe(true);
  expect(existsSync(resolve(root, "apps/desktop/tests/releaseWorkflow.test.ts"))).toBe(false);
  expect(existsSync(resolve(root, "apps/desktop/tests/releaseDryRunWorkflow.test.ts"))).toBe(false);

  const rootEntries = readdirSync(resolve(root, "tests"));
  expect(rootEntries).toEqual(["repository"]);
});
```

Sort `rootEntries` before comparison if the test helper does not guarantee ordering.

- [ ] **Step 2: Run the layout contract and confirm failure**

Run:

```bash
pnpm test tests/repository/workspaceLayout.test.ts -- --run
```

Expected: FAIL because desktop tests remain under root `tests/` and the two release suites have not reached their final `tests/repository/` paths.

- [ ] **Step 3: Move every desktop test path with `git mv`**

Run one `git mv` per independent path:

```bash
git mv tests/components apps/desktop/tests/components
git mv tests/contexts apps/desktop/tests/contexts
git mv tests/hooks apps/desktop/tests/hooks
git mv tests/layout apps/desktop/tests/layout
git mv tests/pages apps/desktop/tests/pages
git mv tests/themes apps/desktop/tests/themes
git mv tests/utils apps/desktop/tests/utils
git mv tests/workers apps/desktop/tests/workers
git mv tests/setup.ts apps/desktop/tests/setup.ts
git mv tests/version.test.ts apps/desktop/tests/version.test.ts
git mv tests/releaseWorkflow.test.ts tests/repository/releaseWorkflow.test.ts
git mv tests/releaseDryRunWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts
```

Expected: `tests/repository/` is the sole remaining root test namespace, and both release suites are already at the final paths consumed and updated by Task 7. Do not move any foundation repository contract; the normalization plan must treat these two destinations as immutable ownership, not another move batch.

- [ ] **Step 4: Repair imports and make every repository suite independent of the delegated working directory**

For every moved desktop file, preserve its relative relationship to desktop source. Because `tests/` and `src/` moved together at the same depth, imports such as `../../src/...` should remain valid. Search for and fix only imports that now escape to repository root or depend on `process.cwd()`:

```bash
node -e 'const fs=require("node:fs"),path=require("node:path");const roots=["apps/desktop/tests"];const re=/(\.\.\/)+src\/|readFileSync\(|process\.cwd\(\)|\.github\/workflows/;const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);for(const p of roots.flatMap(walk)){const t=fs.readFileSync(p,"utf8");t.split(/\r?\n/).forEach((l,i)=>{if(re.test(l))console.log(`${p}:${i+1}:${l}`)})}'
node -e 'const fs=require("node:fs"),path=require("node:path");const root="tests/repository",re=/process\.cwd\(\)|import\.meta\.url|fileURLToPath/;for(const n of fs.readdirSync(root)){const p=path.join(root,n);if(!fs.statSync(p).isFile())continue;const t=fs.readFileSync(p,"utf8");t.split(/\r?\n/).forEach((l,i)=>{if(re.test(l))console.log(`${p}:${i+1}:${l}`)})}'
```

Expected desktop fix:

```ts
// apps/desktop/tests/layout/rootOverflow.test.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(resolve(desktopRoot, "src/index.css"), "utf8");
const html = readFileSync(resolve(desktopRoot, "index.html"), "utf8");
```

Derive the desktop root from `import.meta.url`; do not use `import.meta.dirname` or `process.cwd()`. This form remains correct before and after normalization moves the suite from `tests/layout/` to `tests/repository/`.

Every existing and later-created `tests/repository/**/*.test.ts` file must derive the same root from its own file URL, including all four foundation contracts and both release contracts:

```ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
```

Replace each repository suite's `const root = process.cwd()` or one-level release helper with `repoRoot`, without changing assertions. Use `fileURLToPath(import.meta.url)` rather than `import.meta.dirname` for repository tests so the contract is explicit and portable. All repository suites created in Tasks 6–8 must use this helper from their first failing version.

- [ ] **Step 5: Finalize Vitest and TypeScript test paths**

In `apps/desktop/vitest.config.ts`, set:

```ts
setupFiles: ["./tests/setup.ts"],
```

Keep desktop and root repository include globs from Task 3. In `apps/desktop/tsconfig.app.json`, replace the temporary root setup include with `tests/setup.ts`. Remove stale includes for nonexistent `tests/components/layout/Accordion.test.tsx` and `NavItem.test.tsx` only if they remain nonexistent at implementation time; otherwise rewrite them to their exact moved paths.

- [ ] **Step 6: Update architecture policy test ownership**

In `architecture/policy.json`:

```json
"frontendTestRoots": [
  "apps/desktop/tests",
  "tests/repository",
  "packages/create-plugin/tests"
]
```

Keep the four colocated test allowlist entries under `apps/desktop/src/...`; normalization occurs in the next plan. Ensure repository-test policy forbids imports from `apps/desktop/src` except reading files as data for path/workflow contracts.

- [ ] **Step 7: Update living test instructions**

Update:

- `docs/architecture/repository-structure.md`: desktop tests current at `apps/desktop/tests`, root `tests/repository` the sole exception, colocated tests still temporary.
- `AGENTS.md`: all test placement examples become `apps/desktop/tests/...`; root repository exception is explicit.
- `.rules/testing.md`: replace root `src/`/`tests/` tree and commands with `apps/desktop/src/`/`apps/desktop/tests/`; retain root `pnpm test apps/desktop/tests/...`; document `tests/repository/` as non-desktop contracts only.

- [ ] **Step 8: Add and run the delegated-working-directory regression**

In `tests/repository/rootCommands.test.ts`, retain the exact root script assertion and add a command-level regression that launches the root test script from the repository root against `tests/repository/workspaceLayout.test.ts`. The child must use the package manager executable from `process.env.npm_execpath`, inherit the current environment, and assert exit status `0`; do not shell-interpolate a platform-specific `pnpm` path. This proves repository files resolve through `import.meta.url` even though pnpm executes Vitest in the dependency-owning desktop package.

Run:

```bash
pnpm test apps/desktop/tests/version.test.ts apps/desktop/tests/layout/rootOverflow.test.ts -- --run
pnpm test tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm test tests/repository -- --run
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: all PASS; the delegated child command exits `0`; the full test count equals the pre-migration baseline; root repository contracts and desktop tests are both discovered exactly once.

- [ ] **Step 9: Verify rename purity**

Run:

```bash
git diff --summary
git diff --no-renames -- apps/desktop/tests
```

Expected: moves are recognized as renames. Content changes are limited to path resolution/import repairs; test names and assertions remain unchanged.

- [ ] **Step 10: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: test discovery/path changes only.

```bash
git add apps/desktop/tests apps/desktop/vitest.config.ts apps/desktop/tsconfig.app.json tests/repository architecture/policy.json docs/architecture/repository-structure.md AGENTS.md .rules/testing.md
git commit -m "test: move desktop suites into workspace"
```

### Task 5: Move the Complete Tauri Crate

**Files:**
- Move: `src-tauri/` → `apps/desktop/src-tauri/`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `package.json`
- Modify/Test: `tests/repository/rootCommands.test.ts`
- Modify/Test: `tests/repository/workspaceLayout.test.ts`
- Modify: `architecture/policy.json`
- Modify: `eslint.config.js`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/rust.md`
- Modify: `.agents/skills/nexora-plugin-driver/SKILL.md`

**Interfaces:**
- Consumes: desktop package local build scripts and `apps/desktop/dist` output.
- Produces: complete Tauri project at `apps/desktop/src-tauri`; root `pnpm test:rust` and `pnpm tauri` remain compatible; Rust module paths and behavior remain unchanged within the crate.

- [ ] **Step 1: Add final Tauri path contracts**

In `tests/repository/workspaceLayout.test.ts` assert:

```ts
it("owns the complete Tauri crate in apps/desktop", () => {
  for (const path of [
    "apps/desktop/src-tauri/Cargo.toml",
    "apps/desktop/src-tauri/Cargo.lock",
    "apps/desktop/src-tauri/tauri.conf.json",
    "apps/desktop/src-tauri/src/lib.rs",
    "apps/desktop/src-tauri/tests/integration_tests.rs",
    "apps/desktop/src-tauri/capabilities/default.json",
    "apps/desktop/src-tauri/icons/icon.png",
  ]) {
    expect(existsSync(resolve(root, path)), path).toBe(true);
  }
  expect(existsSync(resolve(root, "src-tauri"))).toBe(false);
});
```

In `tests/repository/rootCommands.test.ts`, set the final Rust command contract:

```ts
expect(pkg.scripts["test:rust"]).toBe(
  "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml",
);
```

- [ ] **Step 2: Run the contracts and confirm failure**

Run:

```bash
pnpm test tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
```

Expected: FAIL because `src-tauri` remains at root and `test:rust` still uses the old path.

- [ ] **Step 3: Move the entire tracked crate with one `git mv`**

Run:

```bash
git mv src-tauri apps/desktop/src-tauri
```

Expected: Rust source, crate tests, capabilities, icons, generated schemas, manifests, and crate `.gitignore` move together. The ignored `src-tauri/target` directory is not a tracked deliverable; remove stale build output manually only if needed, never stage it.

- [ ] **Step 4: Repair Tauri config relative paths**

In `apps/desktop/src-tauri/tauri.conf.json`, retain the package-local schema path:

```json
"$schema": "../node_modules/@tauri-apps/cli/config.schema.json"
```

The config moved together with the desktop package boundary, and `@tauri-apps/cli` belongs to `apps/desktop/package.json`; do not point this field at repository-root `node_modules`.

Keep these values unchanged:

```json
"frontendDist": "../dist",
"devUrl": "http://localhost:5173",
"beforeDevCommand": "pnpm run dev",
"beforeBuildCommand": "pnpm run build"
```

Because the config and desktop package are siblings under `apps/desktop`, these commands now execute the desktop-local scripts and preserve output ownership.

- [ ] **Step 5: Update root Rust and ignore interfaces**

Set root `package.json`:

```json
"test:rust": "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml"
```

Retain `test:all` as `pnpm test:rust && pnpm test:coverage` and root `tauri` delegation from Task 2. In `eslint.config.js`, ensure the global ignore is path-independent (`**/src-tauri/target/**`).

- [ ] **Step 6: Rewrite Rust policy paths without changing baselines**

In `architecture/policy.json`, rewrite every `src-tauri/...` key/allowlist entry to `apps/desktop/src-tauri/...`, preserving exact line-count values and exception removal phases. Do not normalize `*_tests.rs` or inline test modules in this batch.

- [ ] **Step 7: Update Rust living documentation**

Update:

- `docs/architecture/repository-structure.md`: Tauri current path is `apps/desktop/src-tauri`; all desktop-owned production/config/test paths are now under the app workspace.
- `AGENTS.md`: Rust commands and file examples use `apps/desktop/src-tauri`.
- `.rules/rust.md`: canonical crate prefix becomes `apps/desktop/src-tauri/src/**` and integration tests `apps/desktop/src-tauri/tests/**`.
- `.agents/skills/nexora-plugin-driver/SKILL.md`: update all host driver/plugin references to `apps/desktop/src-tauri/...`.

- [ ] **Step 8: Verify Cargo and Tauri metadata from both interfaces**

Run:

```bash
cargo metadata --manifest-path apps/desktop/src-tauri/Cargo.toml --no-deps --format-version 1
pnpm test:rust
pnpm tauri info
pnpm check:architecture
```

Expected: Cargo metadata identifies the `nexora` crate at `apps/desktop/src-tauri`; Rust tests PASS; Tauri info finds `apps/desktop/src-tauri/tauri.conf.json`; architecture prints `[architecture] OK`.

- [ ] **Step 9: Verify frontend/Tauri build coupling**

Run:

```bash
pnpm build
pnpm tauri build --debug --no-bundle
```

Expected: frontend output is `apps/desktop/dist`; Tauri resolves `../dist` from `apps/desktop/src-tauri`; debug build exits `0` without creating release bundles.

- [ ] **Step 10: Verify rename purity**

Run:

```bash
git diff --summary
git diff --no-renames -- apps/desktop/src-tauri
```

Expected: the crate is represented as renames; content changes are limited to `tauri.conf.json` relative paths. Rust source and test bodies are byte-for-byte unchanged.

- [ ] **Step 11: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: crate path/build resolution changes; Rust execution flow symbols remain behaviorally unchanged.

```bash
git add apps/desktop/src-tauri package.json tests/repository architecture/policy.json eslint.config.js docs/architecture/repository-structure.md AGENTS.md .rules/rust.md .agents/skills/nexora-plugin-driver/SKILL.md
git commit -m "refactor: move Tauri crate into desktop workspace"
```

### Task 6: Repair Plugin API Synchronization and Versioning Paths

**Files:**
- Modify: `packages/plugin-api/scripts/check-sync.ts`
- Modify: `packages/plugin-api/src/slots.ts` documentation references
- Modify: `scripts/sync-version.js`
- Modify: `package.json`
- Create/Test: `tests/repository/pluginApiSyncPaths.test.ts`
- Create/Test: `tests/repository/versionSyncPaths.test.ts`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: final desktop source/Tauri paths and root package as release version source of truth.
- Produces: plugin API sync against `apps/desktop/src/pluginApi.ts`; version synchronization across root and desktop manifests/source; unchanged public package exports and app version values.

- [ ] **Step 1: Add a failing plugin API path contract**

Create `tests/repository/pluginApiSyncPaths.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(
  resolve(repoRoot, "packages/plugin-api/scripts/check-sync.ts"),
  "utf8",
);

describe("plugin API host synchronization", () => {
  it("reads the host barrel from the desktop workspace", () => {
    expect(source).toContain('"apps/desktop/src/pluginApi.ts"');
    expect(source).not.toContain('resolve(REPO_ROOT, "src/pluginApi.ts")');
  });
});
```

- [ ] **Step 2: Add a failing version-sync path contract**

Create `tests/repository/versionSyncPaths.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(resolve(repoRoot, "scripts/sync-version.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const desktopPaths = [
  "apps/desktop/package.json",
  "apps/desktop/src/version.ts",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/Cargo.toml",
];

describe("version synchronization paths", () => {
  it.each(desktopPaths)("targets %s", (path) => {
    expect(source).toContain(path);
  });

  it("stages only current versioned paths", () => {
    expect(pkg.scripts.version).toContain("apps/desktop/package.json");
    expect(pkg.scripts.version).toContain("apps/desktop/src/version.ts");
    expect(pkg.scripts.version).not.toContain(" src-tauri/");
    expect(pkg.scripts.version).not.toContain(" src/version.ts");
  });
});
```

- [ ] **Step 3: Run both contracts and confirm failure**

Run:

```bash
pnpm test tests/repository/pluginApiSyncPaths.test.ts tests/repository/versionSyncPaths.test.ts -- --run
```

Expected: FAIL because scripts still reference root desktop paths.

- [ ] **Step 4: Update the plugin API host path only**

In `packages/plugin-api/scripts/check-sync.ts`, set:

```ts
const HOST_BARREL = resolve(REPO_ROOT, "apps/desktop/src/pluginApi.ts");
```

Update comments in this script and `packages/plugin-api/src/slots.ts` that cite host paths. Do not change `extractExports`, comparison behavior, output format, or package exports.

- [ ] **Step 5: Make version synchronization explicitly root-aware**

In `scripts/sync-version.js`, derive paths from the script location rather than caller CWD:

```js
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const paths = {
  package: resolve(REPO_ROOT, "package.json"),
  desktopPackage: resolve(REPO_ROOT, "apps/desktop/package.json"),
  tauri: resolve(REPO_ROOT, "apps/desktop/src-tauri/tauri.conf.json"),
  cargo: resolve(REPO_ROOT, "apps/desktop/src-tauri/Cargo.toml"),
  appVersion: resolve(REPO_ROOT, "apps/desktop/src/version.ts"),
  readme: resolve(REPO_ROOT, "README.md"),
};
```

After reading `newVersion` from root `package.json`, update `apps/desktop/package.json` to the same version before updating Tauri, Cargo, app source, and README. Preserve JSON indentation behavior and README replacement regexes.

- [ ] **Step 6: Update the root version staging list**

Set the root `version` script's final `git add` paths to:

```text
README.md CHANGELOG.md apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src/version.ts
```

Do not include generated bundles or package outputs.

- [ ] **Step 7: Verify version sync without changing the version**

Run:

```bash
node scripts/sync-version.js
git diff --exit-code -- package.json apps/desktop/package.json apps/desktop/src/version.ts apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml README.md
```

Expected: the script reports version `1.0.3` (or the implementation branch's unchanged current version), and `git diff --exit-code` exits `0`. If formatting-only changes appear, make the script preserve the current format and rerun; do not accept churn.

- [ ] **Step 8: Verify package and repository contracts**

Run:

```bash
pnpm test tests/repository/pluginApiSyncPaths.test.ts tests/repository/versionSyncPaths.test.ts apps/desktop/tests/version.test.ts -- --run
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm check:architecture
```

Expected: all PASS; plugin API sync logs `OK`; package outputs and public surfaces are unchanged.

- [ ] **Step 9: Update living documentation**

Document `apps/desktop/src/pluginApi.ts` as the host-side contract mirror and list root `package.json` as version source with the four desktop synchronization targets. Update `AGENTS.md` only if it currently names old paths.

- [ ] **Step 10: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: build/release/package sync flows only.

```bash
git add packages/plugin-api scripts/sync-version.js package.json tests/repository docs/architecture/repository-structure.md AGENTS.md
git commit -m "build: repair desktop synchronization paths"
```

### Task 7: Update CI and Release Workflows for the Desktop Project Path

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/release-dry-run.yml`
- Modify: `.github/workflows/npm-publish.yml` only if path filters/caches are added by the foundation branch
- Modify: root `package.json`
- Create: `scripts/run-actionlint.mjs`
- Modify/Test: `tests/repository/rootCommands.test.ts`
- Modify/Test: `tests/repository/releaseWorkflow.test.ts`
- Modify/Test: `tests/repository/releaseDryRunWorkflow.test.ts`
- Create/Test: `tests/repository/ciWorkspacePaths.test.ts`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/testing.md`

**Interfaces:**
- Consumes: root command compatibility, desktop Tauri project at `apps/desktop`, and workspace lockfile.
- Produces: CI and release jobs that run from root while Tauri actions/caches resolve the moved project; release dry-run triggers cover every moved version/build manifest; root owns a reproducible workflow-lint launcher for pinned `actionlint` v1.7.7 with platform checksums.

- [ ] **Step 1: Extend release workflow characterization**

In `tests/repository/releaseWorkflow.test.ts`, retain existing tag/signing assertions and add:

```ts
it("builds the moved desktop Tauri project", () => {
  expect(workflow).toContain("projectPath: apps/desktop");
  expect(workflow).toContain("workspaces: apps/desktop/src-tauri");
  expect(workflow).not.toContain("workspaces: src-tauri");
});
```

- [ ] **Step 2: Extend release dry-run characterization**

In `tests/repository/releaseDryRunWorkflow.test.ts`, retain exact bundle args and add:

```ts
it("triggers and builds from moved desktop paths", () => {
  for (const path of [
    "apps/desktop/package.json",
    "apps/desktop/src/version.ts",
    "apps/desktop/src-tauri/Cargo.toml",
    "apps/desktop/src-tauri/Cargo.lock",
    "apps/desktop/src-tauri/tauri.conf.json",
  ]) {
    expect(workflow).toContain(`- ${path}`);
  }
  expect(workflow).toContain("projectPath: apps/desktop");
  expect(workflow).toContain("workspaces: apps/desktop/src-tauri");
});
```

- [ ] **Step 3: Add a CI workspace path contract**

Create `tests/repository/ciWorkspacePaths.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");

describe("CI desktop workspace paths", () => {
  it("keeps root commands and caches the moved Rust crate", () => {
    for (const command of [
      "pnpm test -- --run",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm build:plugin-api",
      "pnpm check:plugin-api",
      "pnpm build:create-plugin",
      "pnpm smoke:create-plugin",
      "pnpm build",
      "pnpm test:rust",
    ]) {
      expect(workflow).toContain(`run: ${command}`);
    }
    expect(workflow).toContain("workspaces: apps/desktop/src-tauri");
    expect(workflow).not.toContain("workspaces: src-tauri");
  });
});
```

- [ ] **Step 4: Run workflow contracts and confirm failure**

Run:

```bash
pnpm test tests/repository/ciWorkspacePaths.test.ts tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts -- --run
```

Expected: FAIL on old Cargo cache paths, absent `projectPath`, and old dry-run triggers.

- [ ] **Step 5: Update CI cache ownership without changing root commands**

In `.github/workflows/ci.yml`, change every Rust cache workspace to:

```yaml
with:
  workspaces: apps/desktop/src-tauri
```

Keep install and all verification commands at root. Ensure the architecture check added by the foundation remains before tests.

- [ ] **Step 6: Update release Tauri action project ownership**

In `.github/workflows/release.yml`:

```yaml
- name: Cache cargo
  uses: Swatinem/rust-cache@v2.9.1
  with:
    workspaces: apps/desktop/src-tauri

- name: Build Tauri app
  uses: tauri-apps/tauri-action@action-v1.0.0
  with:
    projectPath: apps/desktop
    releaseId: ${{ needs.create-release.outputs.release_id }}
    args: ${{ matrix.args }}
```

Preserve matrix platforms, bundle args, release creation/publishing behavior, signing environment, and action versions.

- [ ] **Step 7: Update dry-run triggers, cache, and project path**

In `.github/workflows/release-dry-run.yml`:

- replace old desktop path triggers with `apps/desktop/package.json`, `apps/desktop/src/version.ts`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/Cargo.lock`, and `apps/desktop/src-tauri/tauri.conf.json`;
- add `apps/desktop/vite.config.ts` and `apps/desktop/src-tauri/icons/**` so packaging-relevant path changes run the dry run;
- retain root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `CHANGELOG.md`, and both release workflow files;
- set Cargo cache `workspaces: apps/desktop/src-tauri`;
- set Tauri action `projectPath: apps/desktop`;
- preserve all exact unsigned dry-run args and artifact naming.

- [ ] **Step 8: Check npm publication remains package-rooted**

Review `.github/workflows/npm-publish.yml`. Keep root install and package filter commands unchanged. If the foundation added path triggers or cache dependency paths, include `apps/desktop/src/pluginApi.ts` because plugin sync depends on that host barrel; otherwise make no edit.

- [ ] **Step 9: Add the pinned workflow-lint preflight and validate syntax/contracts**

Create `scripts/run-actionlint.mjs` as a dependency-free Node launcher. It must map `process.platform`/`process.arch` to the v1.7.7 release archives below, download only from `https://github.com/rhysd/actionlint/releases/download/v1.7.7/`, allow redirects only to `github.com` and `release-assets.githubusercontent.com`, verify the archive SHA-256 before extraction, cache the binary under the operating-system temp directory (never the repository), and forward all CLI arguments/status/signals. Use Node's `https`, `crypto`, `fs`, `os`, `path`, `stream`, and `child_process`; use `tar` to extract `.tar.gz` and PowerShell `Expand-Archive` for Windows `.zip`, with a clear preflight error if that platform extractor is unavailable. Reject unsupported platforms/architectures and checksum mismatches. The exact code below is the implementation, not pseudocode.

```text
darwin-x64    actionlint_1.7.7_darwin_amd64.tar.gz   28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5
darwin-arm64  actionlint_1.7.7_darwin_arm64.tar.gz   2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db
linux-x64     actionlint_1.7.7_linux_amd64.tar.gz    023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757
linux-arm64   actionlint_1.7.7_linux_arm64.tar.gz    401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0
win32-x64     actionlint_1.7.7_windows_amd64.zip     7f12f1801bca3d480d67aaf7774f4c2a6359a3ca8eebe382c95c10c9704aa731
win32-arm64   actionlint_1.7.7_windows_arm64.zip     76e9514cfac18e5677aa04f3a89873c981f16a2f2353bb97372a86cd09b1f5a8
```

Implement the launcher exactly with this interface and failure behavior:

```js
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, mkdir, readFile, rename, rm } from "node:fs/promises";
import { get } from "node:https";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

const version = "1.7.7";
const artifacts = {
  "darwin-x64": ["actionlint_1.7.7_darwin_amd64.tar.gz", "28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5"],
  "darwin-arm64": ["actionlint_1.7.7_darwin_arm64.tar.gz", "2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db"],
  "linux-x64": ["actionlint_1.7.7_linux_amd64.tar.gz", "023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757"],
  "linux-arm64": ["actionlint_1.7.7_linux_arm64.tar.gz", "401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0"],
  "win32-x64": ["actionlint_1.7.7_windows_amd64.zip", "7f12f1801bca3d480d67aaf7774f4c2a6359a3ca8eebe382c95c10c9704aa731"],
  "win32-arm64": ["actionlint_1.7.7_windows_arm64.zip", "76e9514cfac18e5677aa04f3a89873c981f16a2f2353bb97372a86cd09b1f5a8"],
};

const key = `${process.platform}-${process.arch}`;
const artifact = artifacts[key];
if (!artifact) throw new Error(`actionlint ${version} is unsupported on ${key}`);

const [archiveName, expectedSha256] = artifact;
const cacheDir = join(tmpdir(), "nexora-actionlint", version, key);
const binary = join(cacheDir, process.platform === "win32" ? "actionlint.exe" : "actionlint");
const temporaryArchive = join(tmpdir(), `${archiveName}.${process.pid}.tmp`);
const allowedRedirectHosts = new Set(["github.com", "release-assets.githubusercontent.com"]);

const download = async (url, destination, redirects = 0) => {
  if (redirects > 5) throw new Error("too many actionlint download redirects");
  if (url.protocol !== "https:" || !allowedRedirectHosts.has(url.hostname)) {
    throw new Error(`refusing actionlint download redirect to ${url.href}`);
  }
  const response = await new Promise((resolve, reject) => {
    const request = get(url, resolve);
    request.on("error", reject);
  });
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    response.resume();
    return download(new URL(response.headers.location, url), destination, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`actionlint download failed with HTTP ${response.statusCode}`);
  }
  await pipeline(response, createWriteStream(destination, { flags: "wx" }));
};

const pathExists = async (path) => access(path).then(() => true, () => false);

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });

await mkdir(cacheDir, { recursive: true });
if (!(await pathExists(binary))) {
  const stagingDir = `${cacheDir}.staging-${process.pid}`;
  const stagedArchive = join(stagingDir, archiveName);
  const stagedBinary = join(stagingDir, process.platform === "win32" ? "actionlint.exe" : "actionlint");
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await rm(temporaryArchive, { force: true });
  const url = new URL(`https://github.com/rhysd/actionlint/releases/download/v${version}/${archiveName}`);
  try {
    await download(url, temporaryArchive);
    const actualSha256 = createHash("sha256").update(await readFile(temporaryArchive)).digest("hex");
    if (actualSha256 !== expectedSha256) {
      throw new Error(`actionlint checksum mismatch for ${basename(archiveName)}`);
    }
    await rename(temporaryArchive, stagedArchive);
    if (archiveName.endsWith(".zip")) {
      await run(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:ACTIONLINT_ARCHIVE -DestinationPath $env:ACTIONLINT_DESTINATION -Force"],
        { env: { ...process.env, ACTIONLINT_ARCHIVE: stagedArchive, ACTIONLINT_DESTINATION: stagingDir } },
      );
    } else {
      await run("tar", ["-xzf", stagedArchive, "-C", stagingDir]);
    }
    if (!(await pathExists(stagedBinary))) throw new Error(`actionlint archive did not contain ${basename(stagedBinary)}`);
    if (process.platform !== "win32") await chmod(stagedBinary, 0o755);
    try {
      await rename(stagedBinary, binary);
    } catch (error) {
      if (!(await pathExists(binary))) throw error;
    }
  } finally {
    await rm(temporaryArchive, { force: true });
    await rm(stagingDir, { recursive: true, force: true });
  }
}

const child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  throw error;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
```

Add this exact root script and assert it in `tests/repository/rootCommands.test.ts`:

```json
"lint:workflows": "node scripts/run-actionlint.mjs"
```

Preflight once before relying on it:

```bash
node --version
pnpm lint:workflows -version
```

Expected: Node matches the repository pin and actionlint reports exactly `1.7.7`. If download, checksum, extraction, or execution fails, stop; do not use `pnpm dlx actionlint`, an unpinned install, or an undocumented substitute.

Then run consistently through the root script:

```bash
pnpm test tests/repository/ciWorkspacePaths.test.ts tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm lint:workflows .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/release-dry-run.yml .github/workflows/npm-publish.yml
pnpm check:architecture
```

Expected: tests PASS; the checksum-verified actionlint v1.7.7 launcher exits `0` with no diagnostics; architecture prints `[architecture] OK`.

- [ ] **Step 10: Run the local release build equivalent**

Run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm tauri build --debug --no-bundle
```

Expected: PASS from root and Tauri resolves `apps/desktop` without a `projectPath`/manifest error. The hosted three-platform release dry run remains the merge gate because local execution cannot emulate all runners.

- [ ] **Step 11: Update workflow documentation**

Document root command orchestration, the checksum-verified v1.7.7 `pnpm lint:workflows` launcher, `projectPath: apps/desktop`, Cargo cache path, and release-dry-run trigger ownership in `docs/architecture/repository-structure.md`, `AGENTS.md`, and `.rules/testing.md`. Remove old workflow compatibility exceptions and any command examples using `pnpm dlx actionlint`.

- [ ] **Step 12: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: CI/release/build flows only.

```bash
git add .github/workflows package.json scripts/run-actionlint.mjs tests/repository/rootCommands.test.ts tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts tests/repository/ciWorkspacePaths.test.ts docs/architecture/repository-structure.md AGENTS.md .rules/testing.md
git commit -m "ci: target the desktop workspace"
```

### Task 8: Validate Packaging Paths and Store Workflows

**Files:**
- Modify: `.github/workflows/aur.yml` only if a moved repository path is discovered
- Modify: `.github/workflows/snap.yml` only if a moved repository path is discovered
- Modify: `.github/workflows/winget.yml` only if a moved repository path is discovered
- Modify: `aur/PKGBUILD` only if a moved local path is discovered
- Modify: `snap/snapcraft.yaml` only if a moved local path is discovered
- Create/Test: `tests/repository/packagingPaths.test.ts`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `docs/architecture/baselines/2026-07-20-verification.md`

**Interfaces:**
- Consumes: unchanged release artifact names emitted by Tauri and repository-owned `aur/`/`snap/` metadata.
- Produces: a guard proving packaging consumes release artifacts rather than obsolete source paths; no package metadata or artifact-name behavior changes.

- [ ] **Step 1: Add packaging path and artifact-name contracts**

Create `tests/repository/packagingPaths.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("desktop packaging paths", () => {
  it("keeps AUR packaging on the released deb artifact", () => {
    const workflow = read(".github/workflows/aur.yml");
    expect(workflow).toContain("nexora_${{ steps.version.outputs.version }}_amd64.deb");
    expect(workflow).toContain("pkgbuild: ./aur/PKGBUILD");
    expect(workflow).not.toContain("src-tauri/");
  });

  it("keeps Snap packaging on root-owned metadata and the released deb", () => {
    const workflow = read(".github/workflows/snap.yml");
    const snapcraft = read("snap/snapcraft.yaml");
    expect(workflow).toContain("path: snap");
    expect(workflow).toContain("snap/nexora.deb");
    expect(snapcraft).toContain("source: nexora.deb");
    expect(workflow).not.toContain("src-tauri/");
  });

  it("keeps Winget matching the released NSIS artifact", () => {
    const workflow = read(".github/workflows/winget.yml");
    expect(workflow).toContain("installers-regex: '_x64-setup\\.exe$'");
    expect(workflow).not.toContain("src-tauri/");
  });
});
```

- [ ] **Step 2: Run the packaging contract**

Run:

```bash
pnpm test tests/repository/packagingPaths.test.ts -- --run
```

Expected: PASS if packaging is already release-artifact-based. A passing characterization test is correct here: no production/config change is required when paths are unaffected.

- [ ] **Step 3: Audit local packaging references**

Run this portable tracked-file scan:

```bash
git ls-files -z -- aur snap .github/workflows | node -e 'const fs=require("node:fs");let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const re=/src-tauri|target\/release\/bundle|apps\/desktop|nexora_.*amd64\.deb|_x64-setup\.exe|snap\/nexora\.deb|aur\/PKGBUILD/;for(const p of s.split("\0").filter(Boolean)){const text=fs.readFileSync(p,"utf8");text.split(/\r?\n/).forEach((line,i)=>{if(re.test(line))process.stdout.write(`${p}:${i+1}:${line}\n`)})}})'
```

Expected: `src-tauri` appears only as `apps/desktop/src-tauri` in build/cache/project settings; AUR, Snap, and Winget continue consuming release artifacts by unchanged names. If an obsolete local source path is found, update only that path and extend `packagingPaths.test.ts` with its exact expected replacement. The scan requires no undeclared external search binary.

- [ ] **Step 4: Validate packaging workflow syntax**

Run:

```bash
pnpm lint:workflows .github/workflows/aur.yml .github/workflows/snap.yml .github/workflows/winget.yml
```

Expected: the checksum-verified actionlint v1.7.7 launcher exits `0` with no diagnostics.

- [ ] **Step 5: Validate the Snap source layout without publishing**

Run:

```bash
test -f snap/snapcraft.yaml
test -f aur/PKGBUILD
node -e 'const fs=require("node:fs");if(!fs.readFileSync("snap/snapcraft.yaml","utf8").split(/\r?\n/).includes("source: nexora.deb"))process.exit(1)'
node -e 'const fs=require("node:fs");if(!fs.readFileSync("aur/PKGBUILD","utf8").split(/\r?\n/).includes(`source=("\${_pkgname}_\${pkgver}_amd64.deb")`))process.exit(1)'
```

Expected: all commands exit `0`; packaging metadata remains root-owned and independent of the Tauri source path. These checks require only Node and no external search binary. Do not invoke store publication or require secrets.

- [ ] **Step 6: Record packaging verification**

Append exact packaging contract, checksum-verified actionlint v1.7.7 launcher result, and portable Node/Git source-layout results to the migration section in `docs/architecture/baselines/2026-07-20-verification.md`. Update `docs/architecture/repository-structure.md` to state that `aur/` and `snap/` remain root-owned release consumers, not desktop source.

- [ ] **Step 7: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: packaging contract/docs, plus path-only workflow edits if any obsolete reference was found.

```bash
git add tests/repository/packagingPaths.test.ts docs/architecture/repository-structure.md docs/architecture/baselines/2026-07-20-verification.md .github/workflows/aur.yml .github/workflows/snap.yml .github/workflows/winget.yml aur/PKGBUILD snap/snapcraft.yaml
git commit -m "test: guard desktop packaging paths"
```

### Task 9: Tighten Final Guards and Remove Desktop Root Exceptions

**Files:**
- Modify/Test: `tests/repository/workspaceLayout.test.ts`
- Modify/Test: `tests/repository/architectureDocumentation.test.ts`
- Modify/Test: `tests/repository/architecturePolicy.test.ts`
- Modify: `architecture/policy.json`
- Modify: `scripts/check-architecture.mjs`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/testing.md`
- Modify: `.rules/react.md`
- Modify: `.rules/typescript.md`
- Modify: `.rules/rust.md`
- Modify: `CONTRIBUTING.md` only where old contributor paths exist
- Modify: `README.md` only where a moved desktop asset/source path exists; preserve the root banner path unless intentionally kept root-owned

**Interfaces:**
- Consumes: completed desktop path migration and foundation architecture checker.
- Produces: machine-enforced guarantee that no desktop-owned production, test, asset, Tauri, or app-local config remains at root; docs and guards agree on final current state.

- [ ] **Step 1: Extend the final no-root-desktop contract**

Add to `tests/repository/workspaceLayout.test.ts`:

```ts
const forbiddenRootDesktopPaths = [
  "src",
  "public",
  "src-tauri",
  "index.html",
  "postcss.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "tsconfig.app.json",
  "tsconfig.node.json",
];

it.each(forbiddenRootDesktopPaths)("does not keep desktop-owned %s at root", (path) => {
  expect(existsSync(resolve(root, path))).toBe(false);
});
```

Also assert `tests/` contains only `repository/` and `apps/desktop` contains all expected ownership roots.

- [ ] **Step 2: Extend documentation and policy contracts**

In `tests/repository/architectureDocumentation.test.ts`, assert the canonical document and `AGENTS.md` contain `apps/desktop/src`, `apps/desktop/tests`, and `apps/desktop/src-tauri`. In `tests/repository/architecturePolicy.test.ts`, assert policy roots/baselines use `apps/desktop` and no policy string begins with old root desktop prefixes.

- [ ] **Step 3: Run contracts and confirm the remaining guard gap**

Run:

```bash
pnpm test tests/repository/workspaceLayout.test.ts tests/repository/architectureDocumentation.test.ts tests/repository/architecturePolicy.test.ts -- --run
```

Expected: FAIL if the checker/policy/docs still allow old root desktop paths. If already PASS, proceed to add the explicit checker rule in Step 4 and prove it with a fixture/unit case in `architecturePolicy.test.ts`.

- [ ] **Step 4: Add the explicit forbidden-root policy interface**

Add to `architecture/policy.json`:

```json
"forbiddenRootDesktopPaths": [
  "src",
  "public",
  "src-tauri",
  "index.html",
  "postcss.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "tsconfig.app.json",
  "tsconfig.node.json"
]
```

Extend `collectViolations(root, policy)` in `scripts/check-architecture.mjs` to emit one actionable violation for each existing forbidden path. Add an `architecturePolicy.test.ts` fixture that creates one forbidden path in a temporary root and expects its exact violation. Do not prohibit repository-owned root `package.json`, `eslint.config.js`, `pnpm-workspace.yaml`, `tests/repository`, `README.md`, `CHANGELOG.md`, or `roadmap.json`.

- [ ] **Step 5: Remove completed migration exceptions**

From `architecture/policy.json` and `docs/architecture/repository-structure.md`, remove transitional exceptions for root frontend source, root desktop tests, root app config, and root `src-tauri`. Retain only debt intentionally deferred to the test-normalization and modularization plans, including the four colocated frontend tests now under `apps/desktop/src` and existing Rust test-layout debt now under `apps/desktop/src-tauri`.

- [ ] **Step 6: Scan tracked files for obsolete path references**

Run:

```bash
git ls-files -z | node -e 'const fs=require("node:fs");let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const re=/(^|[^A-Za-z0-9_.-])(src-tauri\/|src\/pluginApi\.ts|src\/version\.ts|tests\/setup\.ts|vite\.config\.ts|vitest\.config\.ts|tsconfig\.app\.json|postcss\.config\.js)/;let bad=0;for(const p of s.split("\0").filter(Boolean)){if(p.startsWith("docs/superpowers/")||p==="CHANGELOG.md")continue;let text;try{text=fs.readFileSync(p,"utf8")}catch{continue}text.split(/\r?\n/).forEach((line,i)=>{if(re.test(line)){bad++;process.stderr.write(`${p}:${i+1}:${line}\n`)}})}process.exit(bad?1:0)})'
```

Expected: every current reference is prefixed with `apps/desktop/`, or is a deliberately relative app-local reference documented in the final architecture file. Historical approved spec/plan text is excluded and must not be rewritten.

- [ ] **Step 7: Update all living instructions found by the scan**

Repair old current-path references in `AGENTS.md`, focused `.rules/`, `CONTRIBUTING.md`, active package comments/docs, and current automation. Do not rewrite historical release notes, approved specs, this implementation plan, or user-visible translated dependency descriptions.

- [ ] **Step 8: Verify the final guard**

Run:

```bash
pnpm test tests/repository -- --run
pnpm check:architecture
pnpm typecheck
pnpm lint
```

Expected: all PASS and `[architecture] OK`.

- [ ] **Step 9: Commit when explicitly requested**

Before committing, run GitNexus change detection. Expected: repository guard/documentation flows only.

```bash
git add tests/repository architecture scripts/check-architecture.mjs docs/architecture/repository-structure.md AGENTS.md .rules CONTRIBUTING.md README.md
git commit -m "ci: enforce desktop workspace ownership"
```

### Task 10: Run the Full Migration and Release Gate

**Files:**
- Modify: `docs/architecture/baselines/2026-07-20-verification.md`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md` only if verification finds stale commands

**Interfaces:**
- Consumes: all completed batches and unchanged root command names.
- Produces: recorded evidence that development, tests, packages, Rust, frontend build, Tauri project resolution, workflows, and packaging remain green; no production/config changes unless a failing path contract identifies a migration defect.

- [ ] **Step 1: Verify the final tracked layout**

Run:

```bash
git ls-files 'apps/desktop/**' 'tests/**' 'src/**' 'public/**' 'src-tauri/**' 'index.html' 'vite.config.ts' 'vitest.config.ts' 'tsconfig*.json' 'postcss.config.js'
```

Expected: desktop files are under `apps/desktop/**`; root desktop paths are absent; root test output contains only `tests/repository/**`.

- [ ] **Step 2: Run narrow repository and moved-path contracts**

Run:

```bash
pnpm test tests/repository -- --run
pnpm test apps/desktop/tests/version.test.ts apps/desktop/tests/layout/rootOverflow.test.ts tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts -- --run
pnpm check:architecture
```

Expected: all PASS and `[architecture] OK`.

- [ ] **Step 3: Run the full CI-equivalent gate from root**

Run:

```bash
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm build
pnpm test:rust
```

Expected: every command exits `0`; full desktop test count matches baseline; `pnpm lint` runs directly from root with root-owned ESLint dependencies; package and plugin contracts remain unchanged; frontend output is `apps/desktop/dist`; Rust tests use `apps/desktop/src-tauri`.

- [ ] **Step 4: Run workspace-local checks**

Run:

```bash
pnpm --filter @nexora/desktop test -- --run
pnpm --filter @nexora/desktop typecheck
pnpm --filter @nexora/desktop build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: all PASS independently of root aliases.

- [ ] **Step 5: Run Tauri and workflow/package dry checks**

Run:

```bash
pnpm tauri info
pnpm tauri build --debug --no-bundle
pnpm lint:workflows .github/workflows/*.yml
pnpm test tests/repository/packagingPaths.test.ts -- --run
```

Expected: Tauri identifies `apps/desktop` and builds without bundling; the checksum-verified actionlint v1.7.7 launcher lints all workflows; packaging contracts PASS. The hosted `.github/workflows/release-dry-run.yml` three-platform run must pass before this branch is merged or released.

- [ ] **Step 6: Verify root development startup**

Run:

```bash
pnpm dev -- --host 127.0.0.1
```

Expected: Vite starts from `apps/desktop`, serves `apps/desktop/index.html`, resolves desktop assets and root repository data imports, and reports no missing paths. Stop it after verification.

- [ ] **Step 7: Review the complete structural diff**

Run:

```bash
git status --short
git diff --stat
git diff --summary
git diff --check
git diff --find-renames=90% -- apps/desktop
```

Expected: moved files are recognized as renames wherever only paths changed; edited content is limited to manifests, path references, contracts, guards, workflows, scripts, and living docs. No SQL, command payload, runtime branch, state ownership, user-visible copy, or test assertion changes appear.

- [ ] **Step 8: Run GitNexus changed-flow review**

Run `gitnexus_detect_changes({scope: "compare", base_ref: "main", repo: "nexora"})` after refreshing the index if needed.

Expected: build/test/package/release/path-resolution flows are affected. If runtime feature flows show body changes rather than moved symbols, inspect and remove the accidental behavior change before proceeding.

- [ ] **Step 9: Record final verification and close current-state docs**

Append every command and result from Tasks 10 Steps 1–8 to `docs/architecture/baselines/2026-07-20-verification.md`. In `docs/architecture/repository-structure.md`, mark the desktop workspace migration current and complete, list the next phase as test architecture normalization, and retain only still-valid temporary exceptions. Ensure `AGENTS.md` commands and paths exactly match the final layout.

- [ ] **Step 10: Re-run documentation contracts**

Run:

```bash
pnpm test tests/repository/architectureDocumentation.test.ts tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm check:architecture
git diff --check
```

Expected: PASS, `[architecture] OK`, and no whitespace errors.

- [ ] **Step 11: Commit when explicitly requested**

Before committing, run GitNexus change detection again on staged changes and inspect `git status`, `git diff`, and recent log per repository rules.

```bash
git add docs/architecture/baselines/2026-07-20-verification.md docs/architecture/repository-structure.md AGENTS.md
git commit -m "docs: complete desktop workspace migration"
```

---

## Final Acceptance Checklist

- [ ] `apps/desktop/package.json` is private `@nexora/desktop`; root `package.json` is orchestration-only and retains every contributor command.
- [ ] `apps/desktop/src`, `apps/desktop/public`, app-local frontend configs, `apps/desktop/tests`, and `apps/desktop/src-tauri` exist and their former root paths do not.
- [ ] `tests/repository/` is the only root test namespace; it contains the four foundation contracts, the two final release contracts, and the four migration-created plugin/version/CI/packaging contracts, derives repository paths from `import.meta.url`, and does not import desktop-private modules.
- [ ] All tracked moves used `git mv`; no module splitting, symbol renaming, assertion rewriting, or behavior change occurred.
- [ ] `pnpm-lock.yaml` has the correct `apps/desktop` importer and no duplicated root desktop dependency ownership.
- [ ] Root test/typecheck/lint/build/Tauri/Rust/package commands remain runnable and equivalent; `rootCommands.test.ts` proves root owns `eslint.config.js`, `lint: eslint .`, and all six ESLint config/runtime packages while the desktop importer does not duplicate them.
- [ ] Root owns `lint:workflows` through dependency-free `scripts/run-actionlint.mjs`, which downloads only pinned actionlint v1.7.7, verifies the exact platform archive checksum, caches outside the repository, and is used by every workflow gate; portable Node/Git checks replace external search-tool dependencies.
- [ ] `packages/plugin-api/scripts/check-sync.ts` points to `apps/desktop/src/pluginApi.ts` and public package APIs are unchanged.
- [ ] Version synchronization updates root and desktop manifests, app source, Tauri config, and Cargo manifest without changing the current version during migration.
- [ ] CI/release Cargo caches use `apps/desktop/src-tauri`; Tauri actions use `projectPath: apps/desktop`; dry-run triggers cover moved manifests/config/icons.
- [ ] AUR, Snap, and Winget retain unchanged release artifact names and no obsolete source path.
- [ ] Architecture guards prohibit root desktop-owned paths and retain only documented future-phase exceptions.
- [ ] Living architecture docs, `AGENTS.md`, focused `.rules/`, package docs/comments, workflows, and guards use current paths.
- [ ] Full root and workspace-local gates pass, Tauri debug no-bundle build passes, workflows lint, and hosted release dry run passes before merge/release.
