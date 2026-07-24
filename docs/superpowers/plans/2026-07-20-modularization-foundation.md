# Modularization Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a trustworthy behavioral baseline, living architecture instructions, and machine-enforced repository boundaries before any large path or module migration.

**Architecture:** Keep root paths unchanged during this plan. Add repository-level contract tests and a dependency-free architecture checker that reads a versioned policy file, then add targeted characterization coverage around high-risk frontend and Rust/Tauri flows.

**Tech Stack:** Node.js 24, TypeScript, Vitest, React Testing Library, Rust/Cargo, GitNexus CLI/MCP, GitHub Actions.

## Global Constraints

- Do not move production modules in this plan.
- Do not change application logic, assertions that encode current behavior, SQL, command contracts, or plugin behavior.
- `docs/architecture/repository-structure.md` must describe current root paths and clearly label `apps/desktop/` as target state until the move occurs.
- Architecture guards begin with explicit temporary exceptions for current debt and use ratchets rather than making the existing repository impossible to build.
- Follow the Standard Task Gate in `docs/superpowers/plans/2026-07-20-repository-modularization-master.md`.

---

### Task 1: Refresh GitNexus and capture the baseline

**Files:**
- Create: `docs/architecture/baselines/2026-07-20-verification.md`
- Create: `docs/architecture/baselines/2026-07-20-hardcoded-sql.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: current `main` at the implementation start.
- Produces: indexed code graph, exact baseline command outcomes, and a read-only SQL/driver-specific debt inventory used as a behavior canary.

- [ ] **Step 1: Verify the current index status**

Run:

```bash
node .gitnexus/run.cjs status
```

If `.gitnexus/run.cjs` is unavailable, run:

```bash
npx gitnexus status
```

Expected: output reports the current indexed commit. If it is not current or reports a storage-version mismatch, continue to Step 2.

- [ ] **Step 2: Refresh the index**

Run:

```bash
node .gitnexus/run.cjs analyze
```

Fallback:

```bash
npx gitnexus analyze
```

Expected: analysis completes for current `HEAD`; `gitnexus_query` can read repository `nexora` without the LadybugDB version error.

- [ ] **Step 3: Run the full baseline checks**

Run each command separately and record exit status and notable counts:

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

Expected: all PASS before structural implementation begins. If one fails on unmodified `main`, stop and fix it in a separate behavior/build task.

- [ ] **Step 4: Write the verification baseline**

Create `docs/architecture/baselines/2026-07-20-verification.md` with this structure and actual command results:

```markdown
# Repository Verification Baseline

**Commit:** `<git rev-parse HEAD>`
**Date:** 2026-07-20

| Command | Result | Notes |
|---|---|---|
| `pnpm test -- --run` | PASS | `<test file and test counts>` |
| `pnpm typecheck` | PASS | |
| `pnpm lint` | PASS | |
| `pnpm build:plugin-api` | PASS | |
| `pnpm check:plugin-api` | PASS | |
| `pnpm build:create-plugin` | PASS | |
| `pnpm smoke:create-plugin` | PASS | |
| `pnpm build` | PASS | |
| `pnpm test:rust` | PASS | `<test and ignored counts>` |

## Public Behavior Freeze

- Tauri command names and payload omission rules remain unchanged.
- Plugin JSON-RPC methods, fallback errors, and response shapes remain unchanged.
- Frontend SQL and driver-name branching remain unchanged during structural phases.
- Visible UI, state ownership, serialization, error wording, and timeouts remain unchanged.
```

- [ ] **Step 5: Write the SQL and driver-specific debt inventory**

Create `docs/architecture/baselines/2026-07-20-hardcoded-sql.md` with categorized entries and exact current paths for at least:

```markdown
# Frontend SQL and Driver-Specific Debt Baseline

## Semantic operations incorrectly expressed as frontend SQL
- `src/components/layout/sidebar/SidebarColumnItem.tsx`: drop-column DDL.
- `src/components/modals/NewRowModal.tsx`: referenced-table option query.
- `src/hooks/useReferencedRecord.ts`: referenced-row query.
- `src/components/modals/TriggerEditorModal.tsx`: trigger DDL and MySQL branch.

## SQL-mediated backend DDL
- `src/components/modals/CreateTableModal.tsx`
- `src/components/modals/CreateIndexModal.tsx`
- `src/components/modals/ModifyColumnModal.tsx`
- `src/components/modals/CreateForeignKeyModal.tsx`

## User-facing SQL generators requiring future capability review
- `src/utils/sqlGenerator.ts`
- `src/components/modals/GenerateSQLModal.tsx`
- `src/utils/clipboard.ts`
- `src/utils/geometryInput.ts`
- `src/utils/editor.ts`
- `src/utils/visualQuery.ts`

## Driver-name branching
- `src/utils/identifiers.ts`
- `src/utils/tableToolbar.ts`
- `src/utils/visualQuery.ts`

These entries are behavior canaries only. Remediation requires a separate approved design.
```

- [ ] **Step 6: Update ignore rules for living architecture files**

Ensure `.gitignore` ignores transient `.superpowers/` browser state while allowing versioned files under `docs/architecture/` and `docs/superpowers/{specs,plans}/`.

- [ ] **Step 7: Verify documentation is tracked and clean**

Run:

```bash
git check-ignore -v docs/architecture/baselines/2026-07-20-verification.md || true
git check-ignore -v docs/architecture/baselines/2026-07-20-hardcoded-sql.md || true
git diff --check
```

Expected: neither baseline document is excluded by an ignore rule; no whitespace errors.

- [ ] **Step 8: Commit when requested**

```bash
git add .gitignore docs/architecture/baselines
git commit -m "docs: capture modularization baseline"
```

### Task 2: Establish living architecture instructions

**Files:**
- Create: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/testing.md`
- Modify: `.rules/react.md`
- Modify: `.rules/rust.md`
- Modify: `.rules/typescript.md`
- Test: `tests/repository/architectureDocumentation.test.ts`

**Interfaces:**
- Consumes: approved design and baseline paths.
- Produces: canonical architecture document and short AI directives that every later task must follow.

- [ ] **Step 1: Write the failing architecture-document contract test**

Create `tests/repository/architectureDocumentation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const architecturePath = resolve(root, "docs/architecture/repository-structure.md");
const agentsPath = resolve(root, "AGENTS.md");

describe("living architecture documentation", () => {
  it("provides a canonical architecture reference linked by AGENTS.md", () => {
    expect(existsSync(architecturePath)).toBe(true);
    const architecture = readFileSync(architecturePath, "utf8");
    const agents = readFileSync(agentsPath, "utf8");
    expect(architecture).toContain("## Current enforced state");
    expect(architecture).toContain("## Target state");
    expect(architecture).toContain("## Temporary compatibility exceptions");
    expect(agents).toContain("docs/architecture/repository-structure.md");
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
pnpm test tests/repository/architectureDocumentation.test.ts -- --run
```

Expected: FAIL because the canonical document does not yet exist or lacks required headings.

- [ ] **Step 3: Write the canonical current/target document**

Create `docs/architecture/repository-structure.md` with these required sections:

```markdown
# Nexora Repository Structure

## Current enforced state

The desktop application currently owns root `src/`, `tests/`, `src-tauri/`, `public/`, and app-local Vite/Vitest/TypeScript/Tauri configuration. Root package scripts are the supported contributor and CI interface.

## Target state

The desktop product will own `apps/desktop/{src,tests,src-tauri,public}` and app-local configuration. Root will own workspace orchestration and `tests/repository/`. Packages own their source, tests, builds, and public entry points.

## Dependency direction

- Desktop may import package public entry points.
- Packages may not import desktop internals.
- Features may import `shared` and `platform`; shared modules may not import features.
- Cross-feature imports use explicit feature public entry points.
- Rust commands are transport adapters; domains own workflows; drivers own database semantics; infrastructure owns mechanisms.

## Test ownership

- Current TypeScript tests use root `tests/`; four documented colocated tests remain temporary exceptions.
- Target desktop TypeScript tests live in `apps/desktop/tests/` and mirror `apps/desktop/src/`.
- Root `tests/repository/` owns workspace/release contracts only.
- Rust unit tests use sibling `tests.rs`; crate integration tests use `src-tauri/tests/`.

## Temporary compatibility exceptions

| Exception | Reason | Removal phase |
|---|---|---|
| Root desktop paths | App has not moved yet | Desktop migration |
| Four frontend tests under `src/` | Existing convention debt | Test normalization |
| Crate-level Rust `*_tests.rs` | Existing convention debt | Test normalization |
| Inline Rust test modules | Existing convention debt | Test normalization |
| Existing deep imports and oversized files | Guard ratchet baseline | Frontend/backend modularization |

## Required verification

List the exact commands from `AGENTS.md`.
```

Do not describe target paths as currently usable.

- [ ] **Step 4: Update AI and focused rules**

Add a concise mandatory architecture section to `AGENTS.md` linking the canonical document and requiring same-PR updates when paths/rules change. Update focused `.rules/` files so they:

- point to the canonical architecture document;
- state current test paths until moved;
- preserve React Fast Refresh and state-ownership constraints;
- require Rust `tests.rs` for newly extracted modules;
- prohibit introducing new legacy exceptions.

- [ ] **Step 5: Run the contract and existing checks**

Run:

```bash
pnpm test tests/repository/architectureDocumentation.test.ts -- --run
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit when requested**

```bash
git add AGENTS.md .rules docs/architecture/repository-structure.md tests/repository/architectureDocumentation.test.ts
git commit -m "docs: define repository architecture rules"
```

### Task 3: Add architecture policy and checker

**Files:**
- Create: `architecture/policy.json`
- Create: `scripts/check-architecture.mjs`
- Create: `tests/repository/architecturePolicy.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: root command `pnpm check:architecture` and JSON policy keys `frontendTestRoots`, `forbiddenFrontendTestRoots`, `rustInlineTestAllowlist`, `allowedWorkspaceDependencies`, `fileSizeBaselines`.

- [ ] **Step 1: Write failing policy tests**

Create `tests/repository/architecturePolicy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const policy = JSON.parse(readFileSync(resolve(root, "architecture/policy.json"), "utf8")) as {
  frontendTestRoots: string[];
  forbiddenFrontendTestRoots: string[];
  allowedWorkspaceDependencies: Record<string, string[]>;
  fileSizeBaselines: Record<string, number>;
};

describe("architecture policy", () => {
  it("records current roots and target-protection rules", () => {
    expect(policy.frontendTestRoots).toContain("tests");
    expect(policy.forbiddenFrontendTestRoots).toContain("src");
    expect(policy.allowedWorkspaceDependencies["@nexora/plugin-api"]).toEqual([]);
    expect(policy.fileSizeBaselines["src/pages/Editor.tsx"]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm test tests/repository/architecturePolicy.test.ts -- --run
```

Expected: FAIL because `architecture/policy.json` does not exist.

- [ ] **Step 3: Create the ratcheted policy**

Create `architecture/policy.json` with current measured line-count baselines for large files and explicit allowlists for the four colocated frontend tests and current Rust test debt. Use repository-relative POSIX paths. Include:

```json
{
  "frontendTestRoots": ["tests", "packages/create-plugin/tests"],
  "forbiddenFrontendTestRoots": ["src"],
  "frontendTestAllowlist": [
    "src/components/ConnectionIconImage.test.tsx",
    "src/components/SocialLinks.test.tsx",
    "src/components/modals/NewConnectionModal/AppearanceSection.test.tsx",
    "src/utils/driverUI.test.tsx"
  ],
  "allowedWorkspaceDependencies": {
    "nexora": ["@nexora/plugin-api", "@nexora/create-plugin"],
    "@nexora/plugin-api": [],
    "@nexora/create-plugin": []
  },
  "fileSizeBaselines": {
    "src/pages/Editor.tsx": 0,
    "src/components/layout/ExplorerSidebar.tsx": 0,
    "src/components/modals/NewConnectionModal.tsx": 0,
    "src/components/ui/DataGrid.tsx": 0,
    "src/contexts/DatabaseProvider.tsx": 0,
    "src-tauri/src/commands.rs": 0
  }
}
```

Replace every `0` with the exact current line count measured at implementation time. Add a Rust inline-test allowlist generated from the current inventory; every entry must include a removal phase in the architecture document.

- [ ] **Step 4: Implement the dependency-free checker**

Create `scripts/check-architecture.mjs` using only `node:fs`, `node:path`, and `node:url`. It must:

- recursively walk tracked source roots while skipping `.git`, `.gitnexus`, `.superpowers`, `node_modules`, `dist`, `coverage`, and Rust `target`;
- fail on a new `*.test.*` or `*.spec.*` under forbidden production roots unless allowlisted;
- fail on `*.spec.*` anywhere;
- fail when a ratcheted file exceeds its stored line count;
- fail when a new source file exceeds soft thresholds: 500 lines for TS/TSX and 800 lines for Rust;
- verify workspace package dependencies against `allowedWorkspaceDependencies`;
- print one actionable violation per line and exit `1`, otherwise print `[architecture] OK`.

Expose pure functions from the module for tests:

```js
export function collectViolations(root, policy) { /* returns string[] */ }
export function countLines(content) { /* returns number */ }
```

Guard execution with:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = collectViolations(REPO_ROOT, policy);
  // print and set exit code
}
```

- [ ] **Step 5: Add root and CI commands**

Add to root `package.json`:

```json
"check:architecture": "node scripts/check-architecture.mjs"
```

Add a `Check architecture` step to `.github/workflows/ci.yml` immediately after install and before tests:

```yaml
- name: Check architecture
  run: pnpm check:architecture
```

- [ ] **Step 6: Verify the checker**

Run:

```bash
pnpm test tests/repository/architecturePolicy.test.ts -- --run
pnpm check:architecture
pnpm lint
```

Expected: PASS and `[architecture] OK`.

- [ ] **Step 7: Document policy ownership**

Update the living architecture document and `AGENTS.md` with the command, thresholds, allowlist-removal rule, and prohibition on increasing baselines.

- [ ] **Step 8: Commit when requested**

```bash
git add architecture scripts/check-architecture.mjs tests/repository/architecturePolicy.test.ts package.json .github/workflows/ci.yml docs/architecture/repository-structure.md AGENTS.md
git commit -m "ci: enforce architecture boundaries"
```

### Task 4: Add path and root-command contract tests

**Files:**
- Create: `tests/repository/workspaceLayout.test.ts`
- Create: `tests/repository/rootCommands.test.ts`
- Modify: `architecture/policy.json`

**Interfaces:**
- Produces: characterization tests that initially encode current root layout, then are deliberately updated in the desktop migration plan to encode `apps/desktop/`.

- [ ] **Step 1: Add current-layout contract**

Create `tests/repository/workspaceLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

describe("current workspace layout", () => {
  it("keeps the desktop application at the documented current paths", () => {
    expect(existsSync(resolve(root, "src/main.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "tests/setup.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src-tauri/Cargo.toml"))).toBe(true);
    expect(existsSync(resolve(root, "vite.config.ts"))).toBe(true);
  });
});
```

- [ ] **Step 2: Add root-command contract**

Create `tests/repository/rootCommands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const required = [
  "test",
  "typecheck",
  "lint",
  "build",
  "test:rust",
  "build:plugin-api",
  "check:plugin-api",
  "build:create-plugin",
  "smoke:create-plugin",
  "check:architecture",
];

describe("root command contract", () => {
  it.each(required)("exposes %s from the repository root", (name) => {
    expect(pkg.scripts[name]).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
```

Expected: PASS.

- [ ] **Step 4: Register repository test namespace in policy**

Add `tests/repository` as the sole documented root test exception and ensure the architecture checker rejects desktop-private imports from this namespace.

- [ ] **Step 5: Verify all foundation contracts**

```bash
pnpm test tests/repository -- --run
pnpm check:architecture
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit when requested**

```bash
git add tests/repository architecture/policy.json
git commit -m "test: characterize repository contracts"
```

### Task 5: Add high-risk frontend characterization coverage

**Files:**
- Modify/Test: `tests/pages/Editor.test.tsx`
- Modify/Test: `tests/components/layout/ExplorerSidebar.test.tsx`
- Modify/Test: existing New Connection tests under `tests/components/modals/`
- Modify/Test: existing DataGrid tests under `tests/components/ui/`
- Modify/Test: `tests/contexts/DatabaseProvider.test.tsx`
- Create only when no matching file exists: the mirrored smallest component/context test path.

**Interfaces:**
- Produces: behavior tests required before feature extraction; no production changes.

- [ ] **Step 1: Inventory exact existing test names**

Use content search to locate tests for Editor execution, Explorer selection, DataGrid operations, DatabaseProvider context tuples, and credential import. Record missing workflows in the task notes.

- [ ] **Step 2: Add Editor characterization cases**

Use existing Tauri mocks and render helpers. Add tests that assert both visible state and exact invocation payloads for:

- query execution with `connectionId`, `database`, and `schema`;
- stale previous selection followed by active selection;
- loading path and already-loaded path;
- batch mixed result and stop-on-error behavior;
- cancel query command and visible cancellation state.

Do not alter existing expectations.

- [ ] **Step 3: Run Editor tests**

```bash
pnpm test tests/pages/Editor.test.tsx -- --run
```

Expected: PASS.

- [ ] **Step 4: Add Explorer/DatabaseProvider characterization cases**

Assert the visible active database/schema/table after switching and exact context tuple passed to backend commands. Include stale previous database/schema data that remains visible while a new load is pending.

- [ ] **Step 5: Run context and Explorer tests**

```bash
pnpm test tests/contexts/DatabaseProvider.test.tsx tests/components/layout/ExplorerSidebar.test.tsx -- --run
```

Expected: PASS.

- [ ] **Step 6: Add DataGrid and credential workflow cases**

Cover filter/sort/page reconstruction, referenced-record payload, record mutation context, missing credential, retry/load with entered credential, save without unrelated validation, and final saved backend payload.

- [ ] **Step 7: Run affected suites and full frontend checks**

```bash
pnpm test tests/components/ui tests/components/modals -- --run
pnpm test -- --run
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit when requested**

Stage only changed tests and commit:

```bash
git commit -m "test: characterize frontend orchestration"
```

### Task 6: Add high-risk Rust/Tauri characterization coverage

**Files:**
- Test: existing query cancellation tests associated with `src-tauri/src/commands.rs`
- Test: `src-tauri/src/pool_manager_tests.rs`
- Test: `src-tauri/src/plugins/tests.rs`
- Test: `src-tauri/src/drivers/driver_trait_tests.rs`
- Test: smallest existing files covering connection resolution and command behavior
- Modify: `docs/architecture/baselines/2026-07-20-verification.md`

**Interfaces:**
- Produces: behavior freeze for cancellation, pool keys, plugin RPC, driver delegation, and command registration.

- [ ] **Step 1: Run narrow Rust baselines**

Run module filters discovered from current test names:

```bash
pnpm test:rust -- commands
pnpm test:rust -- pool_manager
pnpm test:rust -- plugins
pnpm test:rust -- driver_trait
```

Expected: PASS. If Cargo filtering differs, run `cargo test <module_path>` from `src-tauri` and record exact successful commands.

- [ ] **Step 2: Add cancellation and resolution characterization**

Add tests for:

- registering, finding, canceling, and cleaning query cancellation entries;
- connection lookup preserving explicit database/schema context;
- missing connection and unsupported operation errors preserving exact current wording;
- batch query call ordering and stop behavior.

Place new tests according to current conventions in this phase; test placement is normalized later.

- [ ] **Step 3: Add pool and plugin characterization**

Cover:

- pool-key construction and removal selecting the intended connection/database;
- plugin initialization error suppression;
- JSON-RPC `-32601` method fallback as currently exposed;
- startup failure and process cleanup;
- driver registry delegation and capability defaults.

- [ ] **Step 4: Run focused and full Rust tests**

```bash
pnpm test:rust
```

Expected: PASS with unchanged ignored-test count unless a new non-ignored unit test was added.

- [ ] **Step 5: Update baseline counts**

Update the verification baseline with new test counts while retaining the original pre-refactor command results and noting that characterization coverage was added without production changes.

- [ ] **Step 6: Commit when requested**

```bash
git add src-tauri docs/architecture/baselines/2026-07-20-verification.md
git commit -m "test: characterize Tauri orchestration"
```

### Task 7: Run the foundation release gate

**Files:**
- Modify only if checks expose documentation/config inconsistency: `docs/architecture/repository-structure.md`, `AGENTS.md`, `architecture/policy.json`.

- [ ] **Step 1: Run repository contracts and architecture checks**

```bash
pnpm test tests/repository -- --run
pnpm check:architecture
```

Expected: PASS.

- [ ] **Step 2: Run all CI-equivalent checks**

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

Expected: PASS.

- [ ] **Step 3: Verify GitNexus changed-flow scope**

Run detect changes against `main`. Expected: documentation, test, guard, and CI flows only; no production runtime process should be behaviorally modified.

- [ ] **Step 4: Record the phase completion**

In `docs/architecture/repository-structure.md`, mark foundation guards as current enforced state and retain root desktop paths as current until the next plan.

- [ ] **Step 5: Commit when requested**

```bash
git add docs/architecture/repository-structure.md
git commit -m "docs: mark modularization foundation complete"
```
