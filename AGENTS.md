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

## Implementation Rules
- Do not make one-off fixes when the bug is caused by unclear state ownership. First identify the source of truth, then route all callers through it.
- Keep database context (`connectionId`, `database`, `schema`, `table`) explicit. Do not infer database from schema names or UI labels.
- Shared behavior used by more than one component must live in `src/utils/`, `src/hooks/`, or a focused context method, not duplicated inside components.
- Components may own presentation state only. Cross-component state such as active database/schema/table must live in context or a dedicated shared hook.
- Avoid render-time state updates. Never call `setState` directly during render to sync props; derive state with `useMemo` or update state from event handlers.
- Do not clear already-loaded UI data when switching active database/schema unless the data is invalid. Preserve stale-but-valid data while new data loads.

## Mandatory Testing Rules
- Every behavior change must include a regression test in the same task. Do not report completion with only manual verification.
- If no automated test is possible, state the exact reason and ask before finishing. This is an exception, not the default.
- For every bug fix, add a test that fails on the old behavior and passes with the fix.
- For every refactor, add or update tests that prove the public behavior did not change.
- For UI state bugs, add component or context tests that assert the visible state after the relevant interaction, not just that callbacks were called.
- For database/schema/table behavior, tests must cover the actual context tuple being passed (`connectionId`, `database`, `schema`, `table`) and must include a stale/previous-selection case when applicable.
- For autocomplete/query execution changes, tests must verify both displayed suggestions and backend invocation parameters.
- For async loading changes, tests must cover the loading path and the already-loaded path.

## Required Verification Before Reporting Done
- Run the narrowest relevant test files first, for example `pnpm test tests/utils/foo.test.ts tests/components/bar.test.tsx`.
- Run `pnpm typecheck` after TypeScript changes.
- Run `pnpm lint` after TypeScript/React changes.
- Run Rust tests for Rust/backend changes: `pnpm test:rust` or the relevant `cargo test` command in `src-tauri`.
- MUST run the full CI-equivalent local checks before pushing a branch, creating/updating a PR, merging, tagging, or releasing: `pnpm test -- --run`, `pnpm typecheck`, `pnpm lint`, `pnpm build:plugin-api`, `pnpm check:plugin-api`, `pnpm build:create-plugin`, `pnpm smoke:create-plugin`, `pnpm build`, and `pnpm test:rust` when Rust/Tauri files changed.
- MUST NOT push, merge, tag, release, or report completion if any required local check fails. Fix the failure, rerun the failed command, then rerun the full affected check set.
- If a command fails, fix the issue and rerun it. Do not report a task as done with failing checks.
- Final response must list the exact test/check commands run.

## Test Placement Rules
- Tests must live under `tests/` mirroring `src/` paths.
- Utility logic in `src/utils/foo.ts` must have tests in `tests/utils/foo.test.ts`.
- Hooks in `src/hooks/useFoo.ts` must have tests in `tests/hooks/useFoo.test.ts` when behavior changes.
- Context changes in `src/contexts/FooProvider.tsx` must have tests in `tests/contexts/FooProvider.test.tsx`.
- Component behavior changes in `src/components/.../Foo.tsx` must have tests in `tests/components/.../Foo.test.tsx`.
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

This project is indexed by GitNexus as **nexora** (9537 symbols, 23653 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

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
