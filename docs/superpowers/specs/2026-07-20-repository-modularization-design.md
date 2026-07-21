# Nexora Repository Modularization Design

**Date:** 2026-07-20
**Status:** Approved design, pending implementation plan

## 1. Purpose

Restructure the entire Nexora repository into clear, enforceable modules without changing application behavior. The work covers the desktop frontend, Tauri backend, tests, published packages, plugin contracts, tooling, CI, packaging, and release workflows.

This program is structural only. It must improve ownership, maintainability, readability, test placement, and dependency direction while preserving runtime behavior and public contracts.

## 2. Constraints

- Move the desktop product from the repository root to `apps/desktop/`.
- Cover the full roadmap, implemented as small independent branches or pull requests.
- Keep every batch independently green, mergeable, reversible, and reviewable.
- Use `git mv` for path-only migrations before splitting or rewriting modules.
- Internal import paths may change when migrated atomically.
- Preserve published package APIs, plugin manifests, plugin JSON-RPC contracts, and externally consumed interfaces unless separately versioned.
- Classify public compatibility facades as preserved external contracts. Remove one only through separately approved, versioned API-removal work backed by external-consumer evidence; zero in-repository consumers is insufficient.
- Do not change SQL, database-specific behavior, driver capabilities, command payloads, serialization, errors, timeouts, UI behavior, or state ownership during structural phases.
- Inventory and characterize hardcoded frontend SQL and driver-specific syntax, but remediate it in a separate future program.
- Add automated architecture guards, including soft file-size ratchets.
- Do not leave the default branch temporarily broken between phases.

## 3. Chosen Strategy

Use a foundation-first migration:

1. Establish a behavioral baseline and characterization coverage.
2. Add architecture rules and automated guards.
3. Move the desktop application to `apps/desktop/` as path-only changes.
4. Normalize test placement and naming.
5. Establish frontend contracts and platform gateways.
6. Decompose frontend modules by feature.
7. Establish backend module foundations.
8. Decompose backend modules by domain and infrastructure responsibility.
9. Consolidate package and plugin contract ownership.
10. Update workspace tooling, CI, packaging, and release workflows.
11. Remove temporary internal migration layers where eligible and ratchet guards; preserve public compatibility facades and separately owned behavior-compatibility workflows.

This sequence is preferred over moving first because every high-churn path or module migration will be protected by tests and enforceable repository rules.

## 4. Repository Architecture

### 4.1 Target layout

```text
nexora/
├── apps/
│   └── desktop/
│       ├── src/
│       ├── tests/
│       ├── src-tauri/
│       ├── public/
│       └── app-local configuration
├── packages/
│   ├── plugin-api/
│   │   ├── src/
│   │   └── tests/
│   └── create-plugin/
│       ├── src/
│       └── tests/
├── plugins/
├── scripts/
├── workspace configuration
└── CI and release orchestration
```

### 4.2 Ownership rules

- `apps/desktop/` owns all React, Tauri, desktop assets, app-specific configuration, and desktop tests.
- Each package owns its production source, tests, fixtures, build configuration, and publication checks.
- `plugins/` owns manifest schemas, registry material, and plugin-facing documentation or contract artifacts that are not package implementation details.
- The repository root owns workspace orchestration, shared automation, CI entry points, and release coordination only.
- Root-level production source, desktop tests, and desktop-specific build configuration are not permitted after migration.

### 4.3 Dependency direction

- The desktop application may depend on package public entry points.
- Packages must not import desktop internals.
- Packages must not deep-import another workspace's private modules.
- Published plugin contracts must have an explicit source of truth and synchronization checks.
- Internal, non-public compatibility re-exports may bridge separate migration pull requests and may be removed after all internal consumers migrate. Public compatibility facades remain preserved unless separately approved, versioned API-removal work supplies external-consumer evidence.

### 4.4 Benefits

This layout makes location communicate ownership, build scope, test scope, compatibility risk, and release impact. It gives CI an enforceable way to select checks, prevents packages from coupling to application internals, and gives future applications or packages an unambiguous placement rule.

The physical move does not itself solve oversized components or backend orchestration. It creates the stable product boundary within which those modules can then be decomposed safely.

## 5. Frontend Architecture

### 5.1 Target layout

```text
apps/desktop/src/
├── app/
├── features/
│   ├── connections/
│   ├── editor/
│   ├── explorer/
│   ├── data-grid/
│   ├── schema/
│   ├── notebooks/
│   ├── plugins/
│   ├── mcp/
│   └── settings/
├── platform/
│   └── tauri/
└── shared/
    ├── ui/
    ├── hooks/
    ├── lib/
    └── types/
```

The exact feature list may be refined from dependency and flow analysis, but every resulting feature must have one clear owner and a public entry point.

### 5.2 Responsibilities

- `app/` owns bootstrap, routing, global provider composition, and application shell wiring.
- A feature owns its feature-specific components, hooks, state, types, utilities, and tests.
- `shared/ui/` contains generic visual primitives only. It must not access database context or invoke Tauri commands.
- `shared/hooks/`, `shared/lib/`, and `shared/types/` contain only genuinely cross-feature, domain-neutral code.
- `platform/tauri/` owns typed command gateways, command names, request and response types, explicit database context tuples, and shared error normalization.

### 5.3 Dependency rules

- Features may import `shared/*` and `platform/*` through approved public paths.
- Cross-feature access must use an explicit feature public entry point; private deep imports are prohibited.
- Generic shared modules must not import feature modules.
- A helper is not moved to `shared` without at least two real cross-feature consumers.
- Domain contracts must not be owned by React provider implementation files.
- React component files must follow Fast Refresh rules and not export unrelated helpers or constants.

### 5.4 Decomposition method

Large orchestrators such as the editor and explorer are decomposed leaf-first:

1. Characterize visible behavior and backend invocation parameters.
2. Extract pure helpers without changing call sites.
3. Extract focused hooks or controllers while preserving state ownership.
4. Extract presentation sections receiving explicit props.
5. Retain a thin orchestration component that coordinates already-extracted modules.
6. Change state ownership only in a separate behavior-approved task.

Direct Tauri calls are migrated behind typed gateways in focused batches. The migration must preserve command names, payload omission rules, database context, error behavior, call order, and returned shapes.

## 6. Rust Backend Architecture

### 6.1 Target layout

```text
apps/desktop/src-tauri/src/
├── app/
├── commands/
├── domains/
│   ├── connections/
│   ├── queries/
│   ├── catalog/
│   ├── schema/
│   ├── import_export/
│   ├── notebooks/
│   └── tasks/
├── drivers/
├── plugins/
└── infrastructure/
    ├── persistence/
    ├── credentials/
    ├── tunnels/
    ├── logging/
    └── windows/
```

The exact domain list may be refined after current commands are cataloged, but command, domain, driver, plugin, and infrastructure responsibilities must remain distinct.

### 6.2 Responsibilities

- `app/` owns Tauri setup, state construction, and command registration.
- Command handlers under `src/commands/` are thin transport adapters only where their workflows are already expressible through `DatabaseDriver`: deserialize and validate input, call a domain service, and serialize output.
- Legacy transfer/clipboard workflows and count/server-time workflows that are not yet expressible through `DatabaseDriver` remain in their exact documented compatibility workflow owners outside `src/commands/` and generic domains until separately approved `DatabaseDriver` behavior programs replace them. This program does not claim that all legacy backend behavior becomes thin.
- `domains/` owns engine-neutral application workflows and explicit database context; it does not absorb compatibility workflows that still branch by driver, access direct pools, or construct engine-specific SQL.
- `drivers/` owns `DatabaseDriver`, built-in implementations, capabilities, dialect semantics, and database-specific behavior.
- `plugins/` owns plugin registry, process lifecycle, RPC transport, and the RPC-backed driver adapter as focused submodules.
- `infrastructure/` owns filesystem, persistence, credentials, tunnels, logging, windows, process, network, and pool mechanisms that are not domain policy.

### 6.3 Structural guarantees

- Public Tauri command names and request or response shapes remain unchanged.
- Plugin JSON-RPC methods, error codes, fallback detection, audit ordering, and response shapes remain unchanged.
- Driver trait behavior and SQL generation remain unchanged.
- `connectionId`, `database`, `schema`, and `table` remain explicit and are not inferred from labels.
- `mod.rs` files retain orchestration, exports, and trait implementations; helpers, parsers, and conversions move to focused sibling modules.
- Internal paths may be temporarily preserved with `pub use` during multi-PR migration and removed after internal consumers migrate. A public compatibility facade is preserved unless separately approved, versioned API-removal work establishes external-consumer evidence.

## 7. Test Architecture

### 7.1 TypeScript and React tests

- Use only `*.test.ts` and `*.test.tsx`.
- Place desktop tests under `apps/desktop/tests/`, mirroring `apps/desktop/src/`.
- Do not place frontend tests under production `src/`.
- Keep desktop-specific architecture and layout tests in a documented `apps/desktop/tests/repository/` namespace when they do not mirror one source file.
- Keep workspace, release, and repository-contract tests in root `tests/repository/`; this is the only root test namespace and must not import desktop-private modules.
- Keep package tests under `packages/<package>/tests/`.
- Each workspace owns its test setup, fixtures, mocks, coverage, and test command.

### 7.2 Rust tests

- Place non-trivial unit tests in sibling `tests.rs` files loaded with `#[cfg(test)] mod tests;`.
- Use module-local `tests/` directories when a unit suite becomes too large for one file.
- Do not embed non-trivial test modules in production implementation files.
- Place crate integration tests under `apps/desktop/src-tauri/tests/`.
- Classify environment-dependent integration tests explicitly. Missing external infrastructure must not silently turn a test into a successful no-op.

### 7.3 Test migration method

1. Record current file inventory, test names, ignored tests, and baseline results.
2. Add characterization tests for high-risk workflows before implementation moves.
3. Move test files without changing assertions, mocks, or fixtures.
4. Split oversized suites in later pull requests without changing assertions in the same diff.
5. Run narrow tests first, then the complete affected workspace checks.

### 7.4 Required characterization targets

Before decomposing their production modules, tests must cover at least:

- Editor query execution, batch behavior, active database and schema context, loading, and visible error states.
- Explorer database, schema, table, and view selection with stale or previous selections.
- Data-grid editing, filtering, sorting, pagination, referenced records, and backend invocation tuples.
- Connection creation, import, credentials, retry, persistence, and window lifecycle.
- Plugin capability defaults, registration, RPC fallback, and process lifecycle.
- Rust query cancellation, connection resolution, pool keys, command registration, driver delegation, and plugin process behavior.
- Existing frontend-generated SQL and driver-specific paths as behavioral debt canaries, without changing their implementation in this program.

## 8. Architecture Guards

Add CI-enforced repository checks for:

- No frontend tests in production source.
- Canonical test naming and placement.
- No non-trivial inline Rust test modules.
- Source-to-test mirroring where applicable.
- Documented exceptions for repository and integration suites.
- Allowed workspace and frontend dependency directions.
- Feature and package public entry points; forbidden deep imports.
- No desktop-owned production, test, asset, or app configuration files at root after migration.
- Plugin contract synchronization.
- Soft file-size thresholds.

### 8.1 File-size ratchet

File size is a signal, not an automatic modularity metric. The guard therefore:

- Warns on new files above agreed thresholds.
- Warns or fails when an already oversized file grows beyond its recorded baseline.
- Does not require arbitrary splitting of stable legacy files merely to reduce line counts.
- Allows documented exceptions for generated files, schemas, or data files.
- Removes baseline exceptions as files are decomposed.

Dependency and responsibility violations remain hard failures even when files are small.

## 9. Migration Roadmap

### Phase 0: Baseline and characterization

- Refresh the incompatible and stale GitNexus index before symbol-level planning.
- Inventory source, tests, package contracts, Tauri commands, workflows, public paths, and generated artifacts.
- Run and record full baseline checks.
- Add missing characterization tests for high-risk workflows.
- Create a separate inventory of frontend SQL and driver-specific debt.

### Phase 1: Rules and guardrails

- Define `docs/architecture/repository-structure.md` as the canonical detailed architecture reference for humans and AI agents.
- Keep `AGENTS.md` concise and directive. It must link to the canonical architecture reference and summarize the rules that must always be loaded before work begins.
- Update `.rules/` with enforceable language-specific and test-specific rules rather than duplicating the complete architecture document.
- Add repository architecture checks and CI integration.
- Add dependency direction checks and file-size ratchet baselines.
- Document approved exceptions.

### Phase 2: Desktop application path migration

Use dedicated path-only pull requests, preferably separating concerns such as:

1. Create workspace structure and move frontend source and assets with `git mv`.
2. Move frontend tests and setup with `git mv`.
3. Move `src-tauri` with `git mv`.
4. Move app-local configuration.
5. Update workspace scripts, aliases, Tauri paths, packaging, and CI references.
6. Verify development, build, test, package, and release dry-run commands.

No module splitting occurs in these pull requests.

### Phase 3: Test normalization

- Move the remaining frontend tests out of production source.
- Normalize TypeScript test names and mirrors.
- Migrate Rust inline tests in small module-level batches.
- Normalize sibling `*_tests.rs` files to the canonical structure where safe.
- Split oversized suites only after path normalization.

### Phase 4: Frontend foundations

- Extract domain contracts from React provider implementations.
- Remove known import cycles.
- Introduce typed Tauri gateways by command family.
- Establish feature public entry points and dependency checks.
- Move only clear leaf modules into their feature owners.

### Phase 5: Frontend feature decomposition

Decompose one feature per pull request series. Prioritize high-value areas such as connections, editor, explorer, data grid, schema tools, notebooks, plugins, MCP, and settings. Each extraction follows the characterization-first, leaf-first method and preserves state ownership.

### Phase 6: Rust foundations

- Split the large command module by command family while preserving registrations and public names.
- Extract cancellation, connection-resolution, and pool-key helpers.
- Split plugin process management from the RPC-backed driver adapter.
- Isolate configuration, MCP, export, dump, and health-check responsibilities.
- Preserve paths through re-exports while callers migrate; public compatibility facades remain after internal migration unless separately versioned API-removal work is approved with external-consumer evidence.

### Phase 7: Rust domain decomposition

- Make handlers under `src/commands/` thin adapters only for workflows already expressible through `DatabaseDriver`.
- Move engine-neutral workflows into domain services without changing behavior.
- Keep driver semantics and capability decisions in drivers.
- Keep the exact documented transfer/clipboard and count/server-time compatibility workflow owners outside `src/commands/` and generic domains until separately approved `DatabaseDriver` behavior programs replace them; do not claim all legacy behavior is thin.
- Move side-effect mechanisms into infrastructure modules.
- Remove only internal migration re-exports after all internal consumers migrate. Preserve public compatibility facades unless separately approved, versioned API-removal work has external-consumer evidence.

### Phase 8: Packages and plugin contracts

- Establish one source of truth for plugin-facing contracts.
- Strengthen synchronization checks beyond export-name comparison.
- Ensure each package independently owns tests, build output, and publication checks.
- Validate create-plugin templates against current contracts and expected generated structure.

### Phase 9: Tooling, CI, packaging, and release

- Make all scripts and workflows workspace-aware.
- Extract reusable CI and release setup where repetition is material.
- Validate desktop artifacts, plugin packages, create-plugin smoke tests, AUR, Snap, and registry metadata paths.
- Keep release dry-run coverage for all moved files and manifests.

### Phase 10: Cleanup and enforcement

- Remove temporary internal aliases, re-exports, and compatibility paths after internal consumer migration. Preserve public compatibility facades and behavior-compatibility workflow owners under their separate approval rules.
- Tighten architecture guards from migration allowances to target rules.
- Remove resolved file-size baselines.
- Update architecture documentation and contributor guidance.
- Confirm no deprecated root paths remain in source, scripts, workflows, packaging, or documentation.

### Future program: frontend SQL and driver-specific remediation

After structural work is stable, create a separate behavior-change program to replace frontend database operations and engine-specific SQL with semantic backend commands delegated through `DatabaseDriver`. That program requires its own design, impact analysis, capability changes, and regression tests.

## 10. Living Architecture Documentation

Architecture documentation is part of each migration batch, not a cleanup task deferred until the end.

### 10.1 Source of truth

- `docs/architecture/repository-structure.md` is the canonical detailed reference for repository ownership, module boundaries, dependency direction, test placement, public entry points, approved exceptions, and target layout.
- `AGENTS.md` is the mandatory short-form instruction entry point for AI agents. It links to the canonical reference and states non-negotiable rules, required checks, and the currently valid paths.
- `.rules/testing.md`, `.rules/react.md`, `.rules/typescript.md`, and `.rules/rust.md` contain focused implementation rules for their domains. They link to the canonical architecture reference instead of duplicating long sections.
- Architecture checks encode the machine-enforceable subset. Documentation and checks must describe the same rule.

### 10.2 Per-batch update requirement

Every pull request that changes a module boundary, path, ownership rule, test convention, public entry point, command gateway, build command, or approved exception must update the relevant documentation in the same pull request:

1. Update the canonical architecture document with the new current state and remaining migration state.
2. Update `AGENTS.md` when an AI agent's required behavior, path, command, or boundary changes.
3. Update the focused `.rules/` file when a language or test convention changes.
4. Update architecture guards when the rule is machine-enforceable.
5. Remove obsolete transitional instructions, aliases, and exceptions as soon as their migration batch completes.

Documentation must never claim the final target layout before the corresponding path is usable on the branch. During migration, each section explicitly distinguishes **current enforced state**, **target state**, and **temporary compatibility exceptions**.

### 10.3 Documentation verification

Architecture guards and repository tests must verify where practical that:

- Paths referenced by `AGENTS.md` and architecture documents exist.
- Root commands documented for contributors and AI agents remain runnable.
- Test placement rules match Vitest and Cargo discovery configuration.
- Public entry points and allowed dependency directions match the guard configuration.
- Temporary exceptions have an owner, reason, and removal phase.

A structural pull request is incomplete if code and documentation disagree, even when tests pass.

## 11. Pull Request Contract

Every implementation pull request must:

- Address one structural concern.
- State the behavior and public contracts being preserved.
- Include or reference characterization tests for the affected workflow.
- Run GitNexus impact analysis before editing symbols and warn before high-risk changes.
- Avoid combining path moves with module splitting or assertion changes.
- Keep changes independently reversible.
- Run the narrowest relevant tests first.
- Run TypeScript typecheck and lint after TypeScript or React changes.
- Run Rust tests after Rust changes.
- Run package build and smoke checks after package or template changes.
- Before push or pull request creation, run the phase-aware checks required by the current `AGENTS.md` and active child plan for the changed paths.
- Run GitNexus change detection before commit when committing is explicitly requested.
- Update the canonical architecture document, `AGENTS.md`, focused `.rules/`, and architecture guards whenever the batch changes rules or paths they describe.

A batch that fails required checks or leaves architecture instructions stale must be fixed or reverted before subsequent phases proceed.

## 12. Verification

Verification is phase-aware and defers to the current `AGENTS.md` on the branch rather than freezing a command list in this design. Every batch runs its narrow characterization or contract checks first, then every current `AGENTS.md` check applicable to its changed files and current repository layout. Commands may become workspace-filtered internally after the move, but supported equivalent root orchestration commands remain available for contributors and CI.

Before final program completion, run the then-current complete gate covering architecture and repository contracts; desktop and frontend lint, typecheck, tests, and production build; plugin-contract checks; each published package's test, typecheck, build, synchronization or smoke checks, and pack validation; version synchronization checks; Rust tests; desktop/Tauri packaging or release dry runs; and Snap, AUR, WinGet, and other distribution validations. The child plan owns exact commands and sequencing for the phase in which each gate becomes available.

## 13. Completion Criteria

The program is complete when:

- The desktop product and its tests, assets, backend, and app configuration are owned by `apps/desktop/`.
- The root contains only workspace and repository-wide concerns, including the documented `tests/repository/` contract-test namespace.
- Frontend and Rust tests follow their canonical placement with only documented exceptions.
- Architecture guards enforce workspace, package, feature, test, and public API boundaries.
- `docs/architecture/repository-structure.md`, `AGENTS.md`, focused `.rules/`, build configuration, and architecture guards consistently describe the current enforced structure.
- High-risk oversized orchestrators have been reduced to focused orchestration plus independently tested modules.
- Handlers under `src/commands/` are thin where the workflow is already expressible through `DatabaseDriver`; exact documented legacy compatibility workflow owners remain outside `src/commands/` and generic domains until separately approved behavior programs replace them.
- Public compatibility facades remain preserved unless a separately approved, versioned API removal is backed by external-consumer evidence.
- Tauri command, plugin protocol, driver, UI, state, serialization, error, and SQL behavior remains equivalent to the baseline.
- The phase-aware gate required by current `AGENTS.md` passes, including final architecture/repository, desktop/frontend, plugin-contract, package build/typecheck/test/pack, distribution/version, and Rust checks.
- Frontend SQL and driver-specific debt remains explicitly tracked for the separate behavior-change program.
