# Nexora Repository Modularization Master Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved repository-wide modular architecture through small, behavior-preserving, independently mergeable pull requests.

**Architecture:** Establish tests, documentation, and machine-enforced boundaries before moving the desktop product into `apps/desktop/`. Normalize tests next, then decompose frontend and Rust/Tauri internals behind stable interfaces, and finish by hardening package contracts, CI, packaging, and release flows.

**Tech Stack:** pnpm workspaces, React 19, TypeScript 5.9, Vitest 4, Vite 8, Tauri 2, Rust 2021, Cargo, GitHub Actions.

## Global Constraints

- Structural changes must not alter runtime behavior, visible UI, SQL, database-specific semantics, state ownership, command names, payload shapes, serialization, errors, timeouts, plugin JSON-RPC, or driver capabilities.
- Use `git mv` for path-only moves and do not combine path moves with module extraction or assertion changes.
- Every behavior-preserving extraction requires existing or newly added characterization coverage first.
- Every task must update `docs/architecture/repository-structure.md`, `AGENTS.md`, focused `.rules/`, and architecture guards when the task changes paths or rules they describe.
- Documentation must distinguish current enforced state, target state, and temporary compatibility exceptions.
- Preserve published package and plugin interfaces; internal paths may change atomically.
- Classify public compatibility facades as preserved external contracts. Remove one only through separately approved, versioned API-removal work backed by external-consumer evidence; zero in-repository consumers is insufficient.
- Keep root orchestration commands available throughout migration.
- Hardcoded frontend SQL and driver-specific remediation is out of scope; only inventory and characterize it.
- Before editing a symbol, refresh GitNexus if needed and run upstream impact analysis; warn and stop for HIGH or CRITICAL risk until reviewed.
- Before any requested commit, run GitNexus change detection and review affected flows.
- Before push or pull request creation, run the phase-aware checks required by the current `AGENTS.md` plus every additional child-plan gate applicable to the changed paths.

---

## Plan Set

| Order | Plan | Deliverable | Depends on |
|---|---|---|---|
| 1 | `2026-07-20-modularization-foundation.md` | Baseline, living architecture docs, guards, characterization backlog | Approved design |
| 2 | `2026-07-20-desktop-workspace-migration.md` | Desktop product at `apps/desktop/`, root commands preserved | Foundation guards |
| 3 | `2026-07-20-test-architecture-normalization.md` | Canonical TS/React and Rust test placement | Desktop move |
| 4 | `2026-07-20-frontend-modularization.md` | Feature-owned frontend, typed Tauri gateways, reduced orchestrators | Test normalization |
| 5 | `2026-07-20-rust-tauri-modularization.md` | Thin adapters under `src/commands/` where `DatabaseDriver` already expresses the workflow; focused domain/driver/plugin/infrastructure modules; exact legacy compatibility owners retained | Test normalization |
| 6 | `2026-07-20-packages-tooling-cleanup.md` | Contract-owned packages, workspace-aware CI/release/packaging, final guards | Desktop move; task-specific final frontend paths; P2 also waits for the backend plugin split |

## Pull Request Dependency Graph

```text
F0 baseline
 ├─ F1 living architecture docs
 ├─ F2 architecture guard framework
 └─ F3 characterization coverage
       ↓
M1 workspace manifests/configs
M2 frontend source/assets git mv
M3 desktop tests git mv
M4 src-tauri git mv
M5 CI/release/packaging path repair
       ↓
T1 colocated frontend tests
T2 repository-test namespace
T3 Rust crate-level *_tests.rs batches
T4 Rust inline tests batches
T5 integration-test classification
       ↓
FE1 contracts/cycles ─→ FE2 typed gateways ─→ FE3 stable leaves ─→ FE4 orchestrators
BE1 command families ─→ BE2 shared resolution/cancellation ─→ BE3 plugin/pool/infra ─→ BE4 domains
       ↓
P1 plugin API source of truth (after final frontend plugin host paths)
P2 plugin manifest contract fixtures (after final frontend plugin contract paths and BE3 plugin split)
P3 create-plugin independent checks
P4a workspace versioning (after final frontend version paths)
P4b-d CI/release/packaging
P5 remove eligible internal migration layers and tighten guards
```

Frontend and backend decomposition may run in parallel after test normalization if they do not touch shared package contracts, root configs, or the same test files. Package work does not wait for every frontend/backend task uniformly: P1/P2 wait for the final frontend plugin paths they consume, P2 also waits for the backend plugin split, and P4a waits for final frontend version-owner paths. The package/tooling child plan owns the exact PR integration order and any finer dependencies.

## Standard Task Gate

Apply this gate to every task in every child plan.

- [ ] **Step 1: Inspect branch state**

Run:

```bash
git status --short --branch
git log --oneline -10
```

Expected: intended branch and no unrelated uncommitted files. Preserve pre-existing user changes.

- [ ] **Step 2: Read current architecture instructions**

Read:

```text
AGENTS.md
.rules/general.md
.rules/testing.md
.rules/typescript.md or .rules/rust.md
.rules/react.md for React work
docs/architecture/repository-structure.md
```

Expected: task paths and temporary exceptions match the branch's current enforced state.

- [ ] **Step 3: Analyze symbol or route impact**

For every modified function, class, method, or route, run GitNexus upstream impact analysis. For files with multiple symbols, analyze each externally referenced symbol. If the index is stale or incompatible, execute the foundation plan's index-refresh task first.

Expected: affected callers and flows are recorded in the task notes; HIGH or CRITICAL risk is reported before editing.

- [ ] **Step 4: Run the narrow baseline**

Run the exact test files listed by the child task before changing code.

Expected: PASS. If baseline fails, stop and diagnose rather than normalizing the failure into the refactor.

- [ ] **Step 5: Execute only the task's stated concern**

Do not opportunistically fix SQL, error messages, driver behavior, warnings, formatting outside touched modules, or test assertions.

- [ ] **Step 6: Run narrow verification**

Run the exact tests listed by the child task.

Expected: PASS with unchanged test semantics.

- [ ] **Step 7: Run affected workspace checks**

TypeScript/React task:

```bash
pnpm test -- --run
pnpm typecheck
pnpm lint
```

Rust/Tauri task:

```bash
pnpm test:rust
```

Package task: run that package's `test`, `typecheck`, `build`, `check:sync`, or `smoke` scripts as listed.

- [ ] **Step 8: Review structural diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: only planned files changed; pure moves appear as renames where applicable.

- [ ] **Step 9: Update living architecture instructions**

Update the canonical document, `AGENTS.md`, `.rules/`, and guard configuration if current paths, rules, commands, or exceptions changed.

Expected: docs describe what is usable on this branch, not a future state.

- [ ] **Step 10: Commit only when explicitly requested**

Before commit, run GitNexus change detection and inspect `git status`, `git diff`, and recent history. Stage only task files. Use the commit message supplied by the child task.

## Phase-Aware Push, PR, and Release Gate

Do not freeze a single command list in this roadmap. Before pushing a branch or creating/updating a pull request, run the narrow checks first, then every check required by the current `AGENTS.md` and the active child plan for the changed paths and commands available at that phase. For path, workflow, packaging, or release changes, also run repository and architecture contracts plus the applicable packaging or release dry run. Do not push or report completion while any required command fails.

Before final program completion, the child package/tooling plan must run and own the exact order of the then-current complete gate covering:

- architecture policy and repository contract checks;
- desktop/frontend lint, typecheck, tests, and production build;
- plugin-contract runtime and compiler checks;
- each published package's tests, typecheck, build, sync or smoke checks, and packed-artifact validation;
- version synchronization checks;
- Rust tests;
- desktop/Tauri package and release dry runs; and
- Snap, AUR, WinGet, and other distribution validations.

## Program Completion Gate

- [ ] Desktop source, tests, assets, app config, and Rust backend live under `apps/desktop/`.
- [ ] Root contains only workspace/repository concerns plus `tests/repository/`.
- [ ] Frontend tests mirror desktop source and no frontend test remains in production source.
- [ ] Rust non-trivial unit tests use sibling `tests.rs` or module `tests/` directories.
- [ ] Frontend feature and package dependencies pass architecture guards.
- [ ] Handlers under `src/commands/` are thin where their workflows are already expressible through `DatabaseDriver`; exact documented legacy transfer/clipboard and count/server-time compatibility workflow owners remain outside `src/commands/` and generic domains until separately approved behavior programs replace them. The program does not claim all legacy backend behavior is thin.
- [ ] Public command/protocol contracts and public compatibility facades remain equivalent; a facade is removed only by separately approved, versioned API-removal work backed by external-consumer evidence.
- [ ] Package/plugin contract checks validate more than export names.
- [ ] Root orchestration, CI, release, AUR, Snap, Winget, and package publication paths are valid.
- [ ] The phase-aware gate from current `AGENTS.md` and the package/tooling child plan passes, including final architecture/repository, desktop/frontend, plugin-contract, package build/typecheck/test/pack, distribution/version, and Rust checks.
- [ ] Living architecture docs, `AGENTS.md`, `.rules/`, configs, and guards agree.
- [ ] Hardcoded SQL debt remains separately inventoried for the later behavior-change program.
