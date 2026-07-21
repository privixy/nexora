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
