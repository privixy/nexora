# Architecture Guard Bypass Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all seven confirmed architecture-policy bypasses without weakening any existing guard.

**Architecture:** Extend the dependency-free architecture checker with focused JavaScript and Rust lexical/parser helpers. Normalize and validate repository paths before containment/alias decisions, and verify each control with table-driven adversarial temporary-repository fixtures.

**Tech Stack:** Node.js ESM, TypeScript, Vitest, pnpm, Rust source analysis without new dependencies.

## Global Constraints

- Use TDD: establish red tests before production changes.
- Reject ambiguous absolute or repository-escaping paths.
- Preserve dated thin-command exception behavior.
- Ignore comments and strings in source-code controls.
- Add no external dependencies.
- Run targeted repository tests, full architecture tests/check, typecheck, and lint.

---

### Task 1: Adversarial regression inventory

**Files:**
- Modify: `tests/repository/architecturePolicyChecker.test.ts`

**Interfaces:**
- Consumes: `collectViolations(root, policy, inventory)`.
- Produces: table-driven fixtures describing all seven bypass families.

- [ ] Add failing table-driven tests for JS-family production extensions, normalized/escaped paths and aliases, `import.meta.glob`/`globEager`, nested Rust `cfg(test)`, production test-gated `include!`, Tauri command attribute aliases, and `std::fs` aliases/imports in thin commands.
- [ ] Include safe controls proving comments, strings, static allowed imports, and unexpired exceptions remain accepted.
- [ ] Run `pnpm test tests/repository/architecturePolicyChecker.test.ts -- --run` and confirm failures correspond to the bypasses.

### Task 2: JavaScript-family parser and path controls

**Files:**
- Modify: `scripts/check-architecture.mjs`
- Test: `tests/repository/architecturePolicyChecker.test.ts`

**Interfaces:**
- Produces focused token/static-reference helpers and canonical repository-path resolution used by frontend and repository-test controls.

- [ ] Expand production source inventory rejection to `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, and `.cts`.
- [ ] Canonicalize source roots, importers, forbidden roots, alias targets, and resolved relative paths; reject absolute paths, escapes, and ambiguous aliases.
- [ ] Parse static `import.meta.glob(...)` and `import.meta.globEager(...)` references; reject non-static targets where the forbidden-root control applies.
- [ ] Run the targeted repository test and confirm the JS/path cases pass.

### Task 3: Rust parser controls

**Files:**
- Modify: `scripts/check-architecture.mjs`
- Test: `tests/repository/architecturePolicyChecker.test.ts`

**Interfaces:**
- Produces Rust lexical helpers for attributes, use trees, macro invocations, and executable path references.

- [ ] Detect every `cfg` predicate containing `test`, including `any`, `all`, `not`, and arbitrary nesting.
- [ ] Reject `include!` in production when gated by a test-containing `cfg`/`cfg_attr` context.
- [ ] Resolve bare, aliased, and grouped `tauri::command` attributes.
- [ ] Resolve `std::fs`, module aliases, grouped imports, and directly imported filesystem functions in thin commands while excluding comments and strings.
- [ ] Keep valid, unexpired thin-command exceptions exempt and expired exceptions rejected.
- [ ] Run the targeted repository test and confirm all Rust cases pass.

### Task 4: Verification and commit

**Files:**
- Modify only files required by Tasks 1–3.

**Interfaces:**
- Produces a verified commit containing all seven fixes and regressions.

- [ ] Run `pnpm test tests/repository/architecturePolicyChecker.test.ts -- --run`.
- [ ] Run the full repository architecture test set identified from package scripts.
- [ ] Run `pnpm check:architecture`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Inspect `git status`, `git diff`, and recent commits; run GitNexus change detection where available.
- [ ] Commit only intended files with a repository-style concise message.
