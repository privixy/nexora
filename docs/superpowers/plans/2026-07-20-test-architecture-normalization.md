# Test Architecture Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize Nexora's frontend, repository, and Rust test placement after the desktop application has moved to `apps/desktop/`, without changing production logic or existing test intent.

**Architecture:** Give the desktop workspace ownership of mirrored frontend tests and test setup, retain only workspace/release contracts in root `tests/repository/`, and normalize Rust unit tests behind module-local `#[cfg(test)] mod tests;` declarations. Execute pure test moves before suite decomposition, rank Rust batches by coupling and size, classify external-infrastructure integration tests separately from path-only moves, and ratchet architecture exceptions downward after every batch.

**Tech Stack:** pnpm workspaces, TypeScript 5.9, React 19, Vitest 4, React Testing Library, Rust 2021, Cargo, Tauri 2, Node.js architecture guards.

## Global Constraints

- Begin from a branch where the desktop application, frontend tests, app-local configuration, and Rust crate already live under `apps/desktop/`; do not combine this plan with the desktop path migration.
- Follow the Standard Task Gate in `docs/superpowers/plans/2026-07-20-repository-modularization-master.md` for every task.
- Do not change production logic, public interfaces, command names, payloads, serialization, SQL, driver semantics, capabilities, UI behavior, state ownership, errors, timeouts, plugin JSON-RPC, or dependency direction.
- Preserve every existing frontend `describe`/`it` name, Rust test function name, assertion, mock, fixture, ignored marker, and test body unless Task 6 performs the three exact owner-local import-only repairs or Task 12 explicitly adds an external-infrastructure precondition in a separate non-path-only batch.
- A Rust test's module-qualified Cargo path may change only because ownership moves from a crate-level module to its production module; its leaf test function name must remain unchanged.
- Use only `*.test.ts` and `*.test.tsx` for frontend and repository tests; do not introduce `*.spec.*`.
- Use `git mv` for path-only moves. Do not split an existing suite while moving it. Only owner-relative import repairs explicitly authorized in a task may accompany a move. Oversized suites move intact and may be split only in a later plan.
- Use module-local `tests.rs` for one Rust unit suite. Use `tests.rs` plus a `tests/` directory only when preserving multiple already-distinct suites for the same production module.
- Never expose private production helpers merely to make a moved test compile. Module-local tests must use `super::*`, `super::super::*`, or existing `crate::` paths as appropriate.
- Remove, never add or widen, architecture-policy exceptions during normalization. If a batch cannot remove its exact exception, stop and investigate.
- `tests/repository/releaseWorkflow.test.ts` and `tests/repository/releaseDryRunWorkflow.test.ts` are final outputs of the desktop migration. Keep them at those paths throughout this plan; later tasks may test or update their workflow assertions but must never move them again.
- Update `docs/architecture/repository-structure.md`, `AGENTS.md`, `.rules/testing.md`, `.rules/rust.md`, and `architecture/policy.json` only to describe the state actually enforced by that batch.
- Run narrow tests before and after each batch. Before Task 4 creates named Vitest projects, invoke Vitest through the dependency-owning desktop package with `pnpm --filter @nexora/desktop exec vitest --config vitest.config.ts ...`; do not pass `--project desktop` or `--project repository`. After Task 4, use the named root projects. Run `pnpm typecheck` and root-owned `pnpm lint` after TypeScript/config changes, and `pnpm test:rust` after Rust changes. The desktop migration keeps `eslint.config.js`, `lint: eslint .`, and its six ESLint packages at root; normalization must not move or duplicate them.
- Do not commit unless the user explicitly requests it. Each task includes an optional commit boundary and suggested message, but implementation must stop before `git add`/`git commit` without that request.
- Before editing any function, class, method, or module declaration, refresh GitNexus if necessary and run upstream impact analysis. Report and pause on HIGH or CRITICAL risk.

---

## File and Ownership Map

### Frontend tests

| Source after desktop move | Canonical destination |
|---|---|
| `apps/desktop/src/components/ConnectionIconImage.test.tsx` | `apps/desktop/tests/components/ConnectionIconImage.test.tsx` |
| `apps/desktop/src/components/SocialLinks.test.tsx` | `apps/desktop/tests/components/SocialLinks.test.tsx` |
| `apps/desktop/src/components/modals/NewConnectionModal/AppearanceSection.test.tsx` | `apps/desktop/tests/components/modals/NewConnectionModal/AppearanceSection.test.tsx` |
| `apps/desktop/src/utils/driverUI.test.tsx` | `apps/desktop/tests/utils/driverUI.test.tsx` |
| `apps/desktop/tests/layout/rootOverflow.test.ts` | `apps/desktop/tests/repository/rootOverflow.test.ts` |
| `apps/desktop/tests/version.test.ts` | unchanged; it mirrors `apps/desktop/src/version.ts` |

### Root repository tests

The only root test namespace is `tests/repository/`. It owns these suites after normalization:

- `tests/repository/architectureDocumentation.test.ts`
- `tests/repository/architecturePolicy.test.ts`
- `tests/repository/rootCommands.test.ts`
- `tests/repository/workspaceLayout.test.ts`
- `tests/repository/releaseWorkflow.test.ts`
- `tests/repository/releaseDryRunWorkflow.test.ts`
- `tests/repository/pluginApiSyncPaths.test.ts`
- `tests/repository/versionSyncPaths.test.ts`
- `tests/repository/ciWorkspacePaths.test.ts`
- `tests/repository/packagingPaths.test.ts`
- `tests/repository/testArchitecture.test.ts`

The first four are produced by the foundation plan. The desktop migration moves the release suites directly from root `tests/` to these final paths, then creates the plugin API, version-sync, CI-workspace, and packaging contracts in place under `tests/repository/`; this plan never moves any of those six migration-owned suites. Tasks 3, 4, and 13 may continue testing or updating their assertions in place. `testArchitecture.test.ts` is added in this plan as the structural regression suite. Every root repository suite derives the repository root from `import.meta.url`; none relies on the caller's `process.cwd()`. Desktop-wide `rootOverflow.test.ts` likewise derives `apps/desktop` from `dirname(fileURLToPath(import.meta.url))`, never `process.cwd()` or `import.meta.dirname`.

### Test configuration

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Root Vitest project aggregator and root `tests/repository/` project. |
| `apps/desktop/vitest.config.ts` | Desktop aliases, JSDOM, setup, mirrored frontend test discovery, and desktop coverage. |
| `apps/desktop/tests/setup.ts` | Desktop-only browser, Tauri, Monaco, and icon mocks. |
| `package.json` | Stable root orchestration commands, root Vitest CLI, and root-owned ESLint tooling. |
| `apps/desktop/package.json` | Desktop-owned test and coverage commands. |

### Crate-level `*_tests.rs` normalization

| Existing source under `apps/desktop/src-tauri/src/` | Canonical module-local destination |
|---|---|
| `ai_activity_tests.rs` | `ai_activity/tests.rs` |
| `ai_approval_tests.rs` | `ai_approval/tests.rs` |
| `ai_notebook_export_tests.rs` | `ai_notebook_export/tests.rs` |
| `ai_schema_context_tests.rs` | `ai_schema_context/tests.rs` |
| `connection_appearance_tests.rs` | `connection_appearance/tests.rs` |
| `connection_cache_tests.rs` | `connection_cache/tests.rs` |
| `connection_window_tests.rs` | `connection_window/tests.rs` |
| `dump_commands_tests.rs` | `dump_commands/tests.rs` |
| `explain_import_tests.rs` | `explain_import/tests.rs` |
| `export_import_tests.rs` | `commands/tests/export_import.rs` |
| `group_tree_tests.rs` | `commands/tests/group_tree.rs` |
| `heartbeat_tests.rs` | `heartbeat/tests.rs` |
| `models_tests.rs` | `models/tests.rs` |
| `pool_manager_tests.rs` | `pool_manager/tests.rs` |
| `query_history_tests.rs` | `query_history/tests.rs` |
| `saved_queries_tests.rs` | `saved_queries/tests.rs` |
| `updater_tests.rs` | `updater/tests/registration.rs` |
| `window_title_tests.rs` | `window_title/tests.rs` |
| `drivers/driver_trait_tests.rs` | `drivers/driver_trait/tests.rs` |
| `drivers/mysql/stmt_classify_tests.rs` | `drivers/mysql/stmt_classify/tests.rs` |
| `connection_import/importer_tests.rs` | `connection_import/tests/importers.rs` |

`apps/desktop/src-tauri/src/lib.rs` stops declaring test-only peer modules. Each owning production module declares `#[cfg(test)] mod tests;`. `drivers/driver_trait.rs` and `drivers/mysql/stmt_classify.rs` privately declare their own `tests`; the existing `drivers/mysql/tests.rs` remains the separate driver-wide suite. `connection_import/tests.rs` declares `mod importers;` alongside the inline tests extracted from `connection_import/mod.rs`, so importer fixture coverage and module-helper coverage share the same owner without overwriting one another. Task 11 creates `commands/tests.rs` from the inline command suite, then declares `mod export_import;` and `mod group_tree;`; `updater/tests.rs` declares `mod registration;` while retaining the existing inline updater suite intact when that suite moves in Task 9.

### Inline Rust test normalization

Move each complete inline `mod tests { ... }` body into the listed module-local file. Do not split nested test groups or rename leaf tests.

| Risk | Production source | Destination |
|---|---|---|
| Low | `paths.rs` | `paths/tests.rs` |
| Low | `connection_params.rs` | `connection_params/tests.rs` |
| Low | `results_window.rs` | `results_window/tests.rs` |
| Low | `json_viewer.rs` | `json_viewer/tests.rs` |
| Low | `dump_commands.rs` | existing `dump_commands/tests.rs` |
| Low | `connection_import/driver_map.rs` | `connection_import/driver_map/tests.rs` |
| Low | `connection_import/crypto.rs` | `connection_import/crypto/tests.rs` |
| Low | `connection_import/datagrip/jdbc.rs` | `connection_import/datagrip/jdbc/tests.rs` |
| Low | `connection_import/mod.rs` | `connection_import/tests.rs` |
| Medium | `connection_import/analyzer.rs` | `connection_import/analyzer/tests.rs` |
| Medium | `connection_import/convert.rs` | `connection_import/convert/tests.rs` |
| Medium | `ai.rs` | `ai/tests.rs` |
| Medium | `config.rs` | `config/tests.rs` |
| Medium | `dump_utils.rs` | `dump_utils/tests.rs` |
| Medium | `k8s_tunnel.rs` | `k8s_tunnel/tests.rs` |
| Medium | `mcp/install.rs` | `mcp/install/tests.rs` |
| Medium | `updater.rs` | `updater/tests.rs` plus existing `updater/tests/registration.rs` |
| Medium | `drivers/postgres/extract/enum.rs` | `drivers/postgres/extract/enum/tests.rs` |
| Medium | `drivers/postgres/extract/composite.rs` | `drivers/postgres/extract/composite/tests.rs` |
| Medium | `drivers/postgres/extract/multi_range.rs` | `drivers/postgres/extract/multi_range/tests.rs` |
| Medium | `drivers/postgres/extract/array.rs` | `drivers/postgres/extract/array/tests.rs` |
| Medium | `drivers/postgres/extract/range.rs` | `drivers/postgres/extract/range/tests.rs` |
| High | `plugins/driver.rs` | `plugins/driver/tests.rs` |
| High | `drivers/postgres/extract/simple.rs` | `drivers/postgres/extract/simple/tests.rs` |
| Critical | `commands.rs` | create `commands/tests.rs`, then move peers to `commands/tests/{export_import,group_tree}.rs` |

Existing canonical suites such as `drivers/mysql/tests.rs`, `drivers/postgres/tests.rs`, `drivers/sqlite/tests.rs`, `export/tests.rs`, `mcp/tests.rs`, `plugins/tests.rs`, and `ssh_tunnel/tests.rs` are not moved or reformatted by this plan.

---

### Task 1: Freeze the post-move inventory and baseline

**Files:**
- Inspect: `apps/desktop/src/**/*.{test,spec}.{ts,tsx}`
- Inspect: `apps/desktop/tests/**/*.{test,spec}.{ts,tsx}`
- Inspect: `tests/repository/**/*.test.ts`
- Inspect: `apps/desktop/src-tauri/src/**/*.rs`
- Inspect: `apps/desktop/src-tauri/tests/**/*.rs`
- Modify only if current-state text is stale: `docs/architecture/repository-structure.md`

**Interfaces:**
- Consumes: completed desktop path migration and foundation architecture policy.
- Produces: immutable before-move frontend and Rust test-name inventories in `/tmp`; no repository artifact.

- [ ] **Step 1: Inspect branch state and verify the prerequisite layout**

Run:

```bash
git status --short --branch
git log --oneline -10
test -d apps/desktop/src
test -d apps/desktop/tests
test -d apps/desktop/src-tauri
test -f architecture/policy.json
test -f scripts/check-architecture.mjs
```

Expected: all `test` commands exit `0`; no unrelated user changes overlap this plan. If the desktop remains at root, stop and execute the desktop migration plan first.

- [ ] **Step 2: Refresh and query GitNexus**

Run the repository's indexed analyzer if `gitnexus://repo/nexora/context` is stale or the LadybugDB version is incompatible:

```bash
node .gitnexus/run.cjs analyze
```

Expected: analysis completes and GitNexus query/context tools can read `nexora`. Query for test architecture and Rust module declarations; record affected processes in task notes. This task edits no symbols, so upstream symbol impact begins with the first declaration-changing task.

- [ ] **Step 3: Record tracked test paths and forbidden naming**

Run:

```bash
git ls-files 'apps/desktop/src/**/*.test.ts' 'apps/desktop/src/**/*.test.tsx' 'apps/desktop/src/**/*.spec.ts' 'apps/desktop/src/**/*.spec.tsx' > /tmp/nexora-frontend-source-tests.before
git ls-files 'apps/desktop/tests/**/*.test.ts' 'apps/desktop/tests/**/*.test.tsx' 'tests/repository/**/*.test.ts' > /tmp/nexora-frontend-tests.before
git ls-files 'apps/desktop/src-tauri/src/*_tests.rs' 'apps/desktop/src-tauri/src/**/*_tests.rs' | sort -u > /tmp/nexora-rust-peer-tests.before
git ls-files 'apps/desktop/src-tauri/tests/**/*.rs' > /tmp/nexora-rust-integration-tests.before
python - <<'PY' > /tmp/nexora-frontend-nonmirrors.before
from pathlib import Path

root = Path("apps/desktop")
for test in sorted((root / "tests").rglob("*.test.*")):
    relative = test.relative_to(root / "tests")
    if relative.parts[0] == "repository":
        continue
    source_name = relative.name.replace(".test.tsx", ".tsx").replace(".test.ts", ".ts")
    candidate = root / "src" / relative.parent / source_name
    alternates = [candidate, candidate.with_suffix(".tsx"), candidate.with_suffix(".ts")]
    if not any(path.is_file() for path in alternates):
        print(test.as_posix())
PY
```

Expected: the source-test inventory contains exactly the four frontend paths in the File and Ownership Map; no `*.spec.*` path exists; the peer-test inventory contains exactly the 21 listed `*_tests.rs` files, including `drivers/driver_trait_tests.rs`, `drivers/mysql/stmt_classify_tests.rs`, and `connection_import/importer_tests.rs`. The non-mirror inventory contains exactly `apps/desktop/tests/components/SlotAnchor.test.tsx`, `apps/desktop/tests/utils/minimax.test.ts`, and `apps/desktop/tests/utils/sqlSplitter/dialects.test.ts`; `rootOverflow.test.ts` is excluded by its repository namespace. The two release suites already appear under `tests/repository/`, with no copies under `apps/desktop/tests/`.

- [ ] **Step 4: Capture frontend suite names**

Run:

```bash
pnpm --filter @nexora/desktop exec vitest list --config vitest.config.ts > /tmp/nexora-vitest-tests.before
```

Expected: exits `0` and lists the existing four colocated suites as well as all already-mirrored desktop suites.

- [ ] **Step 5: Capture Rust unit and ignored integration test names**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib -- --list > /tmp/nexora-rust-unit-tests.before
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test integration_tests -- --list > /tmp/nexora-rust-integration-names.before
```

Expected: both commands exit `0`; the integration inventory contains the nine existing ignored database tests. Do not run ignored integration tests in this baseline task.

- [ ] **Step 6: Run the complete pre-normalization baseline**

Run:

```bash
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
pnpm test:rust
```

Expected: PASS and `[architecture] OK`. If the unmodified branch fails, stop and fix it in a separate task rather than normalizing the failure into a structural diff.

- [ ] **Step 7: Do not commit**

Expected: this inventory task has no repository changes. Do not commit `/tmp` artifacts.

---

### Task 2: Move the four exact colocated frontend tests into the desktop mirror

**Files:**
- Move: `apps/desktop/src/components/ConnectionIconImage.test.tsx` → `apps/desktop/tests/components/ConnectionIconImage.test.tsx`
- Move: `apps/desktop/src/components/SocialLinks.test.tsx` → `apps/desktop/tests/components/SocialLinks.test.tsx`
- Move: `apps/desktop/src/components/modals/NewConnectionModal/AppearanceSection.test.tsx` → `apps/desktop/tests/components/modals/NewConnectionModal/AppearanceSection.test.tsx`
- Move: `apps/desktop/src/utils/driverUI.test.tsx` → `apps/desktop/tests/utils/driverUI.test.tsx`
- Modify: `architecture/policy.json`
- Modify: `tests/repository/architecturePolicy.test.ts`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Consumes: desktop alias `@` resolving to `apps/desktop/src`.
- Produces: four mirrored suites and an empty `frontendTestAllowlist`.

- [ ] **Step 1: Run upstream impact for imported production symbols**

Analyze `ConnectionIconImage`, `SocialLinks`, `AppearanceSection`, `getConnectionAccent`, and `getConnectionIcon` upstream. Expected: only test imports change; no production symbol changes. Report HIGH or CRITICAL results before continuing.

- [ ] **Step 2: Run the four source-path suites before moving them**

Run:

```bash
pnpm --filter @nexora/desktop exec vitest run --config vitest.config.ts src/components/ConnectionIconImage.test.tsx src/components/SocialLinks.test.tsx src/components/modals/NewConnectionModal/AppearanceSection.test.tsx src/utils/driverUI.test.tsx
```

Expected: PASS with 36 tests total: 2, 2, 18, and 14 respectively.

- [ ] **Step 3: Tighten the architecture-policy expectation first**

Update `tests/repository/architecturePolicy.test.ts` so its frontend test placement case requires:

```ts
expect(policy.frontendTestRoots).toContain("apps/desktop/tests");
expect(policy.forbiddenFrontendTestRoots).toContain("apps/desktop/src");
expect(policy.frontendTestAllowlist).toEqual([]);
```

Run:

```bash
pnpm test tests/repository/architecturePolicy.test.ts -- --run
```

Expected: FAIL because `architecture/policy.json` still permits the four colocated files. This migration-compatible command delegates to the dependency-owning desktop package; named projects do not exist yet.

- [ ] **Step 4: Move the four suites with Git and change imports only**

Run:

```bash
git mv apps/desktop/src/components/ConnectionIconImage.test.tsx apps/desktop/tests/components/ConnectionIconImage.test.tsx
git mv apps/desktop/src/components/SocialLinks.test.tsx apps/desktop/tests/components/SocialLinks.test.tsx
git mv apps/desktop/src/components/modals/NewConnectionModal/AppearanceSection.test.tsx apps/desktop/tests/components/modals/NewConnectionModal/AppearanceSection.test.tsx
git mv apps/desktop/src/utils/driverUI.test.tsx apps/desktop/tests/utils/driverUI.test.tsx
```

Change only production-module and mock paths:

```ts
import { ConnectionIconImage } from "@/components/ConnectionIconImage";
import { SocialLinks } from "@/components/SocialLinks";
import { SOCIAL_LINKS } from "@/config/socialLinks";
import { LINKS } from "@/config/links";
import { AppearanceSection } from "@/components/modals/NewConnectionModal/AppearanceSection";
import { getConnectionAccent, getConnectionIcon } from "@/utils/driverUI";
import { camelToKebab, getLucideIconComponent, CONNECTION_ICON_PACK } from "@/utils/connectionIconPack";
import type { SavedConnection } from "@/contexts/DatabaseContext";
import type { PluginManifest } from "@/types/plugins";
```

Change the driver UI mock key to:

```ts
vi.mock("@/components/ConnectionIconImage", () => ({
```

Expected: all `describe`/`it` names, assertions, fixtures, and mock implementations remain byte-for-byte equivalent apart from import/mock specifiers.

- [ ] **Step 5: Remove the four policy exceptions**

Set the policy to the enforced post-move state:

```json
"frontendTestRoots": ["apps/desktop/tests", "tests/repository", "packages/create-plugin/tests"],
"forbiddenFrontendTestRoots": ["apps/desktop/src"],
"frontendTestAllowlist": []
```

Update `docs/architecture/repository-structure.md` to remove the four-file temporary exception and state that desktop tests mirror `apps/desktop/src` under `apps/desktop/tests`.

- [ ] **Step 6: Run the moved suites and guard**

Run:

```bash
pnpm --filter @nexora/desktop exec vitest run --config vitest.config.ts tests/components/ConnectionIconImage.test.tsx tests/components/SocialLinks.test.tsx tests/components/modals/NewConnectionModal/AppearanceSection.test.tsx tests/utils/driverUI.test.tsx
pnpm test tests/repository/architecturePolicy.test.ts -- --run
pnpm check:architecture
pnpm typecheck
pnpm lint
```

Expected: all PASS; 36 frontend tests retain their names; `[architecture] OK`; no frontend test remains under `apps/desktop/src`.

- [ ] **Step 7: Review the move and optionally commit only when requested**

Run:

```bash
git diff --check
git status --short
git diff --stat
git diff --find-renames
```

Expected: four renames plus import-only edits, the policy ratchet, its contract test, and current-state documentation. If explicitly requested, run GitNexus change detection and commit with `test: move desktop tests out of source`.

---

### Task 3: Normalize the remaining desktop-specific test namespace

**Files:**
- Keep/Test: `tests/repository/releaseWorkflow.test.ts`
- Keep/Test: `tests/repository/releaseDryRunWorkflow.test.ts`
- Move: `apps/desktop/tests/layout/rootOverflow.test.ts` → `apps/desktop/tests/repository/rootOverflow.test.ts`
- Keep: `apps/desktop/tests/version.test.ts`
- Modify: `architecture/policy.json`
- Modify: `tests/repository/workspaceLayout.test.ts`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Consumes: release suites already at their final root-owned paths from the desktop migration; desktop ownership of layout and version behavior.
- Produces: root `tests/repository/` as the sole root namespace and desktop `tests/repository/` for non-mirrored desktop contracts, without re-moving release tests.

- [ ] **Step 1: Run each suite at its post-migration path**

Run:

```bash
pnpm test tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts -- --run
pnpm --filter @nexora/desktop exec vitest run --config vitest.config.ts tests/layout/rootOverflow.test.ts
```

Expected: PASS with unchanged suite names. Stop if either release suite is absent from `tests/repository/`; repair the prerequisite desktop migration rather than moving a copy in this plan.

- [ ] **Step 2: Add the failing remaining-move assertion and immutable release-path assertions**

Extend `tests/repository/workspaceLayout.test.ts` with exact ownership assertions:

```ts
expect(existsSync(resolve(root, "tests/repository/releaseWorkflow.test.ts"))).toBe(true);
expect(existsSync(resolve(root, "tests/repository/releaseDryRunWorkflow.test.ts"))).toBe(true);
expect(existsSync(resolve(root, "apps/desktop/tests/releaseWorkflow.test.ts"))).toBe(false);
expect(existsSync(resolve(root, "apps/desktop/tests/releaseDryRunWorkflow.test.ts"))).toBe(false);
expect(existsSync(resolve(root, "apps/desktop/tests/repository/rootOverflow.test.ts"))).toBe(true);
expect(existsSync(resolve(root, "apps/desktop/tests/version.test.ts"))).toBe(true);
```

Run:

```bash
pnpm test tests/repository/workspaceLayout.test.ts -- --run
```

Expected: FAIL only because `rootOverflow.test.ts` has not reached its destination; the four release ownership assertions already pass.

- [ ] **Step 3: Move only the desktop-wide layout suite without changing test names or assertions**

Run:

```bash
git mv apps/desktop/tests/layout/rootOverflow.test.ts apps/desktop/tests/repository/rootOverflow.test.ts
```

Do not move or rewrite either release suite. In `rootOverflow.test.ts`, preserve the desktop-migration file-URL ownership and change only the destination path:

```ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(resolve(desktopRoot, "src/index.css"), "utf8");
const html = readFileSync(resolve(desktopRoot, "index.html"), "utf8");
```

Because both `tests/layout/` and `tests/repository/` are two levels below `apps/desktop`, the same `../..` derivation remains valid across the move. Do not use `process.cwd()` or `import.meta.dirname`. Do not move `version.test.ts`; it already mirrors `src/version.ts`.

- [ ] **Step 4: Update policy and documentation**

Set or retain these policy values:

```json
"repositoryTestRoots": ["tests/repository", "apps/desktop/tests/repository"],
"rootTestRoots": ["tests/repository"],
"rootRepositoryTestForbiddenImports": ["apps/desktop/src", "@/"]
```

Document that root repository tests may inspect files but may not import desktop-private modules. Document `apps/desktop/tests/repository/` as the exception for desktop contracts that do not mirror one source file.

- [ ] **Step 5: Run both ownership scopes**

Run:

```bash
pnpm test tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts tests/repository/workspaceLayout.test.ts -- --run
pnpm --filter @nexora/desktop exec vitest run --config vitest.config.ts tests/repository/rootOverflow.test.ts tests/version.test.ts
pnpm check:architecture
pnpm typecheck
pnpm lint
```

Expected: PASS; release assertions remain unchanged; layout and version remain desktop-owned; `[architecture] OK`.

- [ ] **Step 6: Review and optionally commit only when requested**

Expected: one rename, path-resolution-only edits to `rootOverflow.test.ts`, in-place verification of both release suites, the policy/docs ratchet, and no release-test diff. If explicitly requested, run GitNexus change detection and commit with `test: normalize desktop repository test namespace`.

---

### Task 4: Mirror Vitest ownership and preserve root test orchestration

**Files:**
- Modify: `vitest.config.ts`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `package.json`
- Modify: `apps/desktop/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tests/repository/testArchitecture.test.ts`
- Modify: `tests/repository/rootCommands.test.ts`
- Modify: `.rules/testing.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: Vitest projects named `repository` and `desktop`; a root-owned Vitest orchestration dependency recorded in `package.json`/`pnpm-lock.yaml`; updated `rootCommands.test.ts`; root `pnpm test -- --run`; focused `--project` commands; desktop-owned setup and coverage; unchanged root lint ownership.

- [ ] **Step 1: Write the failing configuration contract**

Create `tests/repository/testArchitecture.test.ts` with these structural checks:

```ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("test architecture", () => {
  it("keeps root tests in the repository namespace", () => {
    expect(existsSync(resolve(repoRoot, "tests/repository"))).toBe(true);
    expect(read("vitest.config.ts")).toContain('name: "repository"');
    expect(read("vitest.config.ts")).toContain('"./apps/desktop/vitest.config.ts"');
  });

  it("keeps desktop tests and setup inside the desktop workspace", () => {
    const config = read("apps/desktop/vitest.config.ts");
    expect(config).toContain('name: "desktop"');
    expect(config).toContain('setupFiles: ["./tests/setup.ts"]');
    expect(config).toContain('include: ["tests/**/*.{test.ts,test.tsx}"]');
    expect(config).not.toContain('src/**/*.{test,spec}');
  });
});
```

Run:

```bash
pnpm test tests/repository/testArchitecture.test.ts -- --run
```

Expected: FAIL until the root aggregator and desktop-only include are configured. This is the final pre-project command in the plan; all later Vitest commands may use the named projects created in the next steps.

- [ ] **Step 2: Configure the root project aggregator**

Make root `vitest.config.ts` aggregate only root repository tests and the desktop config:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "repository",
          environment: "node",
          include: ["tests/repository/**/*.test.ts"],
        },
      },
      "./apps/desktop/vitest.config.ts",
    ],
  },
});
```

Expected: root configuration contains no desktop alias, JSDOM setup, or desktop coverage rules.

- [ ] **Step 3: Configure the desktop project mirror**

Retain the existing React plugin, alias, environment, setup, and coverage behavior in `apps/desktop/vitest.config.ts`, but make ownership explicit:

```ts
/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    name: "desktop",
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test.ts,test.tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts", "src/test/**"],
    },
  },
});
```

Do not duplicate or relocate setup mocks; `apps/desktop/tests/setup.ts` remains their sole owner.

- [ ] **Step 4: Preserve root and workspace commands with explicit dependency and coverage ownership**

Add root `devDependencies.vitest` with the exact version range already owned by `apps/desktop/package.json`; do not duplicate React, JSDOM, coverage-provider, or desktop plugin dependencies at root. Update `pnpm-lock.yaml` with `pnpm install --lockfile-only` so the root importer adds Vitest to its existing orchestration, changelog, and ESLint ownership.

Set root `package.json` to:

```json
"test": "vitest --config vitest.config.ts",
"test:coverage": "pnpm --filter @nexora/desktop test:coverage",
"test:repository": "vitest --config vitest.config.ts --project repository",
"test:desktop": "vitest --config vitest.config.ts --project desktop"
```

Update `tests/repository/rootCommands.test.ts` in the same step to assert these exact four scripts, replacing the desktop-migration expectation that root `test` delegates to `@nexora/desktop`. Keep its command-level regression, but have the child execute the new root `test` script and assert that `tests/repository/workspaceLayout.test.ts` exits `0`. Retain the desktop-migration assertions for root-owned `"lint": "eslint ."`, all six root ESLint packages, and their absence from `apps/desktop/package.json`; normalization changes test ownership, not lint ownership.

Ensure `apps/desktop/package.json` owns:

```json
"test": "vitest --config vitest.config.ts",
"test:coverage": "vitest run --config vitest.config.ts --coverage"
```

Coverage stays delegated to the dependency-owning desktop config because Vitest coverage is process-wide and is not inherited from a project config selected by the root aggregator. Do not move desktop coverage options into the repository project and do not change unrelated root orchestration scripts. Root `pnpm lint` must remain directly runnable through root-owned ESLint tooling.

- [ ] **Step 5: Update contributor rules**

Update `.rules/testing.md`, `AGENTS.md`, and `docs/architecture/repository-structure.md` with exact commands and ownership, including root ownership of the Vitest aggregator and ESLint tooling:

```text
pnpm test -- --run
pnpm test:repository -- --run
pnpm test:desktop -- --run
pnpm test:coverage
pnpm lint
pnpm exec vitest run --project repository tests/repository/<file>.test.ts
pnpm exec vitest run --project desktop apps/desktop/tests/<mirror>.test.tsx
```

Remove root-era statements claiming that `tests/` mirrors root `src/` or that setup lives at root `tests/setup.ts`.

- [ ] **Step 6: Verify discovery, coverage ownership, typing, and lint**

Run:

```bash
pnpm exec vitest list --project repository
pnpm exec vitest list --project desktop
pnpm exec vitest run --project repository tests/repository/testArchitecture.test.ts tests/repository/rootCommands.test.ts
pnpm test -- --run
pnpm test:coverage
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: root project lists only `tests/repository`; desktop project lists only `apps/desktop/tests`; all tests PASS; the updated root-command contract and child-process regression in `rootCommands.test.ts` exit `0` through the root aggregator; desktop coverage reads only `apps/desktop/src`; the root importer owns Vitest plus its existing orchestration/changelog/ESLint tools, the desktop importer owns desktop test/runtime tooling, `pnpm lint` resolves its root config imports, and `[architecture] OK`.

- [ ] **Step 7: Review and optionally commit only when requested**

Expected: configuration/orchestration/docs changes only. If explicitly requested, run GitNexus change detection and commit with `test: separate repository and desktop vitest projects`.

---

### Task 5: Normalize low-risk crate-level Rust peer suites

**Files:**
- Move: `apps/desktop/src-tauri/src/{ai_schema_context,connection_window,models,saved_queries,window_title}_tests.rs`
- Create via move: `apps/desktop/src-tauri/src/{ai_schema_context,connection_window,models,saved_queries,window_title}/tests.rs`
- Modify: the five corresponding production module files
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `architecture/policy.json`
- Modify: `tests/repository/testArchitecture.test.ts`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: five module-local suites loaded privately as `tests`; removes five public test-only crate modules.

- [ ] **Step 1: Analyze declaration impact and run the narrow baseline**

Run upstream impact for the five module declarations in `lib.rs` and their production modules. Then run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml ai_schema_context_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_window_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml models_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml saved_queries_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml window_title_tests -- --nocapture
```

Expected: PASS before movement.

- [ ] **Step 2: Tighten the crate-peer inventory to the exact first ratchet**

Extend `testArchitecture.test.ts` to enumerate tracked Rust source files recursively and compare them with an exact sorted `expectedRustPeerTests` array. First set that array to `[]`, run the repository project, and confirm that the failure reports exactly the 21 current peer paths from the File and Ownership Map. Do not leave the zero-peer expectation installed in this task.

Run:

```bash
pnpm exec vitest run --project repository tests/repository/testArchitecture.test.ts
```

Expected: FAIL with exactly 21 unexpected peer suites, including driver-trait, MySQL statement-classifier, and connection-import importer peers. In Step 4, replace the temporary empty expectation with the exact 16 paths that remain after this task so the task ends independently green.

- [ ] **Step 3: Move the five suites and normalize wrappers**

For each mapping in this task, `git mv` the file to the destination. Where the old file is wrapped in `#[cfg(test)] mod tests { ... }`, remove only that outer attribute/module wrapper and one indentation level; retain every inner item unchanged. `ai_schema_context_tests.rs` has no outer wrapper and moves byte-for-byte.

Append to each owning module:

```rust
#[cfg(test)]
mod tests;
```

Delete these exact declarations from `lib.rs`:

```rust
#[cfg(test)]
pub mod ai_schema_context_tests;
#[cfg(test)]
pub mod connection_window_tests;
#[cfg(test)]
pub mod models_tests;
#[cfg(test)]
pub mod saved_queries_tests;
#[cfg(test)]
pub mod window_title_tests;
```

Expected: test modules become private children of their owning modules; production exports are unchanged.

- [ ] **Step 4: Ratchet only the five peer-suite exceptions**

Remove the five old paths from the peer-suite compatibility inventory in `architecture/policy.json`. Update `expectedRustPeerTests` and the architecture document from 21 to these exact 16 remaining paths:

```text
apps/desktop/src-tauri/src/ai_activity_tests.rs
apps/desktop/src-tauri/src/ai_approval_tests.rs
apps/desktop/src-tauri/src/ai_notebook_export_tests.rs
apps/desktop/src-tauri/src/connection_appearance_tests.rs
apps/desktop/src-tauri/src/connection_cache_tests.rs
apps/desktop/src-tauri/src/connection_import/importer_tests.rs
apps/desktop/src-tauri/src/drivers/driver_trait_tests.rs
apps/desktop/src-tauri/src/drivers/mysql/stmt_classify_tests.rs
apps/desktop/src-tauri/src/dump_commands_tests.rs
apps/desktop/src-tauri/src/explain_import_tests.rs
apps/desktop/src-tauri/src/export_import_tests.rs
apps/desktop/src-tauri/src/group_tree_tests.rs
apps/desktop/src-tauri/src/heartbeat_tests.rs
apps/desktop/src-tauri/src/pool_manager_tests.rs
apps/desktop/src-tauri/src/query_history_tests.rs
apps/desktop/src-tauri/src/updater_tests.rs
```

Retain those exact policy exceptions. The repository test must PASS with 16; a zero-peer guard is deferred until the final owner extraction in Task 11.

- [ ] **Step 5: Verify leaf test names and the full crate**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml ai_schema_context::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_window::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml models::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml saved_queries::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml window_title::tests -- --nocapture
pnpm test:rust
pnpm check:architecture
```

Expected: PASS; leaf test function names match `/tmp/nexora-rust-unit-tests.before`; only module ownership prefixes changed.

- [ ] **Step 6: Review and optionally commit only when requested**

Expected: five suite moves, five private declarations, five `lib.rs` declaration removals, and a downward-only policy/docs change. If explicitly requested, run GitNexus change detection and commit with `test: localize low-risk rust suites`.

---

### Task 6: Normalize stateful crate-level Rust peer suites

**Files:**
- Move to module-local `tests.rs`: `ai_activity_tests.rs`, `ai_approval_tests.rs`, `ai_notebook_export_tests.rs`, `connection_appearance_tests.rs`, `connection_cache_tests.rs`, `heartbeat_tests.rs`, `query_history_tests.rs`
- Move: `drivers/driver_trait_tests.rs` → `drivers/driver_trait/tests.rs`
- Move: `drivers/mysql/stmt_classify_tests.rs` → `drivers/mysql/stmt_classify/tests.rs`
- Move: `connection_import/importer_tests.rs` → `connection_import/tests/importers.rs`
- Modify: corresponding ten production/module-owner declarations
- Modify: `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/src/drivers/mysql/mod.rs`, and `apps/desktop/src-tauri/src/connection_import/mod.rs`
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: ten stateful/file-backed or focused nested peer suites owned by their modules; reduces peer exceptions from 16 to 6.

- [ ] **Step 1: Analyze all ten module declarations and run the narrow baseline**

Run upstream impact for each owning module plus affected `lib.rs`, `drivers/mysql/mod.rs`, and `connection_import/mod.rs` declarations. Then run each current module filter:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml ai_activity_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml ai_approval_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml ai_notebook_export_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_appearance_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_cache_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml heartbeat_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml query_history_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::driver_trait_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::mysql::stmt_classify_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import::importer_tests -- --nocapture
```

Expected: PASS. Preserve filesystem fixtures, synchronization, async timing, driver capability assertions, statement-classification cases, and importer fixtures exactly.

- [ ] **Step 2: Move each suite intact under its actual owner**

Use `git mv` according to the File and Ownership Map. For the seven crate-level suites, remove only each outer `#[cfg(test)] mod tests { ... }` wrapper, append `#[cfg(test)] mod tests;` to the owning module, and remove the corresponding seven `#[cfg(test)] pub mod ..._tests;` declarations from `lib.rs`.

Move `drivers/driver_trait_tests.rs` to `drivers/driver_trait/tests.rs`, append `#[cfg(test)] mod tests;` to `drivers/driver_trait.rs`, and remove `drivers::driver_trait_tests` from `lib.rs`. Authorize exactly one content repair in the moved suite: replace `use super::driver_trait::DriverCapabilities;` with owner-local `use super::DriverCapabilities;`. Move `drivers/mysql/stmt_classify_tests.rs` to `drivers/mysql/stmt_classify/tests.rs`, append `#[cfg(test)] mod tests;` to `drivers/mysql/stmt_classify.rs`, and remove `mod stmt_classify_tests;` from `drivers/mysql/mod.rs`; authorize exactly one content repair there: replace `use super::stmt_classify::{find_first_top_level_object_keyword, is_text_protocol_stmt};` with `use super::{find_first_top_level_object_keyword, is_text_protocol_stmt};`. Do not alter the separate existing `drivers/mysql/tests.rs` suite.

Move `connection_import/importer_tests.rs` to `connection_import/tests/importers.rs`. Keep the existing inline `connection_import::tests` module in place until Task 8, but add its child declaration inside that module. Because the importer suite becomes a child of the owner-qualified `connection_import::tests` module, authorize only these importer-path repairs in the moved file:

```rust
use super::super::beekeeper::BeekeeperImporter;
use super::super::datagrip::DataGripImporter;
use super::super::dbeaver::DBeaverImporter;
use super::super::sequelace::SequelAceImporter;
use super::super::tableplus::TablePlusImporter;
use super::super::ForeignAppImporter;
```

No other import, fixture, body, assertion, or visibility edit is authorized. Add the child declaration inside the inline owner module:

```rust
mod importers;
```

Rust resolves that child to `connection_import/tests/importers.rs` both while `tests` is inline and after Task 8 extracts it to `connection_import/tests.rs`. Do not add a `#[path]` override or create a competing `connection_import/tests.rs` in this task.

Expected declaration in each of the seven top-level owners plus `drivers/driver_trait.rs` and `drivers/mysql/stmt_classify.rs`:

```rust
#[cfg(test)]
mod tests;
```

`connection_import/mod.rs` keeps its existing inline `#[cfg(test)] mod tests { ... }` until Task 8 and gains only `mod importers;` inside it. Do not change helper visibility, fixture construction, sleeps, environment handling, assertions, or test names.

- [ ] **Step 3: Ratchet policy and current-state documentation**

Remove only these ten old peer paths from `architecture/policy.json`. Update `expectedRustPeerTests`, policy, and the architecture document to these exact six remaining paths:

```text
apps/desktop/src-tauri/src/dump_commands_tests.rs
apps/desktop/src-tauri/src/explain_import_tests.rs
apps/desktop/src-tauri/src/export_import_tests.rs
apps/desktop/src-tauri/src/group_tree_tests.rs
apps/desktop/src-tauri/src/pool_manager_tests.rs
apps/desktop/src-tauri/src/updater_tests.rs
```

The repository peer-inventory test must PASS with exactly six. Do not install the zero-peer guard yet; Task 11 owns that final transition.

- [ ] **Step 4: Run narrow and full verification**

Run the seven top-level `<module>::tests` filters, then these exact owner-qualified filters to prove the authorized import-only repairs:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::driver_trait::tests:: -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::mysql::stmt_classify::tests:: -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import::tests::importers:: -- --nocapture
pnpm test:rust
pnpm check:architecture
```

Expected: PASS under the new owner-qualified filters, including `drivers::driver_trait::tests`, `drivers::mysql::stmt_classify::tests`, and `connection_import::tests::importers`; no fixture or assertion diff; peer allowlist count is six. Run this batch independently green before Task 8 extracts the parent `connection_import::tests` module.

- [ ] **Step 5: Review and optionally commit only when requested**

If explicitly requested, run GitNexus change detection and commit with `test: localize stateful and nested rust suites`.

---

### Task 7: Normalize non-conflicting shared crate-level Rust peer suites

**Files:**
- Move: `explain_import_tests.rs` → `explain_import/tests.rs`
- Move: `pool_manager_tests.rs` → `pool_manager/tests.rs`
- Modify: `explain_import.rs`, `pool_manager.rs`, `lib.rs`
- Modify: `architecture/policy.json`
- Modify: `tests/repository/testArchitecture.test.ts`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: two additional module-local peer suites; leaves the four peers whose owners already contain inline `tests` modules for atomic owner extraction in Tasks 8, 9, and 11. No duplicate `tests` declaration, `#[path]` bridge, or new policy exception is introduced.

- [ ] **Step 1: Analyze the two non-conflicting owners and run their pre-move suites**

Run upstream impact for `pool_manager` and `explain_import`. Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml explain_import_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml pool_manager_tests -- --nocapture
```

Expected: PASS. Additionally record the fixture reference before movement with the repository-pinned Node runtime:

```bash
node -e 'const fs=require("node:fs"),s=fs.readFileSync("apps/desktop/src-tauri/src/pool_manager_tests.rs","utf8"),needle=`include_bytes!("../tests/test_ca.pem")`;if(s.split(needle).length-1!==1)process.exit(1)'
```

Expected: exits `0`, proving the pre-move suite has exactly one CA fixture reference without requiring an external search binary.

- [ ] **Step 2: Move the two non-conflicting suites and repair the compile-time fixture path**

Move `explain_import_tests.rs` and `pool_manager_tests.rs` to their `tests.rs` destinations. Remove only the old outer wrapper and append to each owner:

```rust
#[cfg(test)]
mod tests;
```

Preserve all nested modules inside `pool_manager_tests.rs`; do not split them into files. Because `include_bytes!` resolves relative to the source file, change exactly this reference after moving to `pool_manager/tests.rs`:

```rust
let cert_pem = include_bytes!("../../tests/test_ca.pem");
```

Keep `apps/desktop/src-tauri/tests/test_ca.pem` at its existing integration-fixture path. Make no other fixture or test-body edit.

- [ ] **Step 3: Preserve the four conflicting peers for their inline-owner tasks**

Do not move or edit `dump_commands_tests.rs`, `export_import_tests.rs`, `group_tree_tests.rs`, or `updater_tests.rs` in this task. Their owners already contain inline `mod tests { ... }`; declaring another `mod tests;` would not compile. Task 8 atomically combines dump commands, Task 9 atomically combines updater, and Task 11 atomically combines commands while extracting each owner's inline suite.

- [ ] **Step 4: Remove two declarations and ratchet to the exact four remaining peers**

Remove only `explain_import_tests` and `pool_manager_tests` from `lib.rs`. Update policy, `expectedRustPeerTests`, and current-state docs to exactly:

```text
apps/desktop/src-tauri/src/dump_commands_tests.rs
apps/desktop/src-tauri/src/export_import_tests.rs
apps/desktop/src-tauri/src/group_tree_tests.rs
apps/desktop/src-tauri/src/updater_tests.rs
```

No bridge exception is added. The peer inventory must PASS with exactly four; Task 11 still owns the eventual zero-peer guard.

- [ ] **Step 5: Verify both moved suites and the exact remaining peers**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml explain_import::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml pool_manager::tests -- --nocapture
node -e 'const fs=require("node:fs"),s=fs.readFileSync("apps/desktop/src-tauri/src/pool_manager/tests.rs","utf8"),next=`include_bytes!("../../tests/test_ca.pem")`,old=`include_bytes!("../tests/test_ca.pem")`;if(s.split(next).length-1!==1||s.includes(old))process.exit(1)'
test -f apps/desktop/src-tauri/tests/test_ca.pem
node -e 'const cp=require("node:child_process");const files=cp.execFileSync("git",["ls-files","apps/desktop/src-tauri/src/*_tests.rs","apps/desktop/src-tauri/src/**/*_tests.rs"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean);if(files.length!==4)process.exit(1)'
pnpm exec vitest run --project repository tests/repository/testArchitecture.test.ts
pnpm test:rust
pnpm check:architecture
```

Expected: PASS; the portable Node checks find `../../tests/test_ca.pem` exactly once, the old path zero times, and exactly four tracked deferred peer paths; the post-move pool-manager test compiles and reads the same tracked CA fixture; no duplicate `tests` module or bridge declaration exists; policy and repository inventory agree.

- [ ] **Step 6: Review and optionally commit only when requested**

If explicitly requested, run GitNexus change detection and commit with `test: remove crate-level rust test modules`.

---

### Task 8: Move low-risk inline Rust suites

**Files:**
- Modify/move test bodies for: `paths.rs`, `connection_params.rs`, `results_window.rs`, `json_viewer.rs`, `dump_commands.rs`, `connection_import/driver_map.rs`, `connection_import/crypto.rs`, `connection_import/datagrip/jdbc.rs`, `connection_import/mod.rs`
- Move: `apps/desktop/src-tauri/src/dump_commands_tests.rs` into the canonical `apps/desktop/src-tauri/src/dump_commands/tests.rs` owner while extracting the existing inline dump-command suite
- Create: corresponding module-local `tests.rs` files from the map; `connection_import/tests.rs` must retain `mod importers;` for the Task 6 child suite
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: nine production files containing only `#[cfg(test)] mod tests;` rather than inline test bodies; `connection_import/tests.rs` owns both the extracted module-helper tests and the existing `importers` child suite.

- [ ] **Step 1: Analyze private-helper impact and run the narrow baseline**

Run upstream impact for each owning module. Then run module filters:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml paths::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_params::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml results_window::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml json_viewer::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump_commands::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import::driver_map::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import::crypto::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import::datagrip::jdbc::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import::tests -- --nocapture
```

Expected: PASS.

- [ ] **Step 2: Move each complete inline suite mechanically**

For every source except `dump_commands.rs`, replace the complete block:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    // existing items
}
```

with:

```rust
#[cfg(test)]
mod tests;
```

Create the destination `tests.rs` from the old block's contents, removing only the outer wrapper and one indentation level. Keep `use super::*;`, the Task 6 `mod importers;` declaration, and all nested modules intact when extracting `connection_import/mod.rs`; its child path remains `connection_import/tests/importers.rs` without a path override.

Run both `connection_import::tests` and the exact child filter `connection_import::tests::importers::` after extraction; each must execute a nonzero test count.

For `dump_commands.rs`, atomically `git mv dump_commands_tests.rs` to `dump_commands/tests.rs`, remove its old outer wrapper, then append the production file's one inline test to that same canonical file as an intact nested module named `zip_import_logic` only if a name collision exists; otherwise preserve the test directly. Replace the production inline block with one `#[cfg(test)] mod tests;`, remove only the old `dump_commands_tests` declaration from `lib.rs`, and do not change either test function name or assertions. This ordering ensures there is never a duplicate `tests` module.

- [ ] **Step 3: Ratchet exactly these inline and peer exceptions**

Remove the nine source paths from `rustInlineTestAllowlist` and remove `dump_commands_tests.rs` from the peer inventory. Update policy, `expectedRustPeerTests`, and current-state documentation to exactly three remaining peers:

```text
apps/desktop/src-tauri/src/export_import_tests.rs
apps/desktop/src-tauri/src/group_tree_tests.rs
apps/desktop/src-tauri/src/updater_tests.rs
```

The repository inventory test must PASS with three; do not install the zero-peer guard before Task 11.

- [ ] **Step 4: Verify narrow suites and complete crate**

Run the same nine module filters, then:

```bash
pnpm test:rust
pnpm check:architecture
```

Expected: PASS; Cargo leaf names and counts are unchanged; no production visibility change appears.

- [ ] **Step 5: Review and optionally commit only when requested**

If explicitly requested, run GitNexus change detection and commit with `test: move low-risk inline rust tests`.

---

### Task 9: Move medium-risk infrastructure inline Rust suites

**Files:**
- Modify/move test bodies for: `connection_import/analyzer.rs`, `connection_import/convert.rs`, `ai.rs`, `config.rs`, `dump_utils.rs`, `k8s_tunnel.rs`, `mcp/install.rs`, `updater.rs`
- Create: corresponding module-local `tests.rs` files
- Move: `apps/desktop/src-tauri/src/updater_tests.rs` → `apps/desktop/src-tauri/src/updater/tests/registration.rs`
- Modify: `updater/tests/registration.rs`
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: eight module-local suites; canonical updater `tests.rs` owning its unchanged inline suite and the already-distinct registration child.

- [ ] **Step 1: Analyze impact and run each current module filter**

Run upstream impact for all eight modules. Pay special attention to environment mutation in updater/config and command parsing in k8s/MCP. Run each existing `<module>::tests` filter and expect PASS.

- [ ] **Step 2: Move seven ordinary inline suites intact**

Apply the exact mechanical transformation from Task 8 to analyzer, convert, AI, config, dump utilities, Kubernetes tunnel, and MCP install. Preserve nested modules in `dump_utils.rs` and `k8s_tunnel.rs`; do not split them into child files.

- [ ] **Step 3: Canonicalize updater without splitting either existing suite**

Atomically move `updater_tests.rs` to `updater/tests/registration.rs` while moving the complete old inline `updater::tests` body into `updater/tests.rs`. At its end, declare the already-distinct registration suite:

```rust
mod registration;
```

Remove the old crate-level `updater_tests` declaration from `lib.rs`. Replace the old inline block with exactly:

```rust
#[cfg(test)]
mod tests;
```

The moved registration file remains byte-for-byte equivalent except for imports required by its deeper module path. Remove the old crate-level `updater_tests.rs` peer-policy entry; no temporary updater module, bridge, or policy/docs exception is created.

- [ ] **Step 4: Ratchet eight inline exceptions**

Remove the exact eight source paths from `rustInlineTestAllowlist`; remove `updater_tests.rs` from the peer inventory. Update policy, `expectedRustPeerTests`, and current-state documentation to exactly two remaining peers:

```text
apps/desktop/src-tauri/src/export_import_tests.rs
apps/desktop/src-tauri/src/group_tree_tests.rs
```

The repository peer inventory must PASS with two. No updater bridge ever exists. Do not alter remaining driver/plugin/commands inline exceptions, and do not install the zero-peer guard before Task 11 atomically removes the final two command peers.

- [ ] **Step 5: Verify environment-sensitive tests serially where needed**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml updater::tests -- --nocapture --test-threads=1
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml config::tests -- --nocapture --test-threads=1
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml k8s_tunnel::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::install::tests -- --nocapture
pnpm test:rust
pnpm check:architecture
```

Expected: PASS; updater contains both its original inline tests and registration test; no ignored marker or environment cleanup changes.

- [ ] **Step 6: Review and optionally commit only when requested**

If explicitly requested, run GitNexus change detection and commit with `test: move infrastructure rust tests`.

---

### Task 10: Move PostgreSQL extractor inline suites without splitting them

**Files:**
- Modify: `apps/desktop/src-tauri/src/drivers/postgres/extract/{enum,composite,multi_range,array,range,simple}.rs`
- Create by extracting intact suites: matching `{enum,composite,multi_range,array,range,simple}/tests.rs`
- Modify: `architecture/policy.json`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Produces: six canonical extractor test modules; the 112-test `simple` suite remains one file.

- [ ] **Step 1: Analyze extractor impact and run the complete extractor baseline**

Run upstream impact for each extractor module. Then run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::postgres::extract -- --nocapture
```

Expected: PASS. Save the filtered `cargo test -- --list` output for leaf-name comparison.

- [ ] **Step 2: Move the five medium-sized extractor suites in one reviewable batch**

Mechanically extract `enum`, `composite`, `multi_range`, `array`, and `range` inline modules to matching `tests.rs` files. Replace each block with `#[cfg(test)] mod tests;`. Preserve all byte arrays, malformed-input fixtures, assertions, imports, comments, and leaf test names.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::postgres::extract -- --nocapture
```

Expected: PASS before touching `simple.rs`.

- [ ] **Step 3: Move the oversized `simple` suite intact as its own high-risk batch**

Move all 112 tests from the single inline block in `simple.rs` to `simple/tests.rs`. Do not divide by PostgreSQL type, rename modules, deduplicate fixtures, reformat byte arrays, or alter assertions. Replace the block with:

```rust
#[cfg(test)]
mod tests;
```

- [ ] **Step 4: Ratchet all six extractor exceptions**

Remove the six source paths from `rustInlineTestAllowlist`. Keep any remaining plugin/commands entries unchanged.

- [ ] **Step 5: Compare names and run full Rust verification**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::postgres::extract -- --list > /tmp/nexora-postgres-extract-tests.after
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::postgres::extract -- --nocapture
pnpm test:rust
pnpm check:architecture
```

Expected: PASS; leaf names and counts equal the saved before inventory; `simple/tests.rs` remains one suite file.

- [ ] **Step 6: Review and optionally commit only when requested**

If the user requests commits, prefer two explicit commits matching Steps 2 and 3: `test: move postgres extractor tests` and `test: move postgres simple extraction tests`. Otherwise do not commit.

---

### Task 11: Move plugin RPC and commands inline suites as isolated high-risk batches

**Files:**
- Modify: `apps/desktop/src-tauri/src/plugins/driver.rs`
- Create: `apps/desktop/src-tauri/src/plugins/driver/tests.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Create by extracting inline tests: `apps/desktop/src-tauri/src/commands/tests.rs`
- Move: `apps/desktop/src-tauri/src/export_import_tests.rs` → `apps/desktop/src-tauri/src/commands/tests/export_import.rs`
- Move: `apps/desktop/src-tauri/src/group_tree_tests.rs` → `apps/desktop/src-tauri/src/commands/tests/group_tree.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `architecture/policy.json`
- Modify: `tests/repository/testArchitecture.test.ts`
- Modify: `docs/architecture/repository-structure.md`

**Interfaces:**
- Consumes: the exact two-peer inventory left independently green by Task 9; Task 10 does not alter peer ownership.
- Produces: zero crate-level Rust peer suites, a zero-peer inventory guard, zero non-trivial inline Rust test modules, and empty Rust peer/inline compatibility allowlists.

- [ ] **Step 1: Analyze and warn on high-risk impact**

Run upstream impact for `RpcDriver`/the plugin driver module and for every externally referenced symbol in `commands.rs` whose enclosing file declaration changes. Expected: commands is likely HIGH or CRITICAL because it participates in many Tauri flows. Report the risk and obtain review before editing.

- [ ] **Step 2: Run plugin RPC and commands baselines separately**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::driver::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests -- --list > /tmp/nexora-command-inline-tests.before
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export_import_tests -- --list > /tmp/nexora-command-export-import-tests.before
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml group_tree_tests -- --list > /tmp/nexora-command-group-tree-tests.before
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export_import_tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml group_tree_tests -- --nocapture
```

Expected: PASS with exactly 59 inline command tests, 7 export/import tests, and 17 group-tree tests. Preserve all three `--list` files for the post-move comparison; zero tests in any filter is a failure.

- [ ] **Step 3: Move the plugin driver suite intact**

Extract the complete `plugins/driver.rs` inline module to `plugins/driver/tests.rs` and replace it with `#[cfg(test)] mod tests;`. Preserve JSON-RPC method assertions, fallback errors, payload fields, process-channel behavior, and test names exactly.

Run the plugin filter again. Expected: PASS before touching commands.

- [ ] **Step 4: Atomically combine the commands owner and its final two peer suites**

In one compile-preserving batch:

1. Create `commands/tests.rs` by extracting the complete contents of the old `commands.rs` inline `mod tests { ... }`, removing only the outer wrapper and one indentation level. Retain all 59 tests and nested modules in the same file. This destination does not exist before this task; do not describe or treat it as an existing aggregator.
2. Move `export_import_tests.rs` to `commands/tests/export_import.rs` and `group_tree_tests.rs` to `commands/tests/group_tree.rs`. Remove only their outer `#[cfg(test)] mod tests { ... }` wrappers and one indentation level; preserve the group-tree module documentation, every test body, assertion, fixture, and leaf name. Their existing `crate::commands` imports remain valid and require no repair.
3. Add these declarations after the moved inline suite content:

```rust
mod export_import;
mod group_tree;
```

4. Replace the production inline module with:

```rust
#[cfg(test)]
mod tests;
```

5. Remove the old `export_import_tests` and `group_tree_tests` declarations from `lib.rs`.

Do not create `commands::export_import_tests` or `commands::group_tree_tests` bridges, and do not perform any intermediate step that declares a second `commands::tests` module. Do not split command families, extract fixtures, change visibility, rename nested modules, or alter assertions. The later Rust/Tauri modularization plan owns suite splitting.

- [ ] **Step 5: Close both Rust test-placement ratchets**

Set the Rust inline compatibility allowlist to empty and replace the exact two-peer expectation installed by Task 9 with an empty inventory:

```json
"rustInlineTestAllowlist": [],
"rustCrateLevelTestAllowlist": []
```

`expectedRustPeerTests` must now be `[]`, and the repository test must fail on any future `*_tests.rs` file anywhere below `apps/desktop/src-tauri/src/`. Update current-state docs to state that non-trivial Rust unit tests are module-local and no peer suites remain. Do not claim that oversized suites have been split.

Run the repository project and `pnpm check:architecture` here. Expected: PASS with zero peers and no inline-test debt. This is the first and only task that installs the zero-peer guard.

- [ ] **Step 6: Verify both high-risk suites and all Rust tests**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::driver::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::export_import:: -- --nocapture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::group_tree:: -- --nocapture
node -e 'const fs=require("node:fs"),cp=require("node:child_process");const manifest="apps/desktop/src-tauri/Cargo.toml";for(const [before,filter] of [["/tmp/nexora-command-inline-tests.before","commands::tests::"],["/tmp/nexora-command-export-import-tests.before","commands::tests::export_import::"],["/tmp/nexora-command-group-tree-tests.before","commands::tests::group_tree::"]]){const old=fs.readFileSync(before,"utf8").split(/\r?\n/).filter(l=>l.includes(": test")).map(l=>l.replace(/^.*::(?=[^:]+: test$)/,""));const now=cp.execFileSync("cargo",["test","--manifest-path",manifest,filter,"--","--list"],{encoding:"utf8"}).split(/\r?\n/).filter(l=>l.includes(": test")).map(l=>l.replace(/^.*::(?=[^:]+: test$)/,""));if(JSON.stringify(old)!==JSON.stringify(now))process.exit(1)}'
pnpm exec vitest run --project repository tests/repository/testArchitecture.test.ts
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib -- --list > /tmp/nexora-rust-unit-tests.after
pnpm test:rust
pnpm check:architecture
```

Expected: PASS; plugin, all 59 inline command tests, export/import, and group-tree leaf names/counts match the baseline; architecture reports zero peer suites and no inline test debt.

- [ ] **Step 7: Review and optionally commit only when requested**

If requested, keep plugin and commands as separate commits: `test: move plugin driver tests` and `test: move command tests`. Run GitNexus change detection before each. Otherwise do not commit.

---

### Task 12: Classify external-infrastructure integration tests in two separate batches

**Files:**
- Path-only batch move: `apps/desktop/src-tauri/tests/integration_tests.rs` → `apps/desktop/src-tauri/tests/database_integration.rs`
- Modify in classification batch: `apps/desktop/src-tauri/tests/database_integration.rs`
- Modify: `architecture/policy.json`
- Modify: `.rules/testing.md`
- Modify: `.rules/rust.md`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `tests/repository/testArchitecture.test.ts`

**Interfaces:**
- Produces: explicitly classified external-infrastructure integration suite; default Cargo runs still ignore all nine tests; explicit runs fail rather than succeed as no-ops when required databases are absent.

- [ ] **Step 1: Record current skip semantics**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test integration_tests -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test integration_tests
```

Expected: nine tests are listed and all nine remain ignored in a normal run. Do not use `--ignored` yet.

- [ ] **Step 2: Perform a path-only classification move**

Run:

```bash
git mv apps/desktop/src-tauri/tests/integration_tests.rs apps/desktop/src-tauri/tests/database_integration.rs
```

In this path-only batch, do not change `#[ignore]`, early returns, ports, credentials, retries, assertions, test names, comments, or whitespace.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration
```

Expected: the same nine leaf test names are listed and ignored. Review this diff as a pure rename before continuing.

- [ ] **Step 3: Add failing classification-policy assertions in a separate batch**

Extend `testArchitecture.test.ts` to require:

```ts
expect(policy.rustIntegrationTests).toEqual({
  "apps/desktop/src-tauri/tests/database_integration.rs": {
    classification: "external-infrastructure",
    defaultMode: "ignored",
    explicitRun: "cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --ignored",
  },
});
```

Run the repository test. Expected: FAIL until policy is updated.

- [ ] **Step 4: Add explicit infrastructure preconditions without changing default skip semantics**

Keep every `#[ignore]` marker. Add one test-only helper with this interface:

```rust
fn require_integration_service(available: bool, service: &str, port: u16) {
    assert!(
        available,
        "{service} integration service is required on 127.0.0.1:{port}"
    );
}
```

Replace only the successful early-return branches after retry exhaustion with calls to this helper, followed by the existing body. Do not change any existing assertions or test names. Default `cargo test` behavior remains nine ignored tests; an explicit `--ignored` run now fails clearly if MySQL/PostgreSQL infrastructure is missing instead of returning success.

- [ ] **Step 5: Record exact integration classification and commands**

Add the exact `rustIntegrationTests` policy object from Step 3. Document:

```text
Default: cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
Explicit external integration run: cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --ignored
Required services: MySQL on 127.0.0.1:33060 and PostgreSQL on 127.0.0.1:54320 with the existing test credentials and database.
```

State that path-only integration moves may not change skip semantics; precondition changes require a separate reviewed batch.

- [ ] **Step 6: Verify default semantics without requiring infrastructure**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration
pnpm exec vitest run --project repository tests/repository/testArchitecture.test.ts
pnpm test:rust
pnpm check:architecture
```

Expected: nine tests listed; nine ignored in the default integration binary; repository guard PASS; full Rust tests PASS without external databases.

- [ ] **Step 7: Run explicit integration tests only when services are provisioned**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --ignored
```

Expected with services provisioned: all nine PASS. Expected without services: FAIL with the explicit required-service message, never a successful no-op.

- [ ] **Step 8: Review and optionally commit only when requested**

If commits are requested, keep the pure rename (`test: classify database integration suite`) separate from precondition/policy/docs changes (`test: require explicit integration infrastructure`). Run GitNexus change detection before each. Otherwise do not commit.

---

### Task 13: Harden test architecture guards and close documentation ratchets

**Files:**
- Modify: `scripts/check-architecture.mjs`
- Modify: `architecture/policy.json`
- Modify: `tests/repository/architecturePolicy.test.ts`
- Modify: `tests/repository/testArchitecture.test.ts`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/testing.md`
- Modify: `.rules/rust.md`

**Interfaces:**
- Consumes: normalized paths and the zero-peer/zero-inline Rust ratchets already installed by Tasks 2–12.
- Produces: additional fixture coverage for the existing hard failures against colocated frontend tests, unowned desktop tests, stale multi-source ownership metadata, root desktop tests, crate-level Rust peer suites, non-trivial inline Rust test modules, unclassified integration suites, and stale exceptions; it does not introduce or defer the zero-peer guard.

- [ ] **Step 1: Write failing guard-unit cases before tightening implementation**

Add fixture-driven cases around `collectViolations(root, policy)` that create temporary trees and assert actionable violations for. The desktop fixture policy includes narrow explicit `frontendTestOwners` metadata keyed by test path; each value is a non-empty array of repository-relative production source paths owned by that suite:

```ts
expect(violations).toContain("frontend test must not live in production source: apps/desktop/src/foo.test.ts");
expect(violations).toContain("frontend test must mirror desktop source or use an approved repository namespace: apps/desktop/tests/wrong/Foo.test.tsx");
expect(violations).toContain("root tests must live under tests/repository: tests/foo.test.ts");
expect(violations).toContain("crate-level Rust peer test module is forbidden: apps/desktop/src-tauri/src/foo_tests.rs");
expect(violations).toContain("inline Rust test module is forbidden: apps/desktop/src-tauri/src/foo.rs");
expect(violations).toContain("Rust integration test is not classified: apps/desktop/src-tauri/tests/unknown.rs");
```

Also add passing fixtures for:

```text
apps/desktop/tests/components/Foo.test.tsx mirroring apps/desktop/src/components/Foo.tsx
tests/repository/workspaceLayout.test.ts
apps/desktop/tests/repository/rootOverflow.test.ts
apps/desktop/src-tauri/src/foo.rs plus apps/desktop/src-tauri/src/foo/tests.rs
apps/desktop/src-tauri/tests/database_integration.rs with exact policy classification
```

Add repository-confirmed multi-source/contract fixtures and exact owner metadata for at least:

```json
{
  "apps/desktop/tests/components/SlotAnchor.test.tsx": [
    "apps/desktop/src/components/ui/SlotAnchor.tsx",
    "apps/desktop/src/contexts/PluginSlotProvider.tsx",
    "apps/desktop/src/contexts/PluginSlotContext.ts",
    "apps/desktop/src/contexts/SettingsContext.ts",
    "apps/desktop/src/types/pluginSlots.ts"
  ],
  "apps/desktop/tests/utils/minimax.test.ts": [
    "apps/desktop/src/utils/settings.ts",
    "apps/desktop/src/utils/settingsUI.ts",
    "apps/desktop/src/contexts/SettingsContext.ts"
  ],
  "apps/desktop/tests/utils/sqlSplitter/dialects.test.ts": [
    "apps/desktop/src/utils/sqlSplitter/index.ts",
    "apps/desktop/src/utils/sqlSplitter/splitter.ts",
    "apps/desktop/src/utils/sqlSplitter/tokenizer.ts"
  ]
}
```

Do not add redundant metadata for `sqlSplitter/{classify,splitter,tokenizer}.test.ts`: each already mirrors its same-named source file and must pass through the normal one-owner rule. The current repository scan confirms SlotAnchor, minimax, and sqlSplitter/dialects are the only non-mirroring desktop suites outside `apps/desktop/tests/repository/`; if the implementation-time scan finds another, add it only with its exact production owners. Do not create a directory-wide wildcard, basename heuristic, or general bypass.

Run:

```bash
pnpm exec vitest run --project repository tests/repository/architecturePolicy.test.ts tests/repository/testArchitecture.test.ts
```

Expected: FAIL until the checker enforces all six rules.

- [ ] **Step 2: Complete exact guard behavior without reopening closed ratchets**

Extend `collectViolations(root, policy)` without adding dependencies. Preserve Task 11's already-green recursive zero-peer rejection and empty peer inventory while adding any remaining fixture coverage. The complete behavior must:

- reject `*.test.*` and all `*.spec.*` below `apps/desktop/src`;
- accept a desktop `*.test.ts(x)` path when it either mirrors an existing `apps/desktop/src` path after removing `.test`, belongs to `apps/desktop/tests/repository/`, or has an exact `frontendTestOwners` entry whose non-empty owner list contains only existing files below `apps/desktop/src/`;
- reject missing, stale, empty, wildcard, directory-only, outside-desktop, or unused `frontendTestOwners` entries, so metadata remains a narrow ownership contract rather than an allowlist bypass;
- reject root tests outside `tests/repository/`;
- reject imports from `apps/desktop/src`, `@/`, or relative paths escaping into desktop source from root repository tests;
- reject any `*_tests.rs` path anywhere below `apps/desktop/src-tauri/src/`, including both crate-root and nested peers;
- reject a non-test Rust source containing `#[cfg(test)]` followed by an inline `mod tests {`, while allowing `#[cfg(test)] mod tests;`;
- require each `apps/desktop/src-tauri/tests/*.rs` file to have an exact `rustIntegrationTests` policy entry;
- reject policy allowlist entries whose files no longer exist;
- print one repository-relative violation per line and return exit `1`; otherwise print `[architecture] OK`.

Keep exported interfaces unchanged:

```js
export function collectViolations(root, policy) {}
export function countLines(content) {}
```

- [ ] **Step 3: Close all temporary test-placement ratchets**

Ensure policy contains:

```json
"frontendTestAllowlist": [],
"rustCrateLevelTestAllowlist": [],
"rustInlineTestAllowlist": []
```

Retain only the explicit `repositoryTestRoots`, narrow `frontendTestOwners`, and `rustIntegrationTests` classifications; these are ownership/classification metadata, not debt allowlists. Preserve the empty Rust peer and inline allowlists plus `expectedRustPeerTests = []` from Task 11; Task 13 verifies those closed ratchets and must not introduce them for the first time. `frontendTestOwners` must include the repository-confirmed non-mirroring SlotAnchor, minimax, and sqlSplitter/dialects suites plus any exact non-mirroring suite found by the implementation-time scan. The sqlSplitter classify/splitter/tokenizer suites continue through the ordinary same-name mirror rule. Do not increase file-size baselines.

- [ ] **Step 4: Make all living instructions agree**

Update the canonical architecture document first, then concise directives in `AGENTS.md`, `.rules/testing.md`, and `.rules/rust.md`. They must agree on:

- desktop mirror `apps/desktop/tests/**` ↔ `apps/desktop/src/**` for one-owner suites;
- narrow `frontendTestOwners` metadata for documented non-mirroring multi-source/contract suites, including SlotAnchor, minimax, and sqlSplitter/dialects coverage, while same-name sqlSplitter suites use normal mirroring;
- desktop exception `apps/desktop/tests/repository/`;
- sole root namespace `tests/repository/` and its desktop-import prohibition;
- package-owned `packages/<package>/tests/`;
- Rust `tests.rs`/`tests/` unit ownership and `#[cfg(test)] mod tests;` declarations;
- crate integration tests under `apps/desktop/src-tauri/tests/` with explicit classification;
- no inline non-trivial tests and no peer `*_tests.rs` anywhere below the Rust source root;
- suite splitting deferred to later modularization plans;
- narrow-first and full-check commands.

Remove every obsolete reference to root `src/`, root `src-tauri/`, root `tests/setup.ts`, the four frontend exceptions, peer Rust test exceptions, and inline Rust exceptions.

- [ ] **Step 5: Run focused guard verification**

Run:

```bash
pnpm exec vitest run --project repository tests/repository/architecturePolicy.test.ts tests/repository/testArchitecture.test.ts tests/repository/architectureDocumentation.test.ts tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts
pnpm check:architecture
```

Expected: all PASS and `[architecture] OK`.

- [ ] **Step 6: Compare final inventories against the baseline**

Run:

```bash
test -z "$(git ls-files 'apps/desktop/src/**/*.test.ts' 'apps/desktop/src/**/*.test.tsx' 'apps/desktop/src/**/*.spec.ts' 'apps/desktop/src/**/*.spec.tsx')"
test -z "$(git ls-files 'apps/desktop/src-tauri/src/*_tests.rs' 'apps/desktop/src-tauri/src/**/*_tests.rs')"
pnpm exec vitest list --project desktop > /tmp/nexora-vitest-tests.after
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib -- --list > /tmp/nexora-rust-unit-tests.after
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --list > /tmp/nexora-rust-integration-names.after
```

Expected: no forbidden paths; frontend full suite names match before; Rust leaf names/counts match before; the nine integration leaf names match before. Only Rust ownership prefixes and the integration binary filename may differ.

- [ ] **Step 7: Run full affected checks**

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

Expected: all PASS. Do not push, create/update a pull request, report completion, or proceed to frontend/Rust decomposition while any command fails.

- [ ] **Step 8: Review structural scope with GitNexus and Git**

Run GitNexus change detection against `main`. Expected: test discovery, test module ownership, architecture guard, and documentation flows only; no production runtime execution flow changes.

Run:

```bash
git diff --check
git status --short
git diff --stat
git diff --find-renames
```

Expected: test/config/guard/docs paths plus production files containing only test-module declaration changes. No production function body changes.

- [ ] **Step 9: Optionally commit only when requested**

If explicitly requested, stage only Task 13 files and commit with `ci: enforce normalized test architecture`. Otherwise leave all changes uncommitted.

---

## Completion Gate

- [ ] Exactly four former frontend source tests now mirror production under `apps/desktop/tests/`, with all 36 existing tests unchanged.
- [ ] Root tests exist only under `tests/repository/` and cannot import desktop-private modules.
- [ ] `apps/desktop/tests/repository/` contains desktop-wide contracts that do not mirror one source file.
- [ ] `tests/repository/releaseWorkflow.test.ts` and `tests/repository/releaseDryRunWorkflow.test.ts` stayed at their desktop-migration final paths and were never moved by normalization.
- [ ] Documented non-mirroring multi-source/contract suites use exact existing-source `frontendTestOwners` metadata; SlotAnchor, minimax, and sqlSplitter/dialects pass through metadata, while sqlSplitter/classify, splitter, and tokenizer pass through ordinary mirroring, with no blanket bypass.
- [ ] Root and desktop Vitest projects discover disjoint, correctly owned suites; root `test`, `test:repository`, and `test:desktop` scripts use the root aggregator explicitly, and `rootCommands.test.ts` asserts the changed scripts plus a green child execution.
- [ ] Root `pnpm lint` remains directly runnable with root-owned `eslint.config.js` and all six ESLint packages; normalization does not duplicate lint tooling into the desktop importer.
- [ ] No crate-level `*_tests.rs` remains under `apps/desktop/src-tauri/src/`.
- [ ] No non-trivial inline `mod tests { ... }` remains in production Rust files.
- [ ] Every moved Rust suite is loaded by a private `#[cfg(test)] mod tests;` declaration or a canonical tests aggregator; the initial exact 21-suite inventory included driver-trait, MySQL statement-classifier, and connection-import importer peers, ratcheted 21 → 16 → 6 → 4 → 3 → 2 → 0, and Task 11 installed the final zero-peer guard.
- [ ] The three Task 6 nested moves contain only their exact owner-local import repairs and pass exact filters `drivers::driver_trait::tests::`, `drivers::mysql::stmt_classify::tests::`, and `connection_import::tests::importers::`; Task 11 creates `commands/tests.rs` while extracting the inline command suite.
- [ ] `pool_manager/tests.rs` contains exactly `include_bytes!("../../tests/test_ca.pem")`, the old path is absent, and `apps/desktop/src-tauri/tests/test_ca.pem` remains tracked.
- [ ] Oversized commands and PostgreSQL simple extractor suites moved intact and were not split.
- [ ] All nine database integration tests remain ignored by default, are explicitly classified, and fail clearly rather than succeed as no-ops when explicitly run without infrastructure.
- [ ] Frontend, peer-Rust, and inline-Rust debt allowlists are empty.
- [ ] Architecture docs, `AGENTS.md`, focused rules, Vitest configs, package scripts, and guards describe the same current state.
- [ ] All focused and full verification commands pass.
- [ ] No production logic or public behavior changed.
