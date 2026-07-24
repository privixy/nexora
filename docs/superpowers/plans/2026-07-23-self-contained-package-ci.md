# Self-Contained Package CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make package contract validation consume the current staged build and make clean-checkout create-plugin CI provide the canonical plugin-api tarball required by full smoke validation.

**Architecture:** The plugin-api synchronization check reads `.tmp/build/index.d.ts`, the same fresh artifact later staged and packed. CI preserves package isolation while making the create-plugin job explicitly build, stage, and inspect plugin-api before running create-plugin’s complete lifecycle.

**Tech Stack:** pnpm workspaces, TypeScript, Vitest, GitHub Actions YAML, ESLint, actionlint

## Global Constraints

- Use TDD and observe each regression test fail before changing production scripts or workflows.
- Do not weaken package lifecycle, full smoke, checksum, stale-build, or packed-artifact validation.
- Verify clean-checkout behavior without relying on ignored checked-in `dist` output.
- Commit only after all requested checks pass.

---

### Task 1: Validate the actual plugin-api build declaration

**Files:**
- Modify: `packages/plugin-api/scripts/check-sync.ts`
- Modify: `packages/plugin-api/tests/emitted-contract.test.ts`
- Modify: `tests/repository/pluginApiSyncPaths.test.ts`

**Interfaces:**
- Consumes: `extractPublicContract(path: string)` and `.tmp/build/index.d.ts` emitted by `pnpm build:plugin-api`.
- Produces: `check:sync` contract validation against the artifact staged by `pack:stage`.

- [ ] **Step 1: Write failing tests**

Assert the emitted contract test and repository source contract require `.tmp/build/index.d.ts` and reject `dist/index.d.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/plugin-api/tests/emitted-contract.test.ts tests/repository/pluginApiSyncPaths.test.ts`
Expected: FAIL because both production/test contract paths still reference `dist/index.d.ts`.

- [ ] **Step 3: Write minimal implementation**

Change `check-sync.ts` and emitted contract verification to read `.tmp/build/index.d.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm build:plugin-api && pnpm exec vitest run packages/plugin-api/tests/emitted-contract.test.ts tests/repository/pluginApiSyncPaths.test.ts`
Expected: PASS.

### Task 2: Make create-plugin CI self-contained

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/repository/packageWorkflows.test.ts`

**Interfaces:**
- Consumes: plugin-api package scripts `build`, `check:sync`, `pack:stage`, and `pack:check`.
- Produces: canonical `packages/plugin-api/.tmp/package/nexora-plugin-api-0.1.0.tgz` before create-plugin full smoke runs.

- [ ] **Step 1: Write failing repository test**

Assert the create-plugin job runs plugin-api build, sync check, staging, and package inspection before `pnpm --filter @nexora/create-plugin check`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:repository tests/repository/packageWorkflows.test.ts -- --run`
Expected: FAIL because the create-plugin job currently invokes only create-plugin check.

- [ ] **Step 3: Write minimal workflow implementation**

Add explicit plugin-api build, sync, stage, and check commands before create-plugin check in the create-plugin job.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:repository tests/repository/packageWorkflows.test.ts -- --run`
Expected: PASS.

### Task 3: Verify lifecycle from ignored-artifact-clean state

**Files:**
- Test: package and repository files modified above

**Interfaces:**
- Consumes: root package commands and package-local lifecycle scripts.
- Produces: evidence that requested package contracts and workflow lint pass without checked-in `dist` reliance.

- [ ] **Step 1: Remove generated package build/staging outputs**

Run package clean commands and delete only package `.tmp/package` outputs.
Expected: package lifecycle starts without prior build or tarball artifacts.

- [ ] **Step 2: Run requested package lifecycle commands in dependency order**

Run: `pnpm build:plugin-api`, `pnpm check:plugin-api`, plugin-api stage/check, `pnpm build:create-plugin`, `pnpm check:create-plugin` if exposed, and `pnpm smoke:create-plugin`.
Expected: PASS, with full UI smoke consuming the newly staged canonical plugin-api tarball.

- [ ] **Step 3: Run targeted tests and linters**

Run targeted package lifecycle/repository tests, `pnpm lint`, and `pnpm lint:workflows`.
Expected: PASS.

- [ ] **Step 4: Inspect and commit**

Run `git status`, `git diff`, `git log --oneline -10`, and GitNexus change detection when available; stage only intended files and commit with a concise repository-style message.
