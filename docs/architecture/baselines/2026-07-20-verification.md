# Repository Verification Baseline

**Commit:** `4cbe6824cf537c58b4b1fe1bb6233c0336f72018`
**Date:** 2026-07-20

## GitNexus refresh

| Command or check | Result | Notes |
|---|---|---|
| `node .gitnexus/run.cjs status` | INITIAL LIMITATION | The isolated worktree initially had no ignored `.gitnexus/` directory, so `.gitnexus/run.cjs` was unavailable. |
| `node /home/louis/workspace/nexora/.gitnexus/run.cjs status` | PASS | Used the available runner from the main worktree. Reported `Repository not indexed.` and advised running analysis. |
| `node /home/louis/workspace/nexora/.gitnexus/run.cjs analyze` | PASS WITH INCOMPATIBLE INDEX | Indexed the isolated worktree at current `HEAD` in 38.6 seconds: 9,768 nodes, 23,896 edges, 621 clusters, and 300 flows; skipped `src-tauri/icons/icon.icns` because it exceeds 512 KB. The connected MCP reader then failed with `Database file version: 42, Current build storage version: 40`. |
| `pnpm --allow-build=@ladybugdb/core --allow-build=gitnexus --allow-build=tree-sitter dlx gitnexus@1.6.8 analyze --force` | PASS WITH INCOMPATIBLE INDEX | Reindexed after freeing disk space, but MCP reader then failed with `Database file version: 41, Current build storage version: 40`. |
| `rm -rf .gitnexus && pnpm --allow-build=@ladybugdb/core --allow-build=gitnexus --allow-build=tree-sitter dlx gitnexus@1.6.5 analyze --force` | PASS | Rebuilt a reader-compatible index for `4cbe682`: 14,281 nodes, 27,541 edges, 672 clusters, and 300 flows. |
| `gitnexus_query` for `/home/louis/workspace/nexora-foundation` | PASS | MCP query against the isolated worktree returned graph results without the LadybugDB storage-version mismatch. |

## Baseline checks

| Command | Result | Notes |
|---|---|---|
| `pnpm test -- --run` | PASS | 168 test files passed; 2,896 tests passed. |
| `pnpm typecheck` | PASS | `tsc --noEmit` completed successfully. |
| `pnpm lint` | PASS | `eslint .` completed successfully. |
| `pnpm build:plugin-api` | PASS | Built ESM `dist/index.js` (2.27 KB) and declarations `dist/index.d.ts` (10.22 KB). |
| `pnpm check:plugin-api` | PASS | `tsx scripts/check-sync.ts` completed successfully. |
| `pnpm build:create-plugin` | PASS | Built ESM `dist/cli.js` (8.89 KB). |
| `pnpm smoke:create-plugin` | PASS | Network, file, and network-with-UI templates were created and passed clean `cargo check`; smoke result was OK. |
| `pnpm build` | PASS | `tsc -b && vite build` completed; Vite reported `build ok`. |
| `pnpm test:rust` | PASS | Original pre-refactor baseline: main suite 933 passed, 0 failed, 1 ignored; integration suite 9 ignored; no failures in zero-test suites. Total observed: 933 passed, 10 ignored. |
| `pnpm test:rust` after Task 6 characterization | PASS | Added compact Rust characterization coverage without production behavior changes. Main suite: 943 passed, 0 failed, 1 ignored; integration suite: 9 ignored; no failures in zero-test suites. Total observed: 943 passed, 10 ignored. |

## Task 6 characterization notes

- Added coverage for explicit multi-database/schema command context, stable connection IDs, exact unsupported-driver and default unsupported-operation wording, saved-connection pool keys by database, JSON-RPC `-32601`/message fallback, plugin startup failure, driver capability defaults, default ping delegation, ordered stop behavior, and ordered batch execution continuing after a statement error.
- Pool removal is exercised through the current `close_pool_with_id` API against two lazy global SQLite pools, proving the target pool closes while an unrelated connection remains queryable.
- A portable Unix shell fixture returns an initialization error to `RpcDriver::new`, proving the manager-facing constructor suppresses that error and dropping its final process owner cleans up the child process without an external plugin dependency; process exit is probed through the cross-platform `sysinfo` API instead of Linux `/proc`.
- Existing cancellation registration, lookup, cancellation, and cleanup coverage was retained rather than duplicated.

## Public Behavior Freeze

- Tauri command names and payload omission rules remain unchanged.
- Plugin JSON-RPC methods, fallback errors, and response shapes remain unchanged.
- Frontend SQL and driver-name branching remain unchanged during structural phases.
- Visible UI, state ownership, serialization, error wording, and timeouts remain unchanged.

## Desktop workspace migration preflight

**Commit:** `bc02503de6c3311b3e7088adc23d89e27fc281c5`
**Date:** 2026-07-21

### Path inventories

| Inventory | Count | SHA-256 |
|---|---:|---|
| `/tmp/nexora-desktop-paths.before` | 831 | `d8178d3af045b37aa454c87c86506db796453f7b4a5892689701ddce48e34893` |
| `/tmp/nexora-path-references.before` | 865 | `767b43a3d829cdcddfe24e58d68c9c8d1ff6f5851e52fcb6c94e1fb2a1f3f639` |

### Baseline checks

| Command | Result | Notes |
|---|---|---|
| `pnpm test -- --run` | PASS | 177 test files passed; 2,930 tests passed. |
| `pnpm typecheck` | PASS | `tsc --noEmit` completed successfully. |
| `pnpm lint` | PASS | `eslint .` completed successfully. |
| `pnpm build:plugin-api` | PASS | Built ESM `dist/index.js` (2.27 KB) and declarations `dist/index.d.ts` (10.22 KB). |
| `pnpm check:plugin-api` | PASS | `tsx scripts/check-sync.ts` completed successfully. |
| `pnpm build:create-plugin` | PASS | Built ESM `dist/cli.js` (8.89 KB). |
| `pnpm smoke:create-plugin` | PASS | Network, file, and network-with-UI templates passed clean `cargo check`; smoke result was OK. |
| `pnpm build` | PASS | `tsc -b && vite build` completed; Vite reported `build ok`. |
| `pnpm test:rust` | PASS | Main suite: 943 passed, 0 failed, 1 ignored; integration suite: 9 ignored; zero-test suites passed. Total observed: 943 passed, 10 ignored. |
| `pnpm check:architecture` | PASS | Printed `[architecture] OK`. |

### GitNexus MCP status

- `npx gitnexus status` initially reported the index stale at commit `4cbe682`; `npx gitnexus analyze` refreshed it to `bc02503` but generated `AGENTS.md` and `CLAUDE.md`, which were restored immediately.
- The connected MCP reader then reported `Database file version: 42, Current build storage version: 40`. The index was rebuilt with reader-compatible GitNexus `1.6.5`; generated GitNexus skill changes were restored, and status reported the index up to date at `bc02503`.
- Path-targeted MCP queries for desktop build, desktop tests, Tauri, release, and plugin API synchronization completed without a storage-version error. Results identified the architecture checker and migration documents, Tauri startup/plugin loading, updater/release coverage, and plugin host/runtime flows; build/test configuration scripts themselves are not modeled as precise execution processes.
- Upstream impact targeting this documentation file returned no graph target and risk `UNKNOWN`; no production symbol is edited by this task.

### Task 8 packaging verification

| Command or check | Result | Notes |
|---|---|---|
| `pnpm test tests/repository/packagingPaths.test.ts -- --run` | PASS | 1 file and 3 tests passed; AUR, Snap, and Winget retain their released artifact names and avoid obsolete Tauri source paths. This characterization contract passed before configuration changes, as expected. It structurally accepts YAML indentation while requiring Snap's `source: nexora.deb` value and AUR's exact source assignment. |
| Portable `git ls-files -z -- aur snap .github/workflows` Node source-layout scan from Task 8 | PASS | Tauri references use `apps/desktop/src-tauri` or `projectPath: apps/desktop`; AUR uses `nexora_${{ steps.version.outputs.version }}_amd64.deb` and `./aur/PKGBUILD`, Snap uses `snap/nexora.deb`, and Winget retains the `_x64-setup\\.exe$` matcher. |
| `pnpm lint:workflows .github/workflows/aur.yml .github/workflows/snap.yml .github/workflows/winget.yml` | PASS | The checksum-verified actionlint v1.7.7 launcher exited 0 with no diagnostics. |
| Exact four-command Task 8 source-layout block, run verbatim | LIMITATION | The pasted shell block returns overall status 0 because its final AUR command passes, but the third (Snap) command independently exits 1. That check requires an unindented whole line equal to `source: nexora.deb`, while valid current YAML has four-space indentation at `snap/snapcraft.yaml:44`. Both `test -f` commands and the exact AUR line check pass. Store metadata was not changed to satisfy this brittle textual check. |
| Structural source-layout equivalent in `packagingPaths.test.ts` | PASS | Snap's indented `source: nexora.deb` mapping and AUR's exact `source=("${_pkgname}_${pkgver}_amd64.deb")` assignment are both verified without changing metadata semantics. No store publication or secrets were used. |
| First concurrent `pnpm test -- --run` | FAIL | 180 files passed and 1 failed; 2 of 2,952 tests timed out at the fixed 5-second limit in `tests/repository/rootCommands.test.ts` while other full checks ran concurrently. |
| Isolated `pnpm test tests/repository/rootCommands.test.ts -- --run` | PASS | 1 file and all 16 tests passed. |
| Fresh non-concurrent `pnpm test -- --run` | PASS | 181 files and all 2,952 tests passed. |
| GitNexus query and upstream impact attempts | UNAVAILABLE | The connected MCP reader reported `Database file version: 42, Current build storage version: 40`; no production symbol or API route is edited by Task 8. |

## Desktop workspace migration final gate

**Commit under verification:** `40d1d5d`
**Phase base:** `b689007`
**Date:** 2026-07-21

### Tracked layout and inventory comparison

| Command or check | Result | Notes |
|---|---|---|
| `git ls-files 'apps/desktop/**' 'tests/**' 'src/**' 'public/**' 'src-tauri/**' 'index.html' 'vite.config.ts' 'vitest.config.ts' 'tsconfig*.json' 'postcss.config.js'` | PASS | 837 paths matched. All desktop paths are under `apps/desktop/**`; the 10 root test paths are all under `tests/repository/**`; no root desktop path matched. |
| Pre/post tracked-tree inventory against `b689007` | PASS | Tracked files: 977 before and 984 after. `apps/`: 0 before, 827 after; root `src/`: 416 to 0; root `public/`: 13 to 0; root `src-tauri/`: 221 to 0; root `tests/`: 174 to 10; root non-repository tests: 170 to 0; forbidden root desktop paths: 657 to 0. |
| Preflight `/tmp/nexora-desktop-paths.before` compared with `/tmp/opencode/nexora-desktop-paths.after` | PASS | Before: 831 lines, SHA-256 `d8178d3af045b37aa454c87c86506db796453f7b4a5892689701ddce48e34893`; after: 837 lines, SHA-256 `52989880663e8ad329ed23d9a8d41d07dc7052cf21dfa49ae5e7d356aeae3592`. The no-index stat reports 833 insertions and 827 deletions, reflecting relocation plus final repository contracts. |
| Preflight `/tmp/nexora-path-references.before` compared with `/tmp/opencode/nexora-path-references.after` | PASS | Before: 865 lines, SHA-256 `767b43a3d829cdcddfe24e58d68c9c8d1ff6f5851e52fcb6c94e1fb2a1f3f639`; after: 869 lines, SHA-256 `6bd0f454613f0a79777bd37f72a62504edc818fac31385acab74b7318c3d5832`. The no-index stat reports 831 insertions and 827 deletions. |
| `git diff --name-status -M90% b689007..HEAD` and `git diff --numstat -M90% b689007..HEAD` | PASS | 865 entries: 821 renames, 25 modifications, 13 additions, and 6 deletions. Of the renames, 820 are `R100`; `src/utils/settings.ts` to `apps/desktop/src/utils/settings.ts` is `R099` solely because its repository-root roadmap import changed from `../../roadmap.json` to `../../../../roadmap.json`. No production body or assertion rewrite was found. |
| `git log --oneline b689007..HEAD` | PASS | Exactly nine migration commits were present through `40d1d5d`; commit subjects align with Tasks 1–9 and no Task 10 commit was created. |

### Task 10 verification commands

| Command | Result | Notes |
|---|---|---|
| `pnpm test tests/repository -- --run` | PASS | 10 files and 55 tests passed. |
| `pnpm test apps/desktop/tests/version.test.ts apps/desktop/tests/layout/rootOverflow.test.ts tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts -- --run` | PASS | 4 files and 10 tests passed. |
| `pnpm check:architecture` | PASS | Printed `[architecture] OK`. |
| `pnpm test -- --run` | PASS | Final post-documentation rerun: 181 files and 2,965 tests passed. The earlier pre-documentation run passed 181 files and 2,952 tests; the count difference is due to environment-dependent create-plugin smoke fixtures discovered by the desktop test orchestrator, with zero failures in both runs. |
| `pnpm typecheck` | PASS | Desktop application and Node configuration TypeScript checks exited 0. |
| `pnpm lint` | PASS | Root-owned `eslint .` exited 0. |
| `pnpm build:plugin-api` | PASS | Plugin API ESM and declarations built successfully. |
| `pnpm check:plugin-api` | PASS | Host/package synchronization check exited 0 against `apps/desktop/src/pluginApi.ts`. |
| `pnpm build:create-plugin` | PASS | Create-plugin CLI built successfully. |
| `pnpm smoke:create-plugin` | PASS | Network, file, and network-with-UI templates passed smoke validation. |
| `pnpm build` | PASS | Desktop TypeScript and Vite production build exited 0 and wrote `apps/desktop/dist`. |
| `pnpm test:rust` | PASS | Main suite: 943 passed, 0 failed, 1 ignored; integration suite: 9 ignored; zero-test suites passed. Total observed: 943 passed, 10 ignored. |
| `pnpm --filter @nexora/desktop test -- --run` | PASS | 181 files and 2,965 tests passed independently through the desktop package. |
| `pnpm --filter @nexora/desktop typecheck` | PASS | Workspace-local typecheck exited 0. |
| `pnpm --filter @nexora/desktop build` | PASS | Workspace-local production build exited 0. |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | Main suite: 943 passed, 0 failed, 1 ignored; integration suite: 9 ignored; zero-test suites passed. |
| `pnpm tauri info` | PASS | Tauri resolved the desktop package and crate under `apps/desktop`. |
| `pnpm tauri build --debug --no-bundle` | PASS | Debug no-bundle build completed successfully. |
| `pnpm lint:workflows .github/workflows/*.yml` | PASS | Checksum-verified actionlint v1.7.7 exited 0. |
| `pnpm test tests/repository/packagingPaths.test.ts -- --run` | PASS | 1 file and 3 packaging tests passed. |
| `pnpm dev -- --host 127.0.0.1` plus HTTP probe | PASS | Root delegated to `@nexora/desktop`; Vite 8.1.5 became ready in 186 ms and the HTTP probe to `127.0.0.1:5173` succeeded before the process was intentionally stopped. The expected stop produced the package-manager lifecycle termination line. |
| `git status --short`, `git diff --stat`, `git diff --summary`, `git diff --check`, and `git diff --find-renames=90% -- apps/desktop` | PASS | Before Task 10 documentation edits the worktree was clean; no whitespace errors were found. The phase diff against `b689007` was also checked with 90% rename detection as recorded above. |

### GitNexus changed-flow review

- `gitnexus_detect_changes({scope: "compare", base_ref: "main", repo: "nexora"})` was attempted and failed because the connected MCP reader reported `Database file version: 42, Current build storage version: 40`.
- The documented fallback refresh, `node .gitnexus/run.cjs analyze`, was attempted and failed because the existing LadybugDB FTS index was inconsistent: `FTS index 'file_fts' is inconsistent: document for node offset 898 is missing during delete`.
- No production symbol is modified by Task 10. Git fallback review used `git diff --name-status -M90% b689007..HEAD`, `git diff --numstat -M90% b689007..HEAD`, `git diff --check b689007..HEAD`, tracked before/after inventories, commit-log inspection, and path-sensitive repository contracts. The observed phase scope is build/test/package/release/path resolution and path-only source/test/crate relocation.
- Hosted `.github/workflows/release-dry-run.yml` execution is not available from this local gate and remains required before merge or release.
