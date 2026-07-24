# Frontend Explicit Mutation Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and fix data-grid mutation and BLOB retrieval context so stale global database/schema state cannot redirect backend operations.

**Architecture:** Existing grid-owned context remains the source of truth. Direct cell updates require an explicit connection/database/schema/table tuple, while pending local edits remain available without backend context; BLOB preview/download forwards the same tuple through DataGrid, RowEditorSidebar, FieldEditor, and BlobInput only because both existing Tauri commands already accept database and schema.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Tauri gateways.

## Global Constraints

- Use TDD and observe each regression test fail before production edits.
- Preserve stale-loaded grid rows while blocking incomplete direct backend mutations.
- Do not alter Rust command contracts or driver semantics.
- Run targeted tests, `pnpm check:architecture`, `pnpm typecheck`, and `pnpm lint` before commit.

---

### Task 1: Require explicit direct cell mutation context

**Files:**
- Modify: `apps/desktop/tests/features/data-grid/hooks/useCellEditing.test.ts`
- Modify: `apps/desktop/src/features/data-grid/hooks/useCellEditing.ts`
- Modify: `apps/desktop/src/features/data-grid/components/DataGrid.tsx`

**Interfaces:**
- Consumes: grid props `connectionId`, `database`, `schema`, and `tableName`.
- Produces: `recordGateway.updateRecord` calls containing the complete explicit tuple only.

- [ ] Add a regression workflow test with stale `activeDatabase` and `activeSchema`, incomplete explicit context, and an already-loaded existing row; assert no backend call, no refresh, and retained editing data.
- [ ] Run `pnpm exec vitest run --project desktop apps/desktop/tests/features/data-grid/hooks/useCellEditing.test.ts` and confirm failure from the legacy active-context fallback/incomplete mutation.
- [ ] Remove active context options from `useCellEditing` and require all four explicit identifiers before direct `updateRecord` calls, without clearing the loaded row collection.
- [ ] Run the targeted hook test and confirm it passes.

### Task 2: Forward complete BLOB retrieval context

**Files:**
- Create: `apps/desktop/tests/features/data-grid/components/BlobInput.test.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/BlobInput.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/FieldEditor.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/RowEditorSidebar.tsx`

**Interfaces:**
- Consumes: explicit `connectionId`, `database`, `schema`, `tableName`, primary-key map, and column name.
- Produces: `fetch_blob_as_data_url` and `save_blob_to_file` payloads containing the complete tuple accepted by `commands/blobs.rs`.

- [ ] Add a canonical component workflow test rendering a truncated image BLOB with explicit context; assert preview invocation, click download, and assert the save invocation tuple.
- [ ] Run `pnpm exec vitest run --project desktop apps/desktop/tests/features/data-grid/components/BlobInput.test.tsx` and confirm failure because database is absent.
- [ ] Add and forward the database prop from RowEditorSidebar through FieldEditor to BlobInput and include it in both existing command payloads.
- [ ] Run both targeted regression files and confirm they pass.

### Task 3: Verify and commit

**Files:**
- Review all modified source and tests.

**Interfaces:**
- Produces: validated frontend-only fix and one repository commit.

- [ ] Run `pnpm check:architecture`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run the full desktop test suite if practical: `pnpm test:desktop -- --run`.
- [ ] Inspect `git status`, `git diff`, and recent log; run GitNexus change detection if available.
- [ ] Stage only intended files and commit with the repository’s conventional style.
