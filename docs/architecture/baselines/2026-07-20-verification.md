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
