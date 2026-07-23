# Capability-Aware Explicit Mutation Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate explicit frontend table mutation and BLOB context according to driver layout while never falling back to stale global context.

**Architecture:** Add one pure shared table-context validator that derives required dimensions from existing `DriverCapabilities` semantics: schema-capable layouts require schema, multi-database layouts require database, full layouts require both, and local/single-database layouts require neither. Pass explicit capabilities and context through DataGrid to direct record mutations and BLOB operations, always preserving explicit `undefined` values in backend payloads.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing driver capability utilities and Tauri gateways.

## Global Constraints

- Use TDD and observe regression tests fail before production edits.
- Never branch on driver names.
- Never fall back to active/global database or schema state.
- Preserve loaded UI data when explicit required context is missing.
- Cover schema-only, database-only, full tuple, missing required dimension, and stale-global workflows.

---

### Task 1: Shared semantic table-context validation

**Files:**
- Create: `apps/desktop/src/features/connections/lib/tableContext.ts`
- Create: `apps/desktop/tests/features/connections/lib/tableContext.test.ts`
- Modify: `apps/desktop/src/features/connections/index.ts`

**Interfaces:**
- Consumes: `DriverCapabilities | null | undefined` plus explicit `connectionId`, `database`, `schema`, and `table`.
- Produces: `resolveExplicitTableContext(input): TableContextTuple | null` with database/schema keys retained as `undefined` when semantically absent.

- [ ] Add tests for schema-only, database-only, full, local/no-dimension, and each missing-required case.
- [ ] Run the utility test and confirm failure because the resolver does not exist.
- [ ] Implement the smallest pure resolver using `capabilities.schemas === true` and `isMultiDatabaseCapable(capabilities)`.
- [ ] Run the utility test and confirm it passes.

### Task 2: Direct cell mutation workflow

**Files:**
- Modify: `apps/desktop/tests/features/data-grid/hooks/useCellEditing.test.ts`
- Modify: `apps/desktop/src/features/data-grid/hooks/useCellEditing.ts`
- Modify: `apps/desktop/src/features/data-grid/contracts.ts`
- Modify: `apps/desktop/src/features/data-grid/components/DataGrid.tsx`
- Modify: `apps/desktop/src/features/editor/pages/EditorPage.tsx`

**Interfaces:**
- Consumes: explicit grid context and `DriverCapabilities` from the owning editor connection.
- Produces: `recordGateway.updateRecord` payloads with explicit values, including `database: undefined` or `schema: undefined` where absent.

- [ ] Add workflow cases for schema-only, database-only, full tuple, missing required dimension, and stale globals.
- [ ] Run the hook test and confirm schema-only/database-only failures under the current both-required guard.
- [ ] Route direct mutation validation through `resolveExplicitTableContext`; do not read active globals.
- [ ] Run the hook test and confirm all workflows pass.

### Task 3: Truncated BLOB preview/download workflow

**Files:**
- Modify: `apps/desktop/tests/features/data-grid/components/BlobInput.test.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/BlobInput.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/FieldEditor.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/RowEditorSidebar.tsx`
- Modify: `apps/desktop/src/features/data-grid/contracts.ts`
- Modify: `apps/desktop/src/features/data-grid/components/DataGrid.tsx`

**Interfaces:**
- Consumes: the same capabilities and explicit row table context used by direct mutation.
- Produces: preview and save gateway payloads with exact explicit database/schema values, including `undefined` where semantically absent.

- [ ] Add complete preview-then-download workflow cases for schema-only, database-only, full tuple, missing required dimension, and stale globals.
- [ ] Run the BlobInput test and confirm schema-only/database-only failures.
- [ ] Use `resolveExplicitTableContext` for fetch eligibility and both backend payloads.
- [ ] Run both targeted data-grid test files and confirm they pass.

### Task 4: Verification and commit

**Files:**
- Review all changed files only.

**Interfaces:**
- Produces: one verified conventional commit.

- [ ] Run targeted tests.
- [ ] Run full desktop tests with `pnpm test:desktop -- --run`.
- [ ] Run `pnpm check:architecture`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Inspect status, diff, recent log, and available GitNexus change detection.
- [ ] Stage only intended files and commit with a repository-style message.
