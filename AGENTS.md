# AGENTS.md

## Project Overview
Nexora is a desktop DBMS/database management tool built with React/TypeScript and Tauri/Rust. It supports multiple database engines through built-in and external drivers, with driver-specific capabilities controlling which UI actions and backend operations are available.

## Architecture Principles
- Design database features through the `DatabaseDriver` abstraction and `DriverCapabilities`; do not hardcode behavior for only one engine unless the code is explicitly inside that driver implementation.
- The frontend must gate feature UI by capabilities, not by driver name. Capabilities should default to safe/disabled values for external plugins unless they opt in.
- Do not build engine-specific SQL in frontend components for database/schema/table operations. Add backend commands that delegate to `DatabaseDriver` methods so SQL, API calls, or non-SQL semantics live in the driver/plugin layer.
- Keep new functionality extensible for future databases: prefer semantic operations (`create_database`, `truncate_table`, etc.) over assuming relational SQL syntax.
- Built-in drivers and plugins may support different feature sets. Implement graceful degradation when a capability is unavailable.
- Avoid shortcuts that make future drivers difficult to add, such as branching UI logic on `postgres`/`mysql`, reusing table-management capabilities for unrelated DDL, or assuming schemas/databases mean the same thing across engines.

## Repository Architecture
- `docs/architecture/repository-structure.md` is the canonical source for current enforced paths, target paths, dependency direction, test ownership, temporary compatibility exceptions, and required verification.
- Run `pnpm check:architecture` after repository structure, test placement, workspace dependency, or large-file changes.
- Global frontend provider composition lives in `apps/desktop/src/app/providers.tsx`; preserve its tested provider order, nesting, children placement, global gates/modals, and forwarded props.
- Architecture thresholds are 500 lines for new TypeScript/TSX files and 800 lines for new Rust files; files listed in `architecture/policy.json` are ratcheted to their stored line counts.
- Rust commands under `apps/desktop/src-tauri/src/commands/` are transport adapters; domains own Tauri-independent workflows and explicit context, drivers own database semantics, infrastructure owns engine-neutral mechanisms, and dated thin-command exceptions must expire rather than become permanent debt.
- Pure compatibility facades contain re-exports only and externally public facades must not be removed from repository-local zero-consumer evidence.
- Root `export.rs`, `dump_commands.rs`, and `clipboard_import.rs` are frozen exact-path legacy transfer owners until approved `DatabaseDriver` semantics replace them. `count_query_compat.rs` and `server_time_compat.rs` are crate-private exact-path owners that must not gain commands, public re-exports, or additional SQL.
- Do not increase file-size baselines. Reduce or remove baselines when files shrink or split.
- Desktop frontend tests live under `apps/desktop/tests/` and are assigned to their source or contract owner by `architecture/policy.json`; root tests exist only in `tests/repository/` without desktop-private imports. Package tests live under `packages/<package>/tests/`.
- Desktop Rust tests use canonical module-local `tests.rs`/`tests/` loaded by `#[cfg(test)] mod tests;`; production/test `#[path]` and `cfg_attr(..., path = ...)`, peer `*_tests.rs`, non-trivial inline suites, and unclassified conventional, nested, or custom Cargo integration targets are forbidden. Create-plugin generated Rust test layouts are package-owned and verified from the packed templates.
- Suite splitting is deferred to the frontend and backend modularization plans.
- Frontend feature boundaries are enforced by `pnpm check:architecture`: cross-feature consumers use feature roots, platform/shared cannot import features, features cannot import app, direct Tauri imports remain exact reported migration debt, and feature cycles are forbidden.
- `tests/repository/frontendSourceOwnership.test.ts` is the authoritative one-row-per-source ownership manifest for frontend Tasks 2-40; SQL and driver-specific frontend debt are frozen by repository canaries.
- Workspace discovery includes `apps/*`, and `apps/desktop/package.json` is the working private desktop package.
- Desktop frontend source, assets, dependencies, scripts, and app-local configuration live under `apps/desktop/`; root commands delegate to that package.
- CI and release commands run from the repository root. Rust caches use `apps/desktop/src-tauri`, Tauri actions set `projectPath: apps/desktop`, and release dry-run triggers own moved desktop version, build, configuration, and icon paths.
- Validate workflow YAML with the checksum-verified, pinned actionlint v1.7.7 launcher through `pnpm lint:workflows`.
- Root owns `package.json`, `eslint.config.js`, `vitest.config.ts`, `pnpm-workspace.yaml`, `pnpm lint`, the six ESLint runtime packages, Vitest orchestration, and `tests/repository/`; the desktop workspace owns its Vitest project, setup, coverage, source, assets, tests, manifests, dependencies, remaining app-local configuration, and Tauri crate.
- `apps/desktop/src/features/plugins/lib/pluginApi.ts` is the canonical host-side plugin contract owner. `@nexora/plugin-api` verifies source, checked-in emitted declarations, and the canonical packed/public contract against a reasoned drift baseline. Root `package.json` is the release version source and synchronizes the desktop package, app source, and Tauri manifests.
- Contributors must continue running supported commands from the repository root.
- Do not describe unwired target paths as usable until the migration that creates and wires them lands.
- Update the architecture document in the same PR when repository paths, dependency rules, test ownership, or compatibility exceptions change.
- Do not introduce new legacy exceptions.

## Implementation Rules
- Do not make one-off fixes when the bug is caused by unclear state ownership. First identify the source of truth, then route all callers through it.
- Keep database context (`connectionId`, `database`, `schema`, `table`) explicit. Do not infer database from schema names or UI labels.
- Shared behavior used by more than one component must live in `apps/desktop/src/utils/`, `apps/desktop/src/hooks/`, or a focused context method, not duplicated inside components.
- Components may own presentation state only. Cross-component state such as active database/schema/table must live in context or a dedicated shared hook.
- Avoid render-time state updates. Never call `setState` directly during render to sync props; derive state with `useMemo` or update state from event handlers.
- Do not clear already-loaded UI data when switching active database/schema unless the data is invalid. Preserve stale-but-valid data while new data loads.

## Mandatory Testing Rules
- Every behavior change must include a regression test in the same task. Do not report completion with only manual verification.
- If no automated test is possible, state the exact reason and ask before finishing. This is an exception, not the default.
- For every bug fix, add a test that fails on the old behavior and passes with the fix.
- For every refactor, add or update tests that prove the public behavior did not change.
- For UI state bugs, add component or context tests that assert the visible state after the relevant interaction, not just that callbacks were called.
- For every bug fix, tests MUST cover the complete user-reported workflow, including the action that originally blocks the user and the final action the user expects to perform; do not stop at an intermediate successful callback.
- For credential/import bugs, tests MUST cover missing credential input, retry/load using the newly entered credential, save without unrelated blocking validation, and the saved backend invocation payload.
- For database/schema/table behavior, tests must cover the actual context tuple being passed (`connectionId`, `database`, `schema`, `table`) and must include a stale/previous-selection case when applicable.
- For autocomplete/query execution changes, tests must verify both displayed suggestions and backend invocation parameters.
- For async loading changes, tests must cover the loading path and the already-loaded path.

## Required Verification Before Reporting Done
- Run the narrowest relevant test files first with `pnpm exec vitest run --project repository tests/repository/<file>.test.ts`, `pnpm exec vitest run --project desktop apps/desktop/tests/<file>.test.tsx`, or the package-local test command.
- Root test commands are `pnpm test -- --run`, `pnpm test:repository -- --run`, `pnpm test:desktop -- --run`, and desktop-owned coverage via `pnpm test:coverage`.
- Run `pnpm check:architecture` after repository structure, test placement, workspace dependency, or large-file changes.
- Run `pnpm typecheck` after TypeScript changes.
- Run `pnpm lint` after TypeScript/React changes.
- Run Rust tests for Rust/backend changes: `pnpm test:rust` or the relevant `cargo test` command against `apps/desktop/src-tauri/Cargo.toml`.
- MUST run the full CI-equivalent local checks before pushing a branch, creating/updating a PR, merging, tagging, or releasing: `pnpm test -- --run`, `pnpm typecheck`, `pnpm lint`, `pnpm test:plugin-api`, `pnpm typecheck:plugin-api`, `pnpm build:plugin-api`, `pnpm check:plugin-api`, `pnpm pack:plugin-api`, `pnpm test:create-plugin`, `pnpm typecheck:create-plugin`, `pnpm build:create-plugin`, `pnpm smoke:create-plugin`, `pnpm pack:create-plugin`, `pnpm check:packages`, `pnpm build`, and `pnpm test:rust` when Rust/Tauri files changed.
- MUST NOT push, merge, tag, release, or report completion if any required local check fails. Fix the failure, rerun the failed command, then rerun the full affected check set.
- If a command fails, fix the issue and rerun it. Do not report a task as done with failing checks.
- Final response must list the exact test/check commands run.

## Test Placement Rules
- Desktop tests must live under `apps/desktop/tests/` with ownership recorded by the architecture policy; root `tests/repository/` contains non-desktop repository contracts only.
- Utility logic in `apps/desktop/src/utils/foo.ts` must have tests in `apps/desktop/tests/utils/foo.test.ts`.
- Hooks in `apps/desktop/src/hooks/useFoo.ts` must have tests in `apps/desktop/tests/hooks/useFoo.test.ts` when behavior changes.
- Context changes in `apps/desktop/src/contexts/FooProvider.tsx` must have tests in `apps/desktop/tests/contexts/FooProvider.test.tsx`.
- Component behavior changes in `apps/desktop/src/components/.../Foo.tsx` must have tests in `apps/desktop/tests/components/.../Foo.test.tsx`.
- Page-level UI behavior may be tested through the smallest affected component/context; avoid brittle full-page tests unless the page owns the behavior.
- Rust tests must not be written inline in production source files. Put Rust tests in sibling `tests.rs` files (or `tests/*.rs` modules) and load them with `#[cfg(test)] mod tests;` only.
- Do not embed private keys, tokens, credentials, or secret-like fixtures in production source files or test source files. Generate temporary test credentials at runtime or use non-secret structural assertions instead.

## Directives
Adhere to the rules defined in the [rules directory](./.rules/):
- [General Rules](./.rules/general.md) (Logging & Language)
- [Rust Rules](./.rules/rust.md) (Backend module structure and Rust testing)
- [TypeScript Rules](./.rules/typescript.md)
- [React Rules](./.rules/react.md)
- [Modal Styling Rules](./.rules/modals.md) (Modal component structure and styling)
- [Testing Conventions](./.rules/testing.md) (Test file organization and structure)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **nexora** (14584 symbols, 27938 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/nexora/context` | Codebase overview, check index freshness |
| `gitnexus://repo/nexora/clusters` | All functional areas |
| `gitnexus://repo/nexora/processes` | All execution flows |
| `gitnexus://repo/nexora/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
