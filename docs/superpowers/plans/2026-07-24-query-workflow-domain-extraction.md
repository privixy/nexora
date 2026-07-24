# Query Workflow Domain Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move query execution, batch execution, explain, cancellation, and count orchestration from Tauri commands into a Tauri-independent query domain service without changing behavior or command names.

**Architecture:** `QueryService` accepts `ConnectionContextResolver`, explicit database/schema context, cancellation state, and an optional driver progress callback. Tauri commands retain only transport extraction and event adaptation; `count_query_compat.rs` remains the unchanged frozen SQL owner.

**Tech Stack:** Rust 2021, Tokio, async-trait, Tauri 2, Cargo tests, repository architecture guards.

## Global Constraints

- Preserve sanitization, context resolution, driver arguments, abort registration/unregistration, cancellation payloads, event ordering, logs, results, errors, and Tauri command names.
- Do not modify SQL in `count_query_compat.rs`.
- Use TDD and commit only intended files after all required checks pass.

---

### Task 1: Query domain service characterization

**Files:**
- Modify: `apps/desktop/src-tauri/src/domains/queries/tests.rs`
- Modify: `apps/desktop/src-tauri/src/domains/queries/mod.rs`

**Interfaces:**
- Consumes: `ConnectionContextResolver`, `DatabaseContext`, `QueryCancellationState`, `DatabaseDriver`, `BatchProgressFn`.
- Produces: `QueryService::{cancel, execute, execute_batch, explain, count}`.

- [ ] Add fake resolver/driver tests that assert explicit context, sanitization, default page, driver arguments, result/error payloads, batch progress ordering, explain validation/invocation, count compatibility delegation, abort registration cleanup, and cancellation.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::queries::tests` and confirm failure because `QueryService` is absent.
- [ ] Implement the minimal Tauri-independent service, preserving existing logs and exact payload strings.
- [ ] Re-run the targeted domain tests and confirm they pass.

### Task 2: Thin query commands and architecture guard

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/queries.rs`
- Modify: `apps/desktop/src-tauri/src/commands/tests/queries.rs`
- Modify: `apps/desktop/src-tauri/tests/thin_command_boundaries.rs`
- Modify if required: `docs/architecture/repository-structure.md`
- Modify if required: `architecture/policy.json`

**Interfaces:**
- Consumes: `QueryService` and `TauriConnectionContextResolver`.
- Produces: unchanged Tauri commands `cancel_query`, `execute_query`, `execute_query_batch`, `explain_query_plan`, and `count_query`.

- [ ] Add a failing source guard requiring one service delegation per query command and forbidding resolution, driver calls, spawn, and cancellation registry ownership in `commands/queries.rs`.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test thin_command_boundaries queries` and confirm the guard fails against the old commands.
- [ ] Replace command workflows with thin service calls; retain only the Tauri batch-event callback adapter.
- [ ] Remove obsolete command-owned sanitization coverage or point it at the domain owner without weakening behavioral tests.
- [ ] Re-run query domain, command, and thin-boundary tests.

### Task 3: Verification and commit

**Files:**
- Commit only files changed by Tasks 1-2 and this plan.

- [ ] Run `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check`.
- [ ] Run `pnpm test:rust`.
- [ ] Run `pnpm lint:rust`.
- [ ] Run `pnpm check:architecture`, `pnpm typecheck`, and `pnpm lint` because architecture guard coverage changes.
- [ ] Inspect `git status`, `git diff`, and recent commits; ensure `count_query_compat.rs` is unchanged and exclude pre-existing untracked files.
- [ ] Run GitNexus change detection if the locked index becomes available; otherwise record the tooling blocker and verify scope from Git diff.
- [ ] Commit with a repository-style refactor message.
