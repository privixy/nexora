# Frontend Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the desktop frontend into feature-owned modules with contract-only public entry points, platform-owned Tauri wire contracts, typed gateways, and thin leaf-first orchestrators while preserving runtime behavior.

**Architecture:** Begin only after production code and tests live under `apps/desktop/`. First make the composition root independently green by characterizing legacy `App` behavior, moving `App.tsx`/`main.tsx` without logic changes, and separately extracting tested provider and route composition. Publish contract-only feature entry points before moving consumers; establish connection-independent plugin core before connections and publish connection-dependent plugin UI/API only afterward. Characterize raw Tauri behavior before every direct-import owner batch, then keep characterization, path-only movement, public API publication, gateway migration, and decomposition in separate green review batches.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, Vite 8, Tauri 2 JavaScript APIs, pnpm workspaces, GitNexus.

## Global Constraints

- This program is structural only: do not change runtime behavior, visible UI, state ownership, SQL, database-specific semantics, driver capabilities, command names, request or response shapes, serialization, errors, timeouts, plugin JSON-RPC, event names, or event ordering.
- Use `git mv` for path-only migrations. A path-only task may change import specifiers required by the move, but it must not change assertions, gateway usage, payload construction, exports, component decomposition, or production logic.
- Preserve omitted properties versus properties present with `undefined` or `null`.
- Preserve explicit `connectionId`, `database`, `schema`, and `table` context. Never infer one from a label or another context field.
- Preserve call order, `Promise.all` concurrency, best-effort catches, rejection identity, listener-before-invoke ordering, event ordering, and unlisten cleanup timing.
- Existing frontend-generated SQL and driver-specific syntax may be characterized and moved unchanged; remediation is excluded.
- Contract files must not import React providers or components.
- Every feature exposes `apps/desktop/src/features/<feature>/index.ts`. Cross-feature consumers import only that entry point; no barrel uses `export *`.
- `app/*` is the composition root and may import feature public entry points. Features, `platform/*`, and `shared/*` must not import `app/*`.
- Intermediate architecture commands must pass with only the exact temporary exceptions whose `removeByTask` is still in the future. They must not expect global zero direct-Tauri imports, zero legacy paths, or zero compatibility files before Tasks 39-40.
- Files under `apps/desktop/src/platform/tauri/` must never import files under `apps/desktop/src/features/`.
- Tauri wire DTOs belong in `apps/desktop/src/platform/tauri/contracts/`. A gateway may import only its sibling platform contracts, transport adapters, and Tauri packages.
- Feature dependency cycles are prohibited. The architecture guard must reject both direct and transitive cycles.
- Enforce this acyclic feature DAG: `settings -> platform`; connection-independent `plugins-core -> settings, platform`; `connections -> plugins-core, settings, platform`; connection-dependent `plugins-ui -> connections, plugins-core, settings, platform`; `schema -> connections, plugins-core, settings, platform`; `data-grid -> connections, platform`; `visual-explain -> connections, plugins-core, settings, platform`; `ai -> settings, connections, platform`; `editor -> connections, settings, schema, visual-explain, ai, data-grid, platform`; `notebooks -> connections, settings, ai, visual-explain, data-grid, editor, platform`; `mcp -> settings, platform`; `tasks -> platform`; `explorer -> editor, connections, schema, notebooks, platform`. Both plugin phases publish from the supported `features/plugins/index.ts` root; the phase labels describe sequencing, not extra feature roots. App composition replaces every reverse edge, especially `settings -> plugins`, `settings -> visual-explain`, and `editor -> notebooks`. Notebook/editor shared result and tab primitives are neutral contracts owned in `features/editor/contracts.ts`; `EditorProvider` consumes an `EditorNotebookAdapter` contract injected by `app/providers.tsx`, notebooks supplies the implementation later, and editor never imports notebooks.
- `shared/*` remains domain-neutral. `shared/ui` must not access database context, import a feature, or call Tauri.
- Large-feature characterization tests assert current raw `invoke`, `listen`, `emit`, dialog, and file-plugin semantics before gateway migration. Tests assert gateway calls only in the later gateway-migration task.
- Keep `DatabaseProvider`, `EditorProvider`, and current component controllers as the authoritative owners of the same state throughout the migration.
- Every task is independently green and reviewable. Do not begin a later task until every command in the current task exits `0`.
- Do not commit unless explicitly requested.

## Preconditions

This plan assumes these paths already exist:

```text
apps/desktop/src/
apps/desktop/tests/
apps/desktop/src-tauri/
tests/repository/
```

If `apps/desktop/src/` or `apps/desktop/tests/` does not exist, stop and complete Task 10 of `2026-07-20-desktop-workspace-migration.md`, then Task 13 of `2026-07-20-test-architecture-normalization.md`, including their full gates. Do not adapt this plan back to root `src/` or `tests/` paths. `2026-07-20-packages-tooling-cleanup.md` starts only after this frontend plan's Task 40 finalizes `apps/desktop/src/features/plugins/pluginApi.ts`; its plugin-api Task 1 consumes that path and must not run earlier.

## Locked Ownership Map

```text
apps/desktop/src/
├── app/
│   ├── App.tsx
│   ├── main.tsx
│   ├── providers.tsx
│   ├── routes.tsx
│   └── shell/
├── features/
│   ├── settings/
│   ├── plugins/
│   ├── schema/
│   ├── connections/
│   ├── editor/
│   ├── mcp/
│   ├── notebooks/
│   ├── visual-explain/
│   ├── ai/
│   ├── tasks/
│   ├── data-grid/
│   └── explorer/
├── platform/
│   └── tauri/
│       ├── contracts/
│       │   ├── connections.ts
│       │   ├── catalog.ts
│       │   ├── records.ts
│       │   ├── queries.ts
│       │   ├── events.ts
│       │   └── system.ts
│       ├── transport.ts
│       ├── events.ts
│       ├── connectionGateway.ts
│       ├── catalogGateway.ts
│       ├── recordGateway.ts
│       ├── queryGateway.ts
│       ├── windowGateway.ts
│       ├── dialogGateway.ts
│       └── index.ts
└── shared/
    ├── ui/
    ├── hooks/
    ├── lib/
    └── types/
```

There is no top-level `features/import-export`. Current ownership justifies these final locations:

| Current module | Final owner |
|---|---|
| `components/modals/ExportConnectionsModal.tsx` | `features/connections/components/ExportConnectionsModal.tsx` |
| `components/ConnectionHealthMonitor.tsx`, `ConnectionIconImage.tsx`, and `components/ssh/SshConnectionsManager.tsx` | `features/connections/components/` |
| `components/SocialLinks.tsx` | `app/components/SocialLinks.tsx` |
| `components/layout/PanelDatabaseProvider.tsx` | `app/shell/PanelDatabaseProvider.tsx` |
| `components/modals/ImportFromAppModal.tsx` and `types/connectionImport.ts` | `features/connections/components/ImportFromAppModal.tsx` and `features/connections/contracts/import.ts` |
| `components/modals/DumpDatabaseModal.tsx` | `features/explorer/components/DumpDatabaseModal.tsx` |
| `components/modals/ImportDatabaseModal.tsx` | `features/explorer/components/ImportDatabaseModal.tsx` |
| `components/modals/ClipboardImportModal.tsx` and `components/modals/ClipboardImport/SchemaEditor.tsx` | `features/schema/components/ClipboardImportModal.tsx` and `features/schema/components/ClipboardImport/SchemaEditor.tsx` |
| `components/modals/ExportProgressModal.tsx` | `features/editor/components/ExportProgressModal.tsx` |
| `utils/notebookExport.ts` and `utils/notebookHtmlExport.ts` | `features/notebooks/lib/` |
| AI activity UI, export hooks, and activity/approval contracts | `features/settings/` because the current settings page owns the activity workflow |
| query export | `features/editor/` |
| log export | `features/settings/` |

A platform gateway may still be named `dataTransferGateway.ts`; that name describes a command family, not a frontend feature.

### Cross-feature composition owners

| Composition | Final owner and one-way API |
|---|---|
| Settings route plus plugin tab/settings pages | `app/routes.tsx` composes `SettingsPage`, `PluginsTab`, and `PluginSettingsPage` from their feature roots. `SettingsPage` accepts explicit plugin render slots/sidebar descriptors and never imports plugins. Plugins may import settings and connections public APIs. |
| Global AI approval plus visual explain renderer | `app/providers.tsx` composes settings-owned `AiApprovalGate` with visual-explain-owned `ApprovalExplainPlanView` through an explicit `renderExplainPlan` prop. Settings never imports visual-explain. |
| Visual query builder inside Editor | Editor owns `VisualQueryBuilder`, `JoinEdge`, `TableNode`, `dragState`, and `visualQuery` helpers. It consumes connections/schema contracts through public roots; schema never imports editor. |
| Notebook editor and results | Editor contracts define `EditorNotebookAdapter`; `EditorProvider` receives it as a prop, and `app/providers.tsx` composes it. The initial app adapter preserves legacy notebook behavior without importing a future notebook root; notebooks later publishes `editorNotebookAdapter`, which app substitutes without changing provider behavior. Notebooks consume editor contracts/`SqlEditorWrapper` from `features/editor` and `DataGrid` from `features/data-grid`; editor never imports `features/notebooks`. Explorer consumes the explicitly published notebook metadata/persistence surface. |

### Final page and global-module owners

| Current module | Final owner |
|---|---|
| `main.tsx`, `App.tsx`, `polyfills.ts`, `index.css`, `App.css` | Tasks 3-5 move/extract `app/main.tsx`, `app/App.tsx`, `app/providers.tsx`, and `app/routes.tsx`; Task 40 moves `app/polyfills.ts`, `app/index.css`, and `app/App.css` |
| `pluginApi.ts` | `features/plugins/pluginApi.ts`; retain the package/build entry mapping and exported API names |
| `config/links.ts`, `config/socialLinks.ts`, `config/shortcuts.json`, `data/changelog.ts`, `version.ts` | `app/config/` |
| `i18n/config.ts`, `i18n/language.ts`, and `i18n/locales/` | `app/i18n/` |
| `themes/colorUtils.ts`, `themeRegistry.ts`, `themeUtils.ts`, `monaco/`, and `presets/` | `features/settings/themes/` |
| `workers/layoutWorker.ts` | `shared/workers/layoutWorker.ts` |
| `types/wkx.d.ts` | `shared/types/wkx.d.ts` |
| `components/layout/MainLayout.tsx`, `SplitPaneLayout.tsx`, `Sidebar.tsx` | `app/shell/` |
| `contexts/AlertContext.ts`, `AlertProvider.tsx` | `app/state/` |
| `contexts/ConnectionLayoutContext.ts`, `ConnectionLayoutProvider.tsx` | `app/shell/state/` |
| `contexts/KeybindingsContext.ts`, `KeybindingsProvider.tsx` | `features/settings/state/` |
| `contexts/ThemeContext.ts`, `ThemeProvider.tsx`, `UpdateContext.ts`, `UpdateProvider.tsx` | `features/settings/state/` |
| `contexts/PluginModalContext.ts`, `PluginModalProvider.tsx`, `PluginSlotContext.ts`, `PluginSlotProvider.tsx` | `features/plugins/state/` |
| `contexts/DatabaseContext.ts`, `DatabaseProvider.tsx` | `features/connections/state/` |
| `contexts/EditorContext.ts`, `EditorProvider.tsx`, `SavedQueriesContext.ts`, `SavedQueriesProvider.tsx`, `QueryHistoryContext.ts`, `QueryHistoryProvider.tsx` | `features/editor/state/` |
| `pages/Connections.tsx` | `features/connections/pages/ConnectionsPage.tsx` |
| `pages/Editor.tsx` | `features/editor/pages/EditorPage.tsx` |
| `pages/Settings.tsx` | `features/settings/pages/SettingsPage.tsx` |
| `pages/McpPage.tsx` | `features/mcp/pages/McpPage.tsx` |
| `pages/TaskManagerPage.tsx` | `features/tasks/pages/TaskManagerPage.tsx` |
| `pages/VisualExplainPage.tsx` | `features/visual-explain/pages/VisualExplainPage.tsx` |
| `pages/JsonViewerPage.tsx` | `features/data-grid/pages/JsonViewerPage.tsx` |
| `pages/ResultsWindowPage.tsx` | `features/editor/pages/ResultsWindowPage.tsx` |
| `pages/SchemaDiagramPage.tsx` | `features/schema/pages/SchemaDiagramPage.tsx` |
| `components/modals/VisualExplainModal.tsx` | `features/visual-explain/components/VisualExplainModal.tsx` |
| `components/modals/McpModal.tsx` | `features/mcp/components/McpModal.tsx` |
| `components/ui/VisualQueryBuilder.tsx`, `JoinEdge.tsx`, `TableNode.tsx`, `utils/dragState.ts`, and `utils/visualQuery.ts` | `features/editor/query-builder/` |
| `utils/sidebarTableItem.ts` | `features/explorer/lib/sidebarTableItem.ts` |
| `components/ui/JsonInput.tsx`, `JsonTreeView.tsx`, and `pages/JsonViewerPage.tsx` | `features/data-grid/` |

### AI and task ownership

`features/settings` owns `AiTab`, `AiActivityPanel`, `AiActivityEventsTab`, `AiActivitySessionsTab`, `EventDetailModal`, `QueryKindBadge`, `StatusBadge`, `hooks/useAiActivity.ts`, `utils/aiActivity.ts`, settings-only prompt/key/model contracts, and AI activity/approval contracts because the settings route owns that workflow. `features/ai` owns only `AiQueryModal`, `AiExplainModal`, and `AiDropdownButton`; it consumes settings and connections public APIs. `AiApprovalGate` and `AiApprovalModal` remain settings-owned global UI, but they accept an `ApprovalExplainPlanRenderer` callback and never import visual-explain. `app/providers.tsx` supplies visual-explain's `ApprovalExplainPlanView`, preserving one-way app composition without settings↔AI or settings↔visual-explain cycles. Notebook-specific `CellNameAiButton.tsx` and `NotebookAiButtons.tsx` remain in notebooks and consume `features/ai` and `features/visual-explain` through public roots.

`features/tasks` owns `TaskManagerPage.tsx`, `hooks/useTaskManager.ts`, and `utils/taskManager.ts`. It consumes platform task/plugin gateways and exposes only `TaskManagerPage` through its public entry point.

## Dependency Order

Implement tasks in numeric order:

1. Guards, complete ownership manifest, debt canaries, and baseline.
2-5. Legacy app characterization; pure `App.tsx`/`main.tsx` move; tested provider extraction; tested route extraction.
6. Domain contracts and contract-only public entry points, including `EditorNotebookAdapter`.
7. Settings core.
8. Connection-independent plugin core.
9. Platform Tauri contracts, transport, and non-command adapters.
10. Schema.
11. Connections.
12. Connection-dependent plugin UI and `usePluginApi` publication.
13-14. `NewConnectionModal` and `DatabaseProvider` characterization, gateway migration, and decomposition checkpoints.
15-17. Editor core characterization, path-only move, and public API with injected notebook adapter.
18-23. MCP, notebooks, `isExplainableQuery`, visual explain, AI, and tasks.
24-28. DataGrid characterization, path-only move, public API, gateway migration, and decomposition.
29-33. Explorer characterization, path-only move, public API, gateway migration, and decomposition.
34-38. Editor page characterization, path-only move, public API, gateway migration, and decomposition.
39-40. Residual owner batches/platform adapters, final ownership enforcement, and debt canaries.

Settings precedes connection-independent plugin core. Connections consumes that supported plugin root; only after connections is published may connection-dependent `PluginsTab`, `PluginSettingsPage`, and `usePluginApi` move and publish. Schema's exact legacy `useDatabase` imports remain temporary Task 11 exceptions and connections never imports schema. Connections precedes editor core because `EditorProvider` consumes `useDatabase`; editor core publishes `EditorNotebookAdapter` before notebooks, and `app/providers.tsx` supplies the later notebook implementation, eliminating an editor-to-notebooks edge. Notebooks precedes explorer because explorer consumes notebook metadata/persistence APIs. Visual explain precedes app-level approval composition, but settings never imports visual explain. Data grid, explorer, notebooks, visual explain, AI, settings, and plugins precede the editor page.

## Stable Contracts

### Connection parameter inventory and final ownership

The implementation task must inventory all frontend TypeScript `ConnectionParams` definitions and the inline saved-connection shape before changing imports. The backend's canonical Rust `crate::models::ConnectionParams` is not relocated or renamed by this frontend-only plan:

| Current definition | Current meaning | Final action |
|---|---|---|
| `apps/desktop/src/utils/connections.ts:15` | single-database display/validation input; `database: string` | replace with `SingleDatabaseConnectionParams` imported from connections contracts |
| `apps/desktop/src/utils/schemaDiagram.ts:9` | schema-diagram URL fields, not connection credentials | rename to `SchemaDiagramRouteParams` and keep in schema contracts |
| `apps/desktop/src/utils/credentials.ts:3` | credential-loaded connection DTO | replace with connections `ConnectionParams` |
| `apps/desktop/src/components/modals/NewConnectionModal.tsx:52` | full editable connection form | move to connections contracts as canonical `ConnectionParams` |
| `apps/desktop/src/contexts/DatabaseContext.ts:41` | inline persisted `SavedConnection.params` subset | replace with `ConnectionParams` without changing serialized fields |
| `apps/desktop/src-tauri/src/` references to `crate::models::ConnectionParams` | backend canonical wire/domain struct and Rust tests | inventory with content search for parity only; do not edit in this plan |

Use these domain signatures:

```typescript
export interface ConnectionParams {
  driver: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string | string[];
  ssl_mode?: string;
  ssl_ca?: string;
  ssl_cert?: string;
  ssl_key?: string;
  enable_cleartext_plugin?: boolean;
  pipes_as_concat?: boolean;
  ssh_enabled?: boolean;
  ssh_connection_id?: string;
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_file?: string;
  ssh_key_passphrase?: string;
  ssh_allow_passphrase_prompt?: boolean;
  save_in_keychain?: boolean;
  k8s_enabled?: boolean;
  k8s_connection_id?: string;
  k8s_context?: string;
  k8s_namespace?: string;
  k8s_resource_type?: string;
  k8s_resource_name?: string;
  k8s_port?: number;
  startup_script?: string;
}

export type SingleDatabaseConnectionParams = Omit<ConnectionParams, "database"> & {
  database: string;
};

export interface SchemaDiagramRouteParams {
  connectionId: string | null;
  connectionName: string;
  databaseName: string;
  schema?: string;
}
```

The similarly shaped platform `ConnectionParamsDto` is declared independently in `platform/tauri/contracts/connections.ts`. Platform code must not import the feature contract.

### Editor notebook composition contract

Task 6 defines the editor-owned neutral contract before either editor core or notebooks moves:

```typescript
export interface EditorNotebookAdapter {
  loadNotebooks(connectionId: string): Promise<readonly NotebookMetadata[]>;
  openNotebook(notebookId: string, context: DatabaseContextTuple): Promise<void>;
  migrateLegacyNotebook(input: unknown, context: DatabaseContextTuple): Promise<NotebookMetadata>;
  flush(connectionId: string): Promise<void>;
}
```

Use the existing `NotebookMetadata` and migration return shape discovered by Task 15 characterization; if the current names differ, preserve their exact fields while retaining this adapter method surface. Task 17 makes `EditorProvider` require `notebookAdapter: EditorNotebookAdapter`. `app/providers.tsx` owns composition: its tested legacy adapter forwards to the unchanged old notebook functions until Task 19 publishes `editorNotebookAdapter` from `features/notebooks`, then app swaps implementations. Editor imports only its contract and never imports notebooks.

### Database and schema payload rules

```typescript
export interface DatabaseContextTuple {
  connectionId: string;
  database?: string;
  schema?: string;
}

export interface TableContextTuple extends DatabaseContextTuple {
  table: string;
}
```

These types describe domain context, not a requirement to add every field to every existing command. Preserve these current shapes:

- DataGrid immediate `update_record`: top-level `connectionId`, `table`, `pkMap`, `colName`, `newVal`, and conditionally present `schema`; it currently has no `database` prop and must not gain one.
- Editor pending record commands: top-level `connectionId`, `table`, mutation fields, and conditionally present `database` and `schema`.
- `import_database`: top-level `connectionId`, `filePath`, and conditionally present active `schema`; `databaseName` is currently display-only and must not be added to the command.
- `dump_database`: top-level `connectionId`, `filePath`, `options`, conditionally present active `schema`, and conditionally present selected `database` only for a multi-database connection.
- `execute_clipboard_import`: one top-level `req` object with snake_case `connection_id`, `table_name`, `schema: activeSchema ?? null`, `columns`, `rows`, `create_table`, `if_exists`, and `add_columns`; it currently has no database field.
- ER-diagram window open: `connectionId`, `connectionName`, `databaseName`, and optional `schema`. The diagram page separately passes `database` and `schema` to schema loading; do not collapse either field.

Optional fields are not automatically copied. Callers retain their existing conditional spreads, explicit `null`, and snake_case nesting.

### Tauri platform boundary

```typescript
export type TauriPayload = Record<string, unknown>;

export function invokeTauri<TResult>(command: string): Promise<TResult>;
export function invokeTauri<TResult>(command: string, payload: TauriPayload): Promise<TResult>;
export type TauriUnlisten = () => void;
export function listenTauri<TPayload>(eventName: string, handler: (payload: TPayload) => void): Promise<TauriUnlisten>;
export function emitTauri<TPayload>(eventName: string, payload: TPayload): Promise<void>;
```

The one-argument overload calls `invoke(command)`. The two-argument overload calls `invoke(command, payload)`. It must not convert omission to `{}` or `undefined`.

---

### Task 1: Re-establish graph, baseline, and architecture guardrails

**Files:**
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/modals.md`
- Modify: `.rules/testing.md`
- Modify: `architecture/policy.json`
- Modify: `scripts/check-architecture.mjs`
- Test: `tests/repository/architecturePolicy.test.ts`
- Test: `apps/desktop/tests/repository/frontendBoundaries.test.ts`
- Create: `tests/repository/frontendSourceOwnership.test.ts`
- Create: `tests/repository/frontendSql.test.ts`
- Create: `tests/repository/driverSpecificFrontend.test.ts`

- [ ] **Step 1: Refresh GitNexus**

Run:

```bash
node .gitnexus/run.cjs analyze
```

Expected: repository `nexora` is indexed without a storage-version mismatch. If the runner is absent, run `npx gitnexus analyze`; stop if indexing still fails. Before every later symbol edit, run GitNexus upstream impact on that symbol; warn and stop for user direction on HIGH/CRITICAL risk.

- [ ] **Step 2: Record the baseline**

Run:

```bash
pnpm check:architecture
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits `0` before guard changes.

- [ ] **Step 3: Add failing boundary fixtures**

Assert rejection of:

```typescript
const forbiddenCases = [
  ["features/editor/pages/EditorPage.tsx", "features/data-grid/components/DataGrid"],
  ["features/editor/pages/EditorPage.tsx", "features/explorer/components/private/Tree"],
  ["shared/ui/Modal.tsx", "features/connections"],
  ["shared/ui/Modal.tsx", "@tauri-apps/api/core"],
  ["features/editor/pages/EditorPage.tsx", "@tauri-apps/api/core"],
  ["platform/tauri/queryGateway.ts", "features/editor"],
  ["platform/tauri/contracts/queries.ts", "features/editor/contracts"],
] as const;
```

Also construct `features/a -> features/b -> features/a` and `features/a -> features/b -> features/c -> features/a` fixture graphs and assert both fail. Add concrete fixtures for `settings -> plugins -> settings`, `settings -> visual-explain -> settings`, and `schema -> editor -> schema`. Positive fixtures prove feature-root imports, app composition of feature roots, `shared/ui`, and `platform/tauri` imports pass, while features importing `app/*` fail.

- [ ] **Step 4: Run the new tests and confirm failure**

```bash
pnpm test tests/repository/architecturePolicy.test.ts apps/desktop/tests/repository/frontendBoundaries.test.ts -- --run
```

Expected: FAIL because platform-to-feature, cross-feature deep-import, and cycle rules are not implemented.

- [ ] **Step 5: Implement guards and exact temporary exceptions**

Every temporary exception contains the exact importer `path`, exact `importTarget`, `owner`, `reason`, and `removeByTask`. Exceptions name one legacy importer/import pair only and use the task numbers below. The checker rejects platform-to-feature imports, shared-to-feature imports, cross-feature deep imports, unlisted direct Tauri imports outside platform, and feature cycles; listed direct imports remain reported debt until their removal task. Seed exact Task 36 exceptions for the normalized post-prerequisite paths of `ViewEditorModal.tsx`, `TriggerEditorModal.tsx`, and `NewConnectionModal.tsx` importing legacy `components/ui/SqlEditorWrapper`; path-only tasks update only the exact importer/target strings, and every intermediate `pnpm check:architecture` expects precisely these three modal exceptions until Task 36 removes them.

- [ ] **Step 6: Verify guards**

```bash
pnpm test tests/repository/architecturePolicy.test.ts apps/desktop/tests/repository/frontendBoundaries.test.ts -- --run
pnpm check:architecture
```

Expected: PASS; exact legacy exceptions are reported, not ignored.

- [ ] **Step 7: Create the complete source-owner manifest and debt canaries**

Generate `tests/repository/frontendSourceOwnership.test.ts` from every source that exists after the desktop-workspace and test-normalization prerequisite plans: every production `.ts`/`.tsx`, style (`.css`, `.scss`, `.sass`, `.less`), worker, locale (`.json`, `.ts`, `.tsx`), and declaration (`.d.ts`) file under `apps/desktop/src/`. Do not seed it from this plan's abbreviated lists. Each source row contains an exact `source`, final `owner`, exact `destination`, and exactly one `moveTask`; files already at their destination use that same path and the task that first validates ownership. Generated files require exact rows containing `path`, `generator`, `owner`, and `reason`; wildcards are forbidden. Fail on an unassigned source, stale row, duplicate source/destination, destination collision, source named by two tasks, missing declared destination after its task, or ordinary files remaining under legacy top-level `components/`, `contexts/`, `hooks/`, `pages/`, `types/`, or `utils/` after Task 40.

The generated manifest is authoritative over every later `**Files:**` summary. It must explicitly assign all current residuals, including `ConnectionHealthMonitor` and `ConnectionIconImage` to connections; `SocialLinks` to app; `PanelDatabaseProvider` to app shell; `SshConnectionsManager` to connections; and every remaining `components/ui`, modal, hook, type, and utility file to a concrete feature, app, platform, or shared destination/task. In particular, enumerate clipboard/schema leaves, SSH/K8s/askpass leaves, settings/info/update/changelog/community leaves, grid cell/editor/toolbar leaves, query/editor leaves, driver/capability helpers, routine/schema helpers, autocomplete/SQL helpers, JSON/geometry/blob helpers, and every declaration/worker/locale/style. No “remaining files,” directory wildcard, or inferred-owner row is valid. Reconcile every Task 2-40 file list and optional staging list against the generated rows before continuing.

Create `tests/repository/frontendSql.test.ts` and `tests/repository/driverSpecificFrontend.test.ts` now, before any source move. Record exact path-independent debt entries as `{ symbol, owner, normalizedText }`; resolve moved files through the owner manifest. Freeze the current sorted entries and counts in committed fixtures inside those test files. These canaries may neither add nor remediate debt and Task 40 only reruns them unchanged.

```bash
pnpm test tests/repository/frontendSourceOwnership.test.ts tests/repository/frontendSql.test.ts tests/repository/driverSpecificFrontend.test.ts -- --run
```

Expected: PASS with one exact owner/destination/task row per post-prerequisite production source and an exact pre-migration SQL/driver-specific baseline.

### Task 2: Characterize the legacy app composition root on old paths

**Files:**
- Create: `apps/desktop/tests/app/App.test.tsx`
- Create: `apps/desktop/tests/app/main.test.tsx`
- Read only: `apps/desktop/src/App.tsx`
- Read only: `apps/desktop/src/main.tsx`

- [ ] **Step 1: Pin current app, provider, and route behavior**

Import `apps/desktop/src/App.tsx` and `apps/desktop/src/main.tsx` from their old paths. Characterize the exact provider nesting order and every current route path, redirect/fallback, global modal/gate, startup call, window branch, and visible shell/page selection. Mock raw Tauri calls at their current boundaries. Record provider order as an explicit ordered fixture and route paths as an explicit sorted fixture; do not create `apps/desktop/src/app/providers.tsx` or `apps/desktop/src/app/routes.tsx` yet.

```bash
pnpm test apps/desktop/tests/app/App.test.tsx apps/desktop/tests/app/main.test.tsx -- --run
```

Expected: PASS against the old source paths. A command may reference `apps/desktop/tests/app` now because this task creates those tests before running it; no earlier command references that directory.

### Task 3: Path-move `App.tsx` and `main.tsx` and repair only the entry path

**Files:**
- Move: `apps/desktop/src/App.tsx` -> `apps/desktop/src/app/App.tsx`
- Move: `apps/desktop/src/main.tsx` -> `apps/desktop/src/app/main.tsx`
- Modify: `apps/desktop/index.html`
- Modify: import specifiers required by these moves
- Modify: `apps/desktop/tests/app/App.test.tsx`
- Modify: `apps/desktop/tests/app/main.test.tsx`

- [ ] **Step 1: Impact-check both entry symbols, then use `git mv`**

Change only paths/import specifiers and the Vite HTML module entry from `/src/main.tsx` to `/src/app/main.tsx`. Do not extract providers/routes, reorder JSX, rename symbols, add exports, change raw Tauri calls, or alter assertions beyond the two test import paths.

```bash
pnpm test apps/desktop/tests/app/App.test.tsx apps/desktop/tests/app/main.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm build
```

Expected: PASS with the Task 2 provider-order and route-path fixtures unchanged; `git diff --find-renames -- apps/desktop/src/App.tsx apps/desktop/src/main.tsx apps/desktop/src/app/App.tsx apps/desktop/src/app/main.tsx` shows only renames/import-path repair.

### Task 4: Extract and characterize `app/providers.tsx`

**Files:**
- Create: `apps/desktop/src/app/providers.tsx`
- Create: `apps/desktop/tests/app/providers.test.tsx`
- Modify: `apps/desktop/src/app/App.tsx`
- Modify: `apps/desktop/tests/app/App.test.tsx`

- [ ] **Step 1: Add the provider composition test before extraction**

Test the explicit provider-order fixture, children placement, global gates/modals, and prop forwarding through the old inline App composition. Include the legacy notebook operations used by `EditorProvider`; this is the characterization that Task 17 must preserve through `EditorNotebookAdapter`.

```bash
pnpm test apps/desktop/tests/app/App.test.tsx apps/desktop/tests/app/providers.test.tsx -- --run
```

Expected: the new provider test FAILS because `app/providers.tsx` does not exist while the legacy App characterization remains PASS.

- [ ] **Step 2: Extract only provider composition**

Move unchanged provider JSX and global provider-owned gates into a named `AppProviders` component. Preserve exact nesting, children position, hook call sites, raw calls, and render order. `App.tsx` uses `AppProviders`; route JSX remains inline.

```bash
pnpm test apps/desktop/tests/app/App.test.tsx apps/desktop/tests/app/providers.test.tsx -- --run
pnpm typecheck
pnpm lint
```

Expected: PASS with the exact Task 2 provider order.

### Task 5: Extract and characterize `app/routes.tsx`

**Files:**
- Create: `apps/desktop/src/app/routes.tsx`
- Create: `apps/desktop/tests/app/routes.test.tsx`
- Modify: `apps/desktop/src/app/App.tsx`
- Modify: `apps/desktop/tests/app/App.test.tsx`

- [ ] **Step 1: Add the route composition test before extraction**

Test the explicit Task 2 route-path fixture, redirects/fallbacks, route element wiring, window-specific routing, and visible page selection against inline App routes.

```bash
pnpm test apps/desktop/tests/app/App.test.tsx apps/desktop/tests/app/routes.test.tsx -- --run
```

Expected: the new route test FAILS because `app/routes.tsx` does not exist while legacy route characterization remains PASS.

- [ ] **Step 2: Extract only route composition**

Move unchanged route JSX into `AppRoutes`. Preserve every path, redirect, fallback, element prop, and ordering. Do not move feature files or publish feature APIs.

```bash
pnpm test apps/desktop/tests/app/App.test.tsx apps/desktop/tests/app/routes.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with the exact Task 2 route fixture and Task 4 provider fixture unchanged.

### Task 6: Extract contracts and create contract-only public entry points

**Files:**
- Create: `apps/desktop/src/features/settings/contracts.ts`
- Create: `apps/desktop/src/features/settings/index.ts`
- Create: `apps/desktop/src/features/plugins/contracts.ts`
- Create: `apps/desktop/src/features/plugins/index.ts`
- Create: `apps/desktop/src/features/schema/contracts.ts`
- Create: `apps/desktop/src/features/schema/index.ts`
- Create: `apps/desktop/src/features/connections/contracts.ts`
- Create: `apps/desktop/src/features/connections/contracts/import.ts`
- Create: `apps/desktop/src/features/connections/index.ts`
- Create: `apps/desktop/src/features/editor/contracts.ts` with `EditorNotebookAdapter`
- Create: `apps/desktop/src/features/editor/index.ts`
- Create: `apps/desktop/src/features/notebooks/contracts.ts`
- Create: `apps/desktop/src/features/notebooks/index.ts`
- Create: `apps/desktop/src/features/visual-explain/contracts.ts`
- Create: `apps/desktop/src/features/visual-explain/index.ts`
- Create: `apps/desktop/src/features/ai/contracts.ts`
- Create: `apps/desktop/src/features/ai/index.ts`
- Create: `apps/desktop/src/features/tasks/contracts.ts`
- Create: `apps/desktop/src/features/tasks/index.ts`
- Create: `apps/desktop/src/features/data-grid/contracts.ts`
- Create: `apps/desktop/src/features/data-grid/index.ts`
- Create: `apps/desktop/src/features/explorer/contracts.ts`
- Create: `apps/desktop/src/features/explorer/index.ts`
- Create: `apps/desktop/src/features/mcp/index.ts`
- Modify: `apps/desktop/src/contexts/DatabaseContext.ts`
- Modify: `apps/desktop/src/contexts/EditorContext.ts`
- Modify: `apps/desktop/src/contexts/SettingsContext.ts`
- Modify: `apps/desktop/src/types/editor.ts`
- Modify: `apps/desktop/src/types/plugins.ts`
- Modify: `apps/desktop/src/types/pluginSlots.ts`
- Modify: `apps/desktop/src/types/sidebar.ts`
- Modify: `apps/desktop/src/types/ai.ts`
- Modify: `apps/desktop/src/types/connectionImport.ts`
- Modify: `apps/desktop/src/utils/connections.ts`
- Modify: `apps/desktop/src/utils/credentials.ts`
- Modify: `apps/desktop/src/utils/schemaDiagram.ts`
- Modify: `apps/desktop/src/utils/taskManager.ts`
- Test: `apps/desktop/tests/repository/domainContractOwnership.test.ts`

- [ ] **Step 1: Run GitNexus impact for each current type owner**

Analyze `DatabaseContextType`, `ConnectionParams`, `EditorContextType`, `Tab`, `Settings`, `PluginManifest`, `PendingApproval`, `ProcessInfo`, and `ContextMenuData`. Stop and review any HIGH/CRITICAL result before editing.

- [ ] **Step 2: Add the ownership test**

The test scans `.ts` and `.tsx` imports and expects no type import from a file containing `createContext(` or from `components/`. Its failure output includes every current `ConnectionParams` row listed in this plan.

```bash
pnpm test apps/desktop/tests/repository/domainContractOwnership.test.ts -- --run
```

Expected: FAIL with provider/component-owned contracts and duplicate `ConnectionParams` definitions.

- [ ] **Step 3: Extract contracts and create explicit contract-only barrels**

Each `index.ts` exports named types only. Runtime components, providers, and hooks are not exported yet. Use the exact connection signatures and ownership table above. `SchemaDiagramRouteParams` replaces only the schema-diagram URL type; do not rename canonical connection credentials. Move editor-owned `QueryResult`, `Tab`, related editor primitives, and the exact `EditorNotebookAdapter` signature above into `features/editor/contracts.ts`; notebook-owned cell/file/metadata contracts into `features/notebooks/contracts.ts`; and explain-plan contracts into `features/visual-explain/contracts.ts`. Resolve the existing editor/notebook type cycle by making notebook contracts import `QueryResult` and `EditorNotebookAdapter` through `features/editor` while editor contracts contain no notebook import: replace `Tab.notebookState` with a structurally identical migration-only neutral `LegacyNotebookState` declared in editor contracts. This is a type ownership extraction only and must not change serialized fields or runtime values.

- [ ] **Step 4: Update implementations, callers, and tests in that order**

Temporary legacy files may explicitly re-export named types. Remove a re-export in the task that migrates its final consumer. No `export *` is allowed.

- [ ] **Step 5: Verify contract ownership and contract-only entry points**

```bash
pnpm test apps/desktop/tests/repository/domainContractOwnership.test.ts apps/desktop/tests/contexts/DatabaseProvider.test.tsx apps/desktop/tests/contexts/EditorProvider.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; exactly one canonical connection-domain `ConnectionParams`, one `ConnectionParamsDto` is planned for platform, and no utility imports a provider/component-owned type.

### Task 7: Establish settings core before consumers

**Files:**
- Move: `apps/desktop/src/contexts/SettingsContext.ts` -> `apps/desktop/src/features/settings/state/SettingsContext.ts`
- Move: `apps/desktop/src/contexts/SettingsProvider.tsx` -> `apps/desktop/src/features/settings/state/SettingsProvider.tsx`
- Move: `apps/desktop/src/contexts/ThemeContext.ts` -> `apps/desktop/src/features/settings/state/ThemeContext.ts`
- Move: `apps/desktop/src/contexts/ThemeProvider.tsx` -> `apps/desktop/src/features/settings/state/ThemeProvider.tsx`
- Move: `apps/desktop/src/contexts/UpdateContext.ts` -> `apps/desktop/src/features/settings/state/UpdateContext.ts`
- Move: `apps/desktop/src/contexts/UpdateProvider.tsx` -> `apps/desktop/src/features/settings/state/UpdateProvider.tsx`
- Move: `apps/desktop/src/hooks/useSettings.ts` -> `apps/desktop/src/features/settings/hooks/useSettings.ts`
- Move: `apps/desktop/src/hooks/useTheme.ts` -> `apps/desktop/src/features/settings/hooks/useTheme.ts`
- Move: `apps/desktop/src/hooks/useUpdate.ts` -> `apps/desktop/src/features/settings/hooks/useUpdate.ts`
- Move: `apps/desktop/src/hooks/useEditorTheme.ts` -> `apps/desktop/src/features/settings/hooks/useEditorTheme.ts`
- Move: `apps/desktop/src/pages/Settings.tsx` -> `apps/desktop/src/features/settings/pages/SettingsPage.tsx`
- Move: `apps/desktop/src/components/settings/AiTab.tsx`, `AiActivityPanel.tsx`, `AppearanceTab.tsx`, `FontPicker.tsx`, `GeneralTab.tsx`, `InfoTab.tsx`, `LocalizationTab.tsx`, `LogsTab.tsx`, `ResultColorsSection.tsx`, `SettingControls.tsx`, `ShortcutsTab.tsx`, `SshTab.tsx`, and `ThemePicker.tsx` -> `apps/desktop/src/features/settings/components/`
- Move: `apps/desktop/src/components/settings/ai-activity/AiActivityEventsTab.tsx`, `AiActivitySessionsTab.tsx`, `EventDetailModal.tsx`, `QueryKindBadge.tsx`, and `StatusBadge.tsx` -> `apps/desktop/src/features/settings/components/ai-activity/`
- Move: `apps/desktop/src/hooks/useAiActivity.ts` -> `apps/desktop/src/features/settings/hooks/useAiActivity.ts`
- Move: `apps/desktop/src/utils/aiActivity.ts` -> `apps/desktop/src/features/settings/lib/aiActivity.ts`
- Move: `apps/desktop/src/components/modals/AiApprovalGate.tsx` -> `apps/desktop/src/features/settings/components/AiApprovalGate.tsx`
- Move: `apps/desktop/src/components/modals/AiApprovalModal.tsx` -> `apps/desktop/src/features/settings/components/AiApprovalModal.tsx`
- Modify: `apps/desktop/src/features/settings/components/AiApprovalGate.tsx`
- Modify: `apps/desktop/src/features/settings/components/AiApprovalModal.tsx`
- Move: `apps/desktop/src/types/ai.ts` -> `apps/desktop/src/features/settings/contracts/aiActivity.ts`
- Move: `apps/desktop/src/utils/settingsUI.ts` -> `apps/desktop/src/features/settings/lib/settingsUI.ts`
- Move: `apps/desktop/src/utils/themeManagement.ts` -> `apps/desktop/src/features/settings/lib/themeManagement.ts`
- Move: `apps/desktop/tests/pages/Settings.test.tsx` -> `apps/desktop/tests/features/settings/pages/SettingsPage.test.tsx`
- Move: `apps/desktop/tests/contexts/SettingsProvider.test.tsx`, `ThemeProvider.test.tsx`, and `UpdateProvider.test.tsx` -> `apps/desktop/tests/features/settings/state/`
- Move: `apps/desktop/tests/hooks/useSettings.test.ts`, `useTheme.test.ts`, `useUpdate.test.ts`, and `useEditorTheme.test.ts` -> `apps/desktop/tests/features/settings/hooks/`
- Move: `apps/desktop/tests/components/settings/LocalizationTab.test.tsx` and `SettingControls.test.tsx` -> `apps/desktop/tests/features/settings/components/`
- Move: `apps/desktop/tests/components/modals/AiApprovalGate.test.tsx` -> `apps/desktop/tests/features/settings/components/AiApprovalGate.test.tsx`
- Move: `apps/desktop/tests/utils/aiActivity.test.ts` -> `apps/desktop/tests/features/settings/lib/aiActivity.test.ts`
- Modify: `apps/desktop/src/features/settings/index.ts`
- Modify: `apps/desktop/src/app/providers.tsx`
- Modify: `apps/desktop/src/app/routes.tsx`
- Create compatibility adapter: `apps/desktop/src/app/legacy/pluginSettingsComposition.tsx`; delete in Task 12 after zero consumers

- [ ] **Step 1: Characterize settings behavior and every raw platform import before movement**

```bash
pnpm test apps/desktop/tests/pages/Settings.test.tsx apps/desktop/tests/contexts/SettingsProvider.test.tsx apps/desktop/tests/contexts/ThemeProvider.test.tsx apps/desktop/tests/contexts/UpdateProvider.test.tsx apps/desktop/tests/components/modals/AiApprovalGate.test.tsx apps/desktop/tests/utils/aiActivity.test.ts -- --run
```

Expected: PASS with provider/theme/update/settings workflows and exact raw calls green on old paths. Add focused tests for any Task 1 settings importer not reached by the listed suites before proceeding.

- [ ] **Step 2: Perform path-only moves, then publish runtime API**

The raw characterization covers `SettingsProvider.tsx`, `ThemeProvider.tsx`, `UpdateProvider.tsx`, `KeybindingsProvider.tsx`, `useAiActivity.ts`, settings update/info/open-source UI, and every exact Task 1 settings row; these raw tests remain exact Task 39 exceptions. Use `git mv` and update import specifiers only; run the command below. The path-only batch retains only Task 1's per-importer exceptions for the moved `SettingsPage` imports of the exact legacy `PluginsTab` and `PluginSettingsPage` targets (`owner: "settings"`, `removeByTask: 12`) and for each moved settings approval/activity import of an exact legacy visual-explain target (`owner: "settings"`, `removeByTask: 21`). In a second review batch, add named exports for `SettingsPage`, `SettingsProvider`, `ThemeProvider`, `UpdateProvider`, `useSettings`, `useTheme`, `useUpdate`, `useEditorTheme`, `AiActivityPanel`, the supported `SettingControls`, `AiApprovalGate`, `ApprovalExplainPlanRenderer`, and `McpApprovalMode`. Do not export settings implementation modules.

```bash
pnpm test apps/desktop/tests/features/settings -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS after the path batch and again after publication; exact Task 12/21 cross-feature exceptions and the characterized Task 39 raw-platform rows remain.

- [ ] **Step 3: Remove settings-to-plugin ownership before moving plugins**

Characterize plugin tab selection, plugin sidebar installation/removal updates, and plugin settings navigation in `SettingsPage.test.tsx`. Add explicit `pluginTabs`, `renderPluginTab`, and `renderPluginSettings` composition props to `SettingsPage`; `app/routes.tsx` supplies them from `features/plugins` only after Task 12 publishes those APIs. Until then `app/routes.tsx` supplies the existing implementations through `apps/desktop/src/app/legacy/pluginSettingsComposition.tsx`; Task 1 permits only that adapter's two exact imports of the legacy plugin components with `owner: "app"`, their exact `importTarget` values, reasons, and `removeByTask: 12`. Settings must not import a plugin file or plugin public root after this step.

```bash
pnpm test apps/desktop/tests/features/settings/pages/SettingsPage.test.tsx apps/desktop/tests/features/settings -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no `settings -> plugins` edge remains, the app adapter's exact Task 12 exception and characterized Task 39 raw-platform rows are reported.

### Task 8: Establish connection-independent plugin core before connections

**Files:**
- Move: `apps/desktop/src/contexts/PluginModalContext.ts` -> `apps/desktop/src/features/plugins/state/PluginModalContext.ts`
- Move: `apps/desktop/src/contexts/PluginModalProvider.tsx` -> `apps/desktop/src/features/plugins/state/PluginModalProvider.tsx`
- Move: `apps/desktop/src/contexts/PluginSlotContext.ts` -> `apps/desktop/src/features/plugins/state/PluginSlotContext.ts`
- Move: `apps/desktop/src/contexts/PluginSlotProvider.tsx` -> `apps/desktop/src/features/plugins/state/PluginSlotProvider.tsx`
- Move: `apps/desktop/src/hooks/useDrivers.ts` -> `apps/desktop/src/features/plugins/hooks/useDrivers.ts`
- Move: `apps/desktop/src/hooks/usePluginRegistry.ts` -> `apps/desktop/src/features/plugins/hooks/usePluginRegistry.ts`
- Move: `apps/desktop/src/hooks/usePluginSlotRegistry.ts` -> `apps/desktop/src/features/plugins/hooks/usePluginSlotRegistry.ts`
- Move: `apps/desktop/src/utils/plugins.ts` -> `apps/desktop/src/features/plugins/lib/plugins.ts`
- Move: `apps/desktop/src/utils/pluginConfig.ts` -> `apps/desktop/src/features/plugins/lib/pluginConfig.ts`
- Move: `apps/desktop/src/utils/pluginModuleLoader.ts` -> `apps/desktop/src/features/plugins/lib/pluginModuleLoader.ts`
- Move: `apps/desktop/src/components/modals/PluginInstallErrorModal.tsx`, `PluginRemoveModal.tsx`, `PluginSettingsModal.tsx`, and `PluginStartErrorModal.tsx` -> `apps/desktop/src/features/plugins/components/modals/`
- Move: `apps/desktop/tests/contexts/PluginSlotProvider.test.tsx` -> `apps/desktop/tests/features/plugins/state/PluginSlotProvider.test.tsx`
- Move: `apps/desktop/tests/utils/pluginConfig.test.ts`, `plugins.test.ts`, and `pluginModuleLoader.test.ts` -> `apps/desktop/tests/features/plugins/lib/`
- Create: `apps/desktop/tests/features/plugins/hooks/useDrivers.test.ts`
- Create: `apps/desktop/tests/features/plugins/hooks/usePluginRegistry.test.ts`
- Modify: `apps/desktop/src/features/plugins/index.ts`
- Modify: `apps/desktop/src/app/providers.tsx`

- [ ] **Step 1: Characterize capability defaults and registration order**

```bash
pnpm test apps/desktop/tests/contexts/PluginSlotProvider.test.tsx apps/desktop/tests/utils/pluginConfig.test.ts apps/desktop/tests/utils/plugins.test.ts apps/desktop/tests/utils/pluginModuleLoader.test.ts apps/desktop/tests/features/plugins/hooks/useDrivers.test.ts apps/desktop/tests/features/plugins/hooks/usePluginRegistry.test.ts -- --run
```

Expected: PASS against legacy paths. The two new hook tests import the legacy hook paths and assert safe external-driver capability defaults plus plugin registration order; require both to pass before movement. Add raw invoke tests for `useDrivers.ts`, `usePluginRegistry.ts`, and `PluginSlotProvider.tsx` now and retain their exact Task 39 rows after movement.

- [ ] **Step 2: Path-move, verify, then publish only connection-independent core**

After a pure `git mv` batch passes, publish named exports for `PluginModalProvider`, `PluginSlotProvider`, `useDrivers`, `usePluginRegistry`, `usePluginSlotRegistry`, and driver-capability/plugin-registry contracts. Do not move or export `usePluginApi`, `PluginsTab`, or `PluginSettingsPage`; their current code consumes connection APIs and remains behind the exact app composition exceptions until Task 12. Connection-independent plugin core may import settings/platform but must not import connections.

```bash
pnpm test apps/desktop/tests/features/plugins -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS after each batch; capability defaults and slot order are unchanged, the published plugin root has no connections dependency, and only exact Task 12 composition/Task 39 raw-platform rows remain.

### Task 9: Add platform-owned Tauri contracts, transport, initial gateways, and non-command adapters

**Files:**
- Create: `apps/desktop/src/platform/tauri/contracts/connections.ts`
- Create: `apps/desktop/src/platform/tauri/contracts/catalog.ts`
- Create: `apps/desktop/src/platform/tauri/contracts/records.ts`
- Create: `apps/desktop/src/platform/tauri/contracts/queries.ts`
- Create: `apps/desktop/src/platform/tauri/contracts/events.ts`
- Create: `apps/desktop/src/platform/tauri/contracts/system.ts`
- Create: `apps/desktop/src/platform/tauri/transport.ts`
- Create: `apps/desktop/src/platform/tauri/events.ts`
- Create: `apps/desktop/src/platform/tauri/connectionGateway.ts`
- Create: `apps/desktop/src/platform/tauri/catalogGateway.ts`
- Create: `apps/desktop/src/platform/tauri/recordGateway.ts`
- Create: `apps/desktop/src/platform/tauri/queryGateway.ts`
- Create: `apps/desktop/src/platform/tauri/windowGateway.ts`
- Create: `apps/desktop/src/platform/tauri/dialogGateway.ts`
- Create: `apps/desktop/src/platform/tauri/openerAdapter.ts`
- Create: `apps/desktop/src/platform/tauri/notificationAdapter.ts`
- Create: `apps/desktop/src/platform/tauri/clipboardAdapter.ts`
- Create: `apps/desktop/src/platform/tauri/updaterAdapter.ts`
- Create: `apps/desktop/src/platform/tauri/pathAdapter.ts`
- Create: `apps/desktop/src/platform/tauri/assetAdapter.ts`
- Create: `apps/desktop/src/platform/tauri/index.ts`
- Test: `apps/desktop/tests/platform/tauri/transport.test.ts`
- Test: `apps/desktop/tests/platform/tauri/gatewayContracts.test.ts`
- Create: `apps/desktop/tests/platform/tauri/platformAdapters.test.ts`

- [ ] **Step 1: Add failing transport tests**

```typescript
await invokeTauri<string>("without_payload");
expect(invoke).toHaveBeenCalledWith("without_payload");
await invokeTauri<string>("explicit_undefined", { schema: undefined });
expect(invoke).toHaveBeenCalledWith("explicit_undefined", { schema: undefined });
await invokeTauri<string>("explicit_null", { connectionId: null });
expect(invoke).toHaveBeenCalledWith("explicit_null", { connectionId: null });
```

Reject with a sentinel object and assert rejection identity. Assert `listenTauri` unwraps only `event.payload`, `emitTauri` forwards exact payloads, and cleanup is the returned unlisten function.

```bash
pnpm test apps/desktop/tests/platform/tauri/transport.test.ts -- --run
```

Expected: FAIL because transport files do not exist.

- [ ] **Step 2: Add exact failing non-command adapter forwarding tests**

Mock each package and assert one-for-one forwarding: opener `openUrl(url)`; notification permission/status/send APIs with unchanged options and rejections; clipboard-manager `readText()`/`writeText(value)`; updater `check(options?)`, downloaded update methods, and exact callbacks/options; path `appDataDir()`/`join(...parts)` with argument order and rejection identity; and asset `convertFileSrc(path, protocol?)` preserving the omitted second argument versus an explicit protocol. Do not normalize URLs, options, paths, or errors.

```bash
pnpm test apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run
```

Expected: FAIL because the six adapters do not exist.

- [ ] **Step 3: Freeze existing raw command-family contracts**

Before implementing a gateway, inventory each legacy caller for connection, catalog, record, query, window, and dialog commands. In `gatewayContracts.test.ts`, copy the exact command string, outer wrapper, snake/camel case, conditional spread, explicit `null`, explicit `undefined`, omitted payload, return shape, and rejection identity. Include connection create/update/test/list wrappers and prove create omits outer `connection_id`; do not infer a uniform wrapper from similarly named commands.

- [ ] **Step 4: Define independent wire DTOs, gateways, and exact adapters**

Declare the complete snake_case `ConnectionParamsDto`, saved-connection response DTOs, and separate request DTOs such as `{ params, connection_id? }` independently in `platform/tauri/contracts/connections.ts`. `ConnectionParamsDto` includes every currently serialized backend field but does not derive from or import feature `ConnectionParams`. Connection records, catalog records, query results, mutation payloads, and event payloads are declared in the six named files. Gateway methods accept complete existing payload objects and perform one transport call with the existing command string; optional fields are never auto-copied.

- [ ] **Step 5: Verify command names, payloads, return values, and rejections**

```bash
pnpm test apps/desktop/tests/platform/tauri/transport.test.ts apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; content search finds no file under `platform/tauri/` whose resolved import starts under `features/`.

### Task 10: Establish schema ownership

**Files:**
- Move: `apps/desktop/src/components/modals/SchemaModal.tsx`, `CreateTableModal.tsx`, `ModifyColumnModal.tsx`, `CreateIndexModal.tsx`, `CreateForeignKeyModal.tsx`, `ViewEditorModal.tsx`, `TriggerEditorModal.tsx`, and `RunRoutineModal.tsx` -> `apps/desktop/src/features/schema/components/modals/`
- Move: `apps/desktop/src/components/ui/SchemaDiagram.tsx` and `SchemaTableNode.tsx` -> `apps/desktop/src/features/schema/components/`
- Move: `apps/desktop/src/pages/SchemaDiagramPage.tsx` -> `apps/desktop/src/features/schema/pages/SchemaDiagramPage.tsx`
- Move: `apps/desktop/src/components/modals/ClipboardImportModal.tsx` -> `apps/desktop/src/features/schema/components/ClipboardImportModal.tsx`
- Move: `apps/desktop/src/components/modals/ClipboardImport/SchemaEditor.tsx` -> `apps/desktop/src/features/schema/components/ClipboardImport/SchemaEditor.tsx`
- Move: `apps/desktop/src/hooks/useSchemaMetadata.ts` -> `apps/desktop/src/features/schema/hooks/useSchemaMetadata.ts`
- Create: `apps/desktop/tests/features/schema/hooks/useSchemaMetadata.test.ts`
- Move: `apps/desktop/src/utils/schemaDiagram.ts`, `schema.ts`, `createTable.ts`, `indexes.ts`, and `foreignKeys.ts` -> `apps/desktop/src/features/schema/lib/`
- Move: `apps/desktop/src/utils/database.ts` -> `apps/desktop/src/features/plugins/lib/databaseCapabilities.ts`
- Move: `apps/desktop/tests/utils/schema.test.ts` and `schemaDiagram.test.ts` -> `apps/desktop/tests/features/schema/lib/`
- Modify: `apps/desktop/src/features/schema/index.ts`
- Modify: schema consumers

- [ ] **Step 1: Impact-check exported schema symbols and run legacy tests**

```bash
pnpm test apps/desktop/tests/components/ui/TableNode.test.tsx apps/desktop/tests/utils/schema.test.ts apps/desktop/tests/utils/schemaDiagram.test.ts apps/desktop/tests/features/schema/hooks/useSchemaMetadata.test.ts -- --run
```

Expected: PASS. The new hook suite imports the legacy `apps/desktop/src/hooks/useSchemaMetadata.ts` path and covers loading/already-loaded metadata plus exact `connectionId`/`database`/`schema`/`table` invocation context; require PASS before movement. Add passing raw invoke/dialog/clipboard tests for every schema importer identified by Task 1, including `ViewEditorModal.tsx`, `TriggerEditorModal.tsx`, `ClipboardImportModal.tsx`, `useDataTypes.ts`, and every other exact scan row; retain them as Task 39 exceptions after movement. `TableNode.tsx` and its test remain at their legacy paths because editor owns both in Task 35.

- [ ] **Step 2: Perform the path-only move**

Use `git mv`, move tests, and change import specifiers only. Do not migrate Tauri calls or alter assertions. Task 1 records each schema component's exact legacy connections import with `owner: "schema"` and `removeByTask: 11`; no broad schema exception is allowed.

- [ ] **Step 3: Publish supported schema API in a separate batch**

Export named contracts, `SchemaDiagramPage`, `SchemaModal`, `CreateTableModal`, `ModifyColumnModal`, `CreateIndexModal`, `CreateForeignKeyModal`, `ViewEditorModal`, `TriggerEditorModal`, `RunRoutineModal`, `ClipboardImportModal`, and `useSchemaMetadata`. Publish `isMultiDatabaseCapable`, `getDatabaseList`, and `getEffectiveDatabase` from `features/plugins` as driver-capability helpers; schema does not own them. Query-builder code remains legacy until its editor-owned Task 35 move.

```bash
pnpm test apps/desktop/tests/features/schema -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS after path movement with the exact Task 11 schema-to-legacy-connections and Task 36 modal-to-`SqlEditorWrapper` exceptions, plus exact Task 39 raw-platform rows; publication removes none of those early. Task 11 removes only the connections pairs, Task 36 removes the three editor pairs, and Task 39 removes raw-platform rows.

### Task 11: Establish connections after settings and connection-independent plugin core

**Files:**
- Move: `apps/desktop/src/contexts/DatabaseContext.ts` -> `apps/desktop/src/features/connections/state/DatabaseContext.ts`
- Move: `apps/desktop/src/contexts/DatabaseProvider.tsx` -> `apps/desktop/src/features/connections/state/DatabaseProvider.tsx`
- Move: `apps/desktop/src/pages/Connections.tsx` -> `apps/desktop/src/features/connections/pages/ConnectionsPage.tsx`
- Move: `apps/desktop/src/hooks/useDatabase.ts` -> `apps/desktop/src/features/connections/hooks/useDatabase.ts`
- Move: `apps/desktop/src/hooks/useConnectionManager.ts` -> `apps/desktop/src/features/connections/hooks/useConnectionManager.ts`
- Move: `apps/desktop/src/hooks/useOpenConnectionInNewWindow.ts` -> `apps/desktop/src/features/connections/hooks/useOpenConnectionInNewWindow.ts`
- Move: `apps/desktop/src/components/modals/NewConnectionModal.tsx` -> `apps/desktop/src/features/connections/components/NewConnectionModal/NewConnectionModal.tsx`
- Move: `apps/desktop/src/components/modals/NewConnectionModal/AppearanceSection.tsx` -> `apps/desktop/src/features/connections/components/NewConnectionModal/AppearanceSection.tsx`
- Move: `apps/desktop/tests/components/modals/NewConnectionModal/AppearanceSection.test.tsx` -> `apps/desktop/tests/features/connections/components/NewConnectionModal/AppearanceSection.test.tsx`
- Move: `apps/desktop/src/components/modals/ExportConnectionsModal.tsx` -> `apps/desktop/src/features/connections/components/ExportConnectionsModal.tsx`
- Move: `apps/desktop/src/components/modals/ImportFromAppModal.tsx` -> `apps/desktop/src/features/connections/components/ImportFromAppModal.tsx`
- Move: `apps/desktop/src/components/connections/ActionButtons.tsx`, `ConnectionListItem.tsx`, `StatusBadge.tsx`, `ConnectionCard.tsx`, and `GroupHeader.tsx` -> `apps/desktop/src/features/connections/components/list/`
- Move: `apps/desktop/src/components/ConnectionErrorBanner.tsx` -> `apps/desktop/src/features/connections/components/ConnectionErrorBanner.tsx`
- Move: `apps/desktop/src/components/ConnectionHealthMonitor.tsx` -> `apps/desktop/src/features/connections/components/ConnectionHealthMonitor.tsx`
- Move: `apps/desktop/src/components/ConnectionIconImage.tsx` -> `apps/desktop/src/features/connections/components/ConnectionIconImage.tsx`
- Move: `apps/desktop/src/components/ssh/SshConnectionsManager.tsx` -> `apps/desktop/src/features/connections/components/SshConnectionsManager.tsx`
- Move: `apps/desktop/tests/components/ConnectionIconImage.test.tsx` -> `apps/desktop/tests/features/connections/components/ConnectionIconImage.test.tsx`
- Move: `apps/desktop/tests/components/ssh/SshConnectionsManager.test.tsx` -> `apps/desktop/tests/features/connections/components/SshConnectionsManager.test.tsx`
- Move: `apps/desktop/src/components/layout/sidebar/ConnectionGroupFolder.tsx`, `ConnectionGroupItem.tsx`, and `OpenConnectionItem.tsx` -> `apps/desktop/src/features/connections/components/sidebar/`
- Move: `apps/desktop/src/utils/connections.ts`, `connectionStringParser.ts`, `credentials.ts`, `connectionManager.ts`, `connectionLayout.ts`, `groupTree.ts`, `ssh.ts`, `k8s.ts`, and `driverUI.tsx` -> `apps/desktop/src/features/connections/lib/`
- Move: `apps/desktop/tests/utils/driverUI.test.tsx` -> `apps/desktop/tests/features/connections/lib/driverUI.test.tsx`
- Move: `apps/desktop/tests/pages/Connections.test.tsx` -> `apps/desktop/tests/features/connections/pages/ConnectionsPage.test.tsx`
- Move: `apps/desktop/tests/contexts/DatabaseProvider.test.tsx` -> `apps/desktop/tests/features/connections/state/DatabaseProvider.test.tsx`
- Move: `apps/desktop/tests/components/modals/NewConnectionModal.test.tsx` -> `apps/desktop/tests/features/connections/components/NewConnectionModal/NewConnectionModal.test.tsx`
- Move: `apps/desktop/tests/components/modals/ExportConnectionsModal.test.tsx` and `ImportFromAppModal.test.tsx` -> `apps/desktop/tests/features/connections/components/`
- Move: `apps/desktop/tests/hooks/useDatabase.test.ts` and `useOpenConnectionInNewWindow.test.ts` -> `apps/desktop/tests/features/connections/hooks/`
- Modify: `apps/desktop/src/features/connections/index.ts`
- Modify: `apps/desktop/src/app/providers.tsx`
- Modify: `apps/desktop/src/app/routes.tsx`

- [ ] **Step 1: Run existing connection workflows**

```bash
pnpm test apps/desktop/tests/contexts/DatabaseProvider.test.tsx apps/desktop/tests/pages/Connections.test.tsx apps/desktop/tests/components/modals/NewConnectionModal.test.tsx apps/desktop/tests/components/modals/ExportConnectionsModal.test.tsx apps/desktop/tests/components/modals/ImportFromAppModal.test.tsx apps/desktop/tests/hooks/useDatabase.test.ts apps/desktop/tests/hooks/useOpenConnectionInNewWindow.test.ts -- --run
```

Expected: PASS.

- [ ] **Step 2: Path-move only**

Use `git mv` and update import specifiers only. Task 1 contains exact app/editor/schema consumer exceptions with `owner: "connections"` and `removeByTask: 11`; no broad connections exception is allowed. The direct Tauri importers moved in this task are individually enumerated as `pages/Connections.tsx`, `NewConnectionModal.tsx`, `DatabaseProvider.tsx`, `ConnectionHealthMonitor.tsx`, `ConnectionIconImage.tsx`, `SshConnectionsManager.tsx`, `useOpenConnectionInNewWindow.ts`, `useConnectionWindowLifecycle.ts`, `useSshAskpass.ts`, `credentials.ts`, `ssh.ts`, and `k8s.ts`; architecture remains green only through one exact exception per actual package import, never a feature-wide cleanliness claim.

```bash
pnpm test apps/desktop/tests/features/connections -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with only the exact Task 11 publication/direct-Tauri exceptions.

- [ ] **Step 3: Publish runtime API separately**

Add named exports for `ConnectionsPage`, `DatabaseProvider`, `useDatabase`, `NewConnectionModal`, `ExportConnectionsModal`, `ImportFromAppModal`, `getConnectionIcon`, `getConnectionAccent`, `getDriverIcon`, and `getDriverColorStyle`. Connections imports settings and plugins only through their public entry points and never imports schema. Update app/editor/schema consumers and remove every exact Task 11 cross-feature publication exception, including schema's temporary legacy `useDatabase` imports. Retain the individually enumerated direct-Tauri exceptions until each file's raw characterization and gateway migration checkpoint in Tasks 13, 14, and 39.

```bash
pnpm test apps/desktop/tests/features/connections -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with no Task 11 cross-feature publication exception; the exact direct-Tauri exceptions retained for Tasks 13, 14, and 39 are still reported.

### Task 12: Move and publish connection-dependent plugin UI and API after connections

**Files:**
- Move: `apps/desktop/src/hooks/usePluginApi.ts` -> `apps/desktop/src/features/plugins/hooks/usePluginApi.ts`
- Move: `apps/desktop/src/components/settings/PluginSettingsPage.tsx` -> `apps/desktop/src/features/plugins/components/PluginSettingsPage.tsx`
- Move: `apps/desktop/src/components/settings/PluginsTab.tsx` -> `apps/desktop/src/features/plugins/components/PluginsTab.tsx`
- Create before movement: `apps/desktop/tests/features/plugins/hooks/usePluginApi.test.ts`
- Create before movement: `apps/desktop/tests/features/plugins/components/PluginsTab.test.tsx`
- Create before movement: `apps/desktop/tests/features/plugins/components/PluginSettingsPage.test.tsx`
- Modify: `apps/desktop/src/features/plugins/index.ts`
- Modify: `apps/desktop/src/app/routes.tsx`
- Delete after zero consumers: `apps/desktop/src/app/legacy/pluginSettingsComposition.tsx`

- [ ] **Step 1: Characterize raw connection-dependent behavior before movement**

Against old paths, cover `usePluginApi` raw invoke/dialog/opener behavior, connection selection and no-connection-required handling, plugin RPC fallback/errors, install/remove/settings navigation, and exact payload omission/null semantics. Preserve the Settings route's plugin composition tests from Task 7.

```bash
pnpm test apps/desktop/tests/features/plugins apps/desktop/tests/features/settings/pages/SettingsPage.test.tsx -- --run
```

Expected: PASS against the legacy connection-dependent paths with raw Tauri/plugin API assertions.

- [ ] **Step 2: Path-move only**

Use `git mv` and import-specifier changes only. Keep raw calls/assertions, exports, and app legacy adapter unchanged.

```bash
pnpm test apps/desktop/tests/features/plugins apps/desktop/tests/features/settings/pages/SettingsPage.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with exact Task 12 publication exceptions and characterized Task 39 raw-platform rows.

- [ ] **Step 3: Publish through the supported plugin root**

Export `usePluginApi`, `PluginsTab`, and `PluginSettingsPage` from `features/plugins/index.ts`. They consume connections/settings only through those feature roots. Keep their characterized raw-platform rows for Task 39. Update `app/routes.tsx`, verify content search reports zero consumers of `app/legacy/pluginSettingsComposition.tsx`, then delete it and remove its exact exceptions.

```bash
pnpm test apps/desktop/tests/features/plugins apps/desktop/tests/features/settings apps/desktop/tests/app/routes.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; supported public APIs are acyclic, settings never imports plugins, and the compatibility adapter has zero consumers before deletion.

### Task 13: Characterize, gateway-migrate, and decompose `NewConnectionModal`

This task has three sequential review checkpoints: raw characterization, gateway migration, and decomposition. Each checkpoint must pass its listed commands before the next begins; do not combine checkpoints in one diff.

**Files:**
- Modify: `apps/desktop/tests/features/connections/components/NewConnectionModal/NewConnectionModal.test.tsx`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/FieldInput.tsx`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/GeneralTab.tsx`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/DatabasesTab.tsx`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/SshSection.tsx`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/K8sSection.tsx`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/useConnectionForm.ts`
- Create: `apps/desktop/src/features/connections/components/NewConnectionModal/useConnectionPersistence.ts`
- Modify: `apps/desktop/src/features/connections/components/NewConnectionModal/NewConnectionModal.tsx`

- [ ] **Step 1: Characterize raw calls before migration**

Cover missing credentials, retry using the entered password, save without unrelated validation, exact save/update payload, K8s port modes, blank credential deletion on update, omitted `connection_id` on create, explicit `null` appearance removal, icon cleanup, plugin no-connection-required content, and stale database responses. Mock raw `invoke` and dialog APIs; do not assert gateways yet.

```bash
pnpm test apps/desktop/tests/features/connections/components/NewConnectionModal/NewConnectionModal.test.tsx -- --run
```

Expected: PASS against the unsplit raw-Tauri modal.

- [ ] **Step 2: Migrate one command family at a time**

After each family, update component tests to mock the gateway and rely on platform gateway contract tests for exact raw forwarding. After each family run:

```bash
pnpm test apps/desktop/tests/features/connections/components/NewConnectionModal/NewConnectionModal.test.tsx apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS before any decomposition; only the migrated family uses gateway mocks.

- [ ] **Step 3: Extract leaves and controllers**

Presentation leaves receive explicit props and cannot access contexts or gateways. Preserve separate state values, request IDs, timers, reset order, refs, persistence order, explicit `null`, and rejection behavior.

```bash
pnpm test apps/desktop/tests/features/connections/components/NewConnectionModal/NewConnectionModal.test.tsx -- --run
pnpm test apps/desktop/tests/features/connections -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no direct Tauri import remains in `NewConnectionModal` or its extracted helpers, its file-size baseline decreases, and the modal's legacy `SqlEditorWrapper` exception remains exact until Task 36.

### Task 14: Gateway-migrate and decompose `DatabaseProvider`

This task has three sequential review checkpoints: raw characterization, gateway migration, and decomposition. Each checkpoint must be independently green and reviewable.

**Files:**
- Modify: `apps/desktop/tests/features/connections/state/DatabaseProvider.test.tsx`
- Create: `apps/desktop/src/features/connections/state/createEmptyConnectionData.ts`
- Create: `apps/desktop/src/features/connections/state/connectionDataUpdates.ts`
- Create: `apps/desktop/src/features/connections/state/useCatalogLoading.ts`
- Create: `apps/desktop/src/features/connections/state/useConnectionLifecycle.ts`
- Create: `apps/desktop/src/features/connections/state/useConnectionGroups.ts`
- Create: `apps/desktop/src/features/connections/state/useConnectionSessionPersistence.ts`
- Modify: `apps/desktop/src/features/connections/state/DatabaseProvider.tsx`

- [ ] **Step 1: Extend raw-call characterization before migration**

Cover loading and already-loaded paths, stale previous database/schema selection, exact tuples, fallback catches, final disconnect with `connectionId: null`, parent `null` versus omission, and `connections:active-changed` cleanup.

```bash
pnpm test apps/desktop/tests/features/connections/state/DatabaseProvider.test.tsx -- --run
```

Expected: PASS against the unsplit provider.

- [ ] **Step 2: Migrate gateway families independently**

Order: window, lifecycle/session, catalog, groups, events. Keep payload construction at the call site. After each family run:

```bash
pnpm test apps/desktop/tests/features/connections/state/DatabaseProvider.test.tsx apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS before extraction; only the migrated family uses gateway mocks.

- [ ] **Step 3: Extract helpers and hooks**

Hooks may receive and update provider state but cannot own a second authoritative connection map or active context. After each extraction run the provider test and `pnpm typecheck`; then run:

```bash
pnpm test apps/desktop/tests/features/connections -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no direct Tauri import remains in `DatabaseProvider` or its extracted helpers, provider state ownership is unchanged, and other explicitly inventoried connections importers retain exact Task 39 exceptions.

### Task 15: Characterize editor core state and notebook adapter behavior before movement

**Files:**
- Modify: `apps/desktop/tests/contexts/EditorProvider.test.tsx`
- Modify: `apps/desktop/tests/hooks/useEditor.test.ts`
- Modify: `apps/desktop/tests/app/providers.test.tsx`

- [ ] **Step 1: Pin editor-core behavior**

Cover tab add/focus/deduplication using the complete connection/database/schema/table tuple, per-connection active tabs, load/fallback, persistence timing, notebook migration/open, schema-cache hit/miss, and unmount flush. Assert the legacy notebook functions are called through the provider boundary with exact arguments and ordering so Task 17 can substitute an `EditorNotebookAdapter` without behavior change; `app/providers.test.tsx` pins that the adapter instance is passed to `EditorProvider`.

```bash
pnpm test apps/desktop/tests/contexts/EditorProvider.test.tsx apps/desktop/tests/hooks/useEditor.test.ts apps/desktop/tests/app/providers.test.tsx -- --run
```

Expected: PASS against legacy paths with raw persistence invocation assertions unchanged.

### Task 16: Path-move editor core only

**Files:**
- Move: `apps/desktop/src/contexts/EditorContext.ts` -> `apps/desktop/src/features/editor/state/EditorContext.ts`
- Move: `apps/desktop/src/contexts/EditorProvider.tsx` -> `apps/desktop/src/features/editor/state/EditorProvider.tsx`
- Move: `apps/desktop/src/contexts/SavedQueriesContext.ts` -> `apps/desktop/src/features/editor/state/SavedQueriesContext.ts`
- Move: `apps/desktop/src/contexts/SavedQueriesProvider.tsx` -> `apps/desktop/src/features/editor/state/SavedQueriesProvider.tsx`
- Move: `apps/desktop/src/contexts/QueryHistoryContext.ts` -> `apps/desktop/src/features/editor/state/QueryHistoryContext.ts`
- Move: `apps/desktop/src/contexts/QueryHistoryProvider.tsx` -> `apps/desktop/src/features/editor/state/QueryHistoryProvider.tsx`
- Move: `apps/desktop/src/hooks/useEditor.ts` -> `apps/desktop/src/features/editor/hooks/useEditor.ts`
- Move: `apps/desktop/src/hooks/useSavedQueries.ts` -> `apps/desktop/src/features/editor/hooks/useSavedQueries.ts`
- Move: `apps/desktop/src/hooks/useQueryHistory.ts` -> `apps/desktop/src/features/editor/hooks/useQueryHistory.ts`
- Move: `apps/desktop/tests/contexts/EditorProvider.test.tsx` -> `apps/desktop/tests/features/editor/state/EditorProvider.test.tsx`
- Move: `apps/desktop/tests/contexts/SavedQueriesProvider.test.tsx` -> `apps/desktop/tests/features/editor/state/SavedQueriesProvider.test.tsx`
- Move: `apps/desktop/tests/hooks/useEditor.test.ts` -> `apps/desktop/tests/features/editor/hooks/useEditor.test.ts`
- Move: `apps/desktop/tests/hooks/useSavedQueries.test.ts` -> `apps/desktop/tests/features/editor/hooks/useSavedQueries.test.ts`

- [ ] **Step 1: Impact-check and use `git mv`**

Change import specifiers only. Do not publish new runtime exports, migrate gateways, or change assertions. Task 1 contains exact legacy-consumer exceptions for editor-core imports with `owner: "editor"` and `removeByTask: 17`; no broad editor exception is allowed. Preserve exact Task 39 direct-import rows and raw tests for `EditorProvider.tsx`, `SavedQueriesProvider.tsx`, and `QueryHistoryProvider.tsx`; this path-only task does not gateway-migrate them.

```bash
pnpm test apps/desktop/tests/features/editor/state/EditorProvider.test.tsx apps/desktop/tests/features/editor/hooks/useEditor.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with unchanged assertions and only the exact Task 17 exceptions reported.

### Task 17: Publish editor core API and injected notebook adapter before explorer

**Files:**
- Modify: `apps/desktop/src/features/editor/index.ts`
- Modify: editor-core consumers
- Modify: `apps/desktop/src/app/providers.tsx`

- [ ] **Step 1: Add named runtime exports and inject the editor-owned notebook port**

Export `EditorProvider`, `SavedQueriesProvider`, `QueryHistoryProvider`, `useEditor`, `useSavedQueries`, `useQueryHistory`, and the type-only `EditorNotebookAdapter`. Change `EditorProvider` to require `notebookAdapter: EditorNotebookAdapter` and route every characterized notebook load/open/migrate/flush call through it. `app/providers.tsx` constructs a legacy adapter from the unchanged old notebook functions and supplies it; `apps/desktop/tests/app/providers.test.tsx` and the moved provider test assert exact forwarding and order. Keep page components, execution controllers, private state modules, and notebook implementation unexported.

```bash
pnpm test apps/desktop/tests/features/editor/state apps/desktop/tests/features/editor/hooks -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; explorer can consume editor core only through `features/editor`, app owns notebook composition, editor has no notebooks import, and all exact Task 17 exceptions are removed.

### Task 18: Establish MCP ownership

**Files:**
- Move: `apps/desktop/src/pages/McpPage.tsx` -> `apps/desktop/src/features/mcp/pages/McpPage.tsx`
- Move: `apps/desktop/src/components/modals/McpModal.tsx` -> `apps/desktop/src/features/mcp/components/McpModal.tsx`
- Move: `apps/desktop/src/utils/mcpApprovalAttention.ts` -> `apps/desktop/src/features/mcp/lib/mcpApprovalAttention.ts`
- Move: `apps/desktop/src/components/modals/mcp/McpSafetySection.tsx` -> `apps/desktop/src/features/mcp/components/McpSafetySection.tsx`
- Move: `apps/desktop/tests/pages/McpPage.test.tsx` -> `apps/desktop/tests/features/mcp/pages/McpPage.test.tsx`
- Create: `apps/desktop/tests/features/mcp/components/McpSafetySection.test.tsx`
- Create: `apps/desktop/tests/features/mcp/components/McpModal.test.tsx`
- Create: `apps/desktop/tests/features/mcp/lib/mcpApprovalAttention.test.ts`
- Modify: `apps/desktop/src/features/mcp/index.ts`
- Modify: `apps/desktop/src/app/routes.tsx`

- [ ] **Step 1: Characterize raw MCP behavior before movement**

Keep raw `invoke`, notification, and window-attention mocks. Cover client-status ordering, install/uninstall/manual configuration payloads and visible errors; safety connection loading and fallback; every approval/read-only setting update including timeout fallback; modal open/close behavior; attention/notification order and cleanup; and exact omission/null rules. Do not mock `mcpGateway` or platform adapters.

```bash
pnpm test apps/desktop/tests/pages/McpPage.test.tsx apps/desktop/tests/features/mcp/components/McpSafetySection.test.tsx apps/desktop/tests/features/mcp/components/McpModal.test.tsx apps/desktop/tests/features/mcp/lib/mcpApprovalAttention.test.ts -- --run
```

Expected: PASS against legacy MCP paths with raw command assertions.

- [ ] **Step 2: Path-move only**

Use `git mv` and update import specifiers only. Keep all raw Tauri/notification/window assertions and exact Task 39 direct-import exceptions unchanged. MCP may consume `AiActivityPanel`, supported setting controls, `McpApprovalMode`, `useSettings`, and `useEditorTheme` only from `features/settings`. Task 7 already publishes these supported names.

```bash
pnpm test apps/desktop/tests/features/mcp -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with raw assertions unchanged.

- [ ] **Step 3: Publish MCP API separately**

Export only `McpPage` and `McpModal`; keep safety sections and setup internals private. Update app consumers through `features/mcp`. Keep raw Task 39 exceptions and characterization unchanged; MCP gateway/notification adapter migration occurs only in Task 39.

```bash
pnpm test apps/desktop/tests/features/mcp -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; command payloads and safety display behavior are unchanged.

### Task 19: Establish notebooks ownership

**Files:**
- Move: `apps/desktop/src/components/notebook/AddCellButton.tsx`, `CellChart.tsx`, `CellHistoryPanel.tsx`, `CellNameAiButton.tsx`, `CellSectionHeader.tsx`, `MarkdownCell.tsx`, `NotebookAiButtons.tsx`, `NotebookCellHeader.tsx`, `NotebookCellWrapper.tsx`, `NotebookHistoryPanel.tsx`, `NotebookOutline.tsx`, `NotebookToolbar.tsx`, `NotebookView.tsx`, `ParamsPanel.tsx`, `ResizeHandle.tsx`, `ResultToolbar.tsx`, `RunAllSummary.tsx`, `SqlCell.tsx`, `SqlCellEditor.tsx`, and `SqlCellResult.tsx` -> `apps/desktop/src/features/notebooks/components/`
- Move: `apps/desktop/src/utils/notebookStore.ts` -> `apps/desktop/src/features/notebooks/lib/notebookStore.ts`
- Move: `apps/desktop/src/utils/notebookExport.ts` -> `apps/desktop/src/features/notebooks/lib/notebookExport.ts`
- Move: `apps/desktop/src/utils/notebookHtmlExport.ts` -> `apps/desktop/src/features/notebooks/lib/notebookHtmlExport.ts`
- Move: `apps/desktop/src/utils/notebook.ts`, `notebookChart.ts`, `notebookDnd.ts`, `notebookFile.ts`, `notebookHistory.ts`, `notebookOutline.ts`, `notebookParams.ts`, `notebookRunAll.ts`, `notebookUndo.ts`, and `notebookVariables.ts` -> `apps/desktop/src/features/notebooks/lib/`
- Move: `apps/desktop/tests/utils/notebookUndo.test.ts`, `notebookRunAll.test.ts`, `notebookExport.test.ts`, `notebookDnd.test.ts`, `notebookParams.test.ts`, `notebookHtmlExport.test.ts`, `notebookStore.test.ts`, `notebookOutline.test.ts`, `notebookChart.test.ts`, `notebookFile.test.ts`, `notebookVariables.test.ts`, `notebook.test.ts`, and `notebookHistory.test.ts` -> `apps/desktop/tests/features/notebooks/lib/`
- Create before movement: `apps/desktop/tests/features/notebooks/components/NotebookOutline.test.tsx`, `NotebookView.test.tsx`, `CellNameAiButton.test.tsx`, and `ResultToolbar.test.tsx`
- Create before movement: `apps/desktop/tests/features/notebooks/components/NotebooksSection.test.tsx` importing the legacy explorer-owned section
- Modify: `apps/desktop/src/features/notebooks/index.ts`
- Modify: editor and explorer notebook consumers

- [ ] **Step 1: Characterize raw persistence**

Before movement, preserve cached/uncached loads, connection scoping, debounce, flush, rename, delete, event dispatch, and exact raw invoke/event payloads. Enumerate and characterize raw imports in `notebookStore.ts`, `NotebookOutline.tsx`, `NotebookView.tsx`, `CellNameAiButton.tsx`, `ResultToolbar.tsx`, and `NotebooksSection.tsx`; add any post-prerequisite importer from Task 1's scan.

```bash
pnpm test apps/desktop/tests/utils/notebookStore.test.ts apps/desktop/tests/utils/notebook.test.ts apps/desktop/tests/utils/notebookExport.test.ts apps/desktop/tests/utils/notebookHtmlExport.test.ts apps/desktop/tests/features/notebooks/components -- --run
```

Expected: PASS against legacy paths.

- [ ] **Step 2: Path-move only**

Use `git mv` and change imports only. Retain one exact Task 39 direct-import exception per characterized notebook importer; do not change raw assertions in this batch. Task 1 contains exact notebook-consumer exceptions for editor/explorer and exact notebook deep imports of the legacy DataGrid/SqlEditorWrapper, with `owner: "notebooks"` and `removeByTask: 26` or `36` as appropriate.

```bash
pnpm test apps/desktop/tests/features/notebooks -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with raw assertions unchanged, exact Task 26/36 cross-feature exceptions, and exact Task 39 raw-platform rows reported.

- [ ] **Step 3: Publish notebook API and supply the adapter separately**

Export only `NotebookView`, `NotebookMetadata`, `createNotebook`, `renameNotebook`, `deleteNotebook`, `listNotebooks`, `NOTEBOOKS_CHANGED_EVENT`, notebook contracts needed by app/explorer, and `editorNotebookAdapter: EditorNotebookAdapter`. The adapter is implemented in notebooks but typed by editor's public contract. `app/providers.tsx` replaces its legacy adapter with this published adapter; its provider test proves exact load/open/migrate/flush forwarding and provider order. `app/routes.tsx` injects `NotebookView` and page-level persistence operations into editor through explicit editor props/contracts; editor does not import the notebooks runtime root. Explorer consumes notebooks through `features/notebooks`. Remove the corresponding Task 19 publication exceptions but retain exact DataGrid/SqlEditorWrapper exceptions until Tasks 26/36.

```bash
pnpm test apps/desktop/tests/features/notebooks apps/desktop/tests/features/editor/state -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS after publication with no editor-to-notebooks runtime edge and no cross-feature notebook deep import; only exact DataGrid/SqlEditorWrapper exceptions remain.

- [ ] **Step 4: Gateway-migrate notebook persistence separately**

Switch raw assertions to notebook/event gateway assertions only now; preserve exact raw forwarding in platform gateway contracts.

```bash
pnpm test apps/desktop/tests/features/notebooks apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no direct Tauri import remains in the notebook persistence files migrated by this checkpoint; any other inventoried notebook importer retains an exact Task 39 exception.

### Task 20: Extract and publish `isExplainableQuery` without moving visual explain

**Files:**
- Create: `apps/desktop/src/features/visual-explain/lib/isExplainableQuery.ts`
- Create: `apps/desktop/tests/features/visual-explain/lib/isExplainableQuery.test.ts`
- Modify: `apps/desktop/src/features/visual-explain/index.ts`
- Modify: `apps/desktop/src/utils/sql.ts`

- [ ] **Step 1: Characterize the predicate on the legacy export**

Copy all current truthy/falsy cases for comments, whitespace, supported statements, unsupported statements, malformed input, and case handling into the new test while importing the legacy `utils/sql.ts` export.

```bash
pnpm test apps/desktop/tests/features/visual-explain/lib/isExplainableQuery.test.ts -- --run
```

Expected: PASS against the legacy implementation.

- [ ] **Step 2: Extract exactly, publish, and retain one named compatibility re-export**

Move only the unchanged predicate implementation into the visual-explain lib, export it by name from `features/visual-explain`, and make `utils/sql.ts` a named re-export for this symbol while leaving every other SQL utility untouched. Update owned consumers that can use the public root; do not move visual-explain UI in this task.

```bash
pnpm test apps/desktop/tests/features/visual-explain/lib/isExplainableQuery.test.ts apps/desktop/tests/utils/sql.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; the predicate has one implementation, and the exact legacy named re-export remains until Task 40 verifies zero consumers.

### Task 21: Establish visual-explain ownership

**Files:**
- Move: `apps/desktop/src/pages/VisualExplainPage.tsx` -> `apps/desktop/src/features/visual-explain/pages/VisualExplainPage.tsx`
- Move: `apps/desktop/src/components/modals/VisualExplainModal.tsx` -> `apps/desktop/src/features/visual-explain/components/VisualExplainModal.tsx`
- Move: `apps/desktop/src/components/explain/VisualExplainView.tsx` -> `apps/desktop/src/features/visual-explain/components/VisualExplainView.tsx`
- Move: `apps/desktop/src/components/modals/visual-explain/ExplainAiAnalysis.tsx`, `ExplainGraph.tsx`, `ExplainNodeDetails.tsx`, `ExplainOverviewBar.tsx`, `ExplainSummaryBar.tsx`, and `ExplainTableView.tsx` -> `apps/desktop/src/features/visual-explain/components/visual-explain/`
- Move: `apps/desktop/src/utils/explainPlan.ts` and `explainImport.ts` -> `apps/desktop/src/features/visual-explain/lib/`
- Move: `apps/desktop/tests/utils/explainPlan.test.ts` and `explainImport.test.ts` -> `apps/desktop/tests/features/visual-explain/lib/`
- Create: `apps/desktop/src/features/visual-explain/components/ApprovalExplainPlanView.tsx`
- Create: `apps/desktop/tests/features/visual-explain/components/VisualExplainModal.test.tsx`
- Create: `apps/desktop/tests/features/visual-explain/components/ExplainAiAnalysis.test.tsx`
- Test unchanged: `apps/desktop/tests/features/visual-explain/lib/isExplainableQuery.test.ts`
- Modify: `apps/desktop/src/features/visual-explain/index.ts`
- Modify: `apps/desktop/src/app/routes.tsx`
- Modify: `apps/desktop/src/app/providers.tsx`
- Modify: editor, notebooks, and settings AI-activity consumers

- [ ] **Step 1: Characterize raw visual-explain and AI-analysis behavior**

Cover page file-open/query paths; modal query validation, exact `explain_query_plan` payload including `schema: null`, loading/error/rerun/analyze state; AI automatic analysis, missing-provider display, exact provider/model/language payload, rejection text, and reset behavior. Keep raw invoke/dialog mocks.

```bash
pnpm test apps/desktop/tests/utils/explainPlan.test.ts apps/desktop/tests/utils/explainImport.test.ts apps/desktop/tests/features/visual-explain/components/VisualExplainModal.test.tsx apps/desktop/tests/features/visual-explain/components/ExplainAiAnalysis.test.tsx -- --run
```

Expected: PASS against legacy paths with raw assertions.

- [ ] **Step 2: Path-move only**

Use `git mv` and change imports only. Keep every raw invoke/dialog assertion and exact Task 39 direct-import exception unchanged. Keep exact Task 21 temporary exceptions for settings-owned approval/activity consumers importing the moved visual-explain implementation; each names the importer and has `removeByTask: 21`. `isExplainableQuery` was already extracted, tested, and published in Task 20; do not touch its implementation or compatibility re-export in this path-only batch.

```bash
pnpm test apps/desktop/tests/features/visual-explain -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with raw assertions unchanged, exact Task 21 cross-feature exceptions, and exact Task 39 raw-platform rows.

- [ ] **Step 3: Publish and remove the settings cycle separately**

Export only `VisualExplainPage`, `VisualExplainModal`, `VisualExplainView`, `ApprovalExplainPlanView`, `ExplainViewMode`, and supported explain contracts. `ApprovalExplainPlanView` accepts plan/view-state props and may consume settings through its own public API; settings never imports it. Change `AiApprovalGate`/`AiApprovalModal` to accept `renderExplainPlan: ApprovalExplainPlanRenderer`, and let `app/providers.tsx` pass `ApprovalExplainPlanView`. Rewrite editor, notebooks, and settings AI-activity composition through public roots or app composition and remove every Task 21 cross-feature exception. Retain exact Task 39 raw-platform rows until their separate migration.

```bash
pnpm test apps/desktop/tests/features/visual-explain apps/desktop/tests/features/settings/components/AiApprovalGate.test.tsx apps/desktop/tests/features/settings/lib/aiActivity.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no settings↔visual-explain cycle, and loaded-file/query calculations and approval behavior are unchanged.

### Task 22: Establish explicit AI ownership

**Files:**
- Move: `apps/desktop/src/components/modals/AiQueryModal.tsx` -> `apps/desktop/src/features/ai/components/AiQueryModal.tsx`
- Move: `apps/desktop/src/components/modals/AiExplainModal.tsx` -> `apps/desktop/src/features/ai/components/AiExplainModal.tsx`
- Move: `apps/desktop/src/components/ui/AiDropdownButton.tsx` -> `apps/desktop/src/features/ai/components/AiDropdownButton.tsx`
- Move: `apps/desktop/tests/components/modals/AiQueryModal.test.tsx` -> `apps/desktop/tests/features/ai/components/AiQueryModal.test.tsx`
- Create: `apps/desktop/tests/features/ai/components/AiExplainModal.test.tsx`
- Create: `apps/desktop/tests/features/ai/components/AiDropdownButton.test.tsx`
- Modify: `apps/desktop/tests/features/settings/components/AiApprovalGate.test.tsx`
- Modify: `apps/desktop/tests/features/settings/lib/aiActivity.test.ts`
- Modify: `apps/desktop/src/features/ai/contracts.ts`
- Modify: `apps/desktop/src/features/ai/index.ts`
- Modify: AI consumers in editor, notebooks, visual explain, and `apps/desktop/src/app/App.tsx`

- [ ] **Step 1: Characterize every raw AI consumer, audit path, and error path**

Keep raw invoke/listen/dialog/file/notification/window mocks across all AI consumers. The Task 1 inventory explicitly includes `AiQueryModal.tsx`, `AiExplainModal.tsx`, `GenerateSQLModal.tsx`, `useAiActivity.ts`, visual-explain AI analysis, settings approval/activity files, and `mcpApprovalAttention.ts`, plus every exact post-prerequisite importer. Cover query generation insertion/replace/cancel, explain generation, provider/model/language payloads, disabled/missing configuration, loading and rejection display, dropdown selection, approval pending/approve/deny/dismiss payloads, attention/notification ordering and cleanup, AI activity session/event loading, detail display, export dialog/file payloads, empty/cancelled exports, audit failures, and visual-explain AI analysis from Task 21. Do not mock `aiGateway`.

```bash
pnpm test apps/desktop/tests/components/modals/AiQueryModal.test.tsx apps/desktop/tests/features/ai/components/AiExplainModal.test.tsx apps/desktop/tests/features/ai/components/AiDropdownButton.test.tsx apps/desktop/tests/features/settings/components/AiApprovalGate.test.tsx apps/desktop/tests/features/settings/lib/aiActivity.test.ts apps/desktop/tests/features/visual-explain/components/ExplainAiAnalysis.test.tsx apps/desktop/tests/features/settings/pages/SettingsPage.test.tsx -- --run
```

Expected: PASS against legacy AI paths with exact raw calls, audit/event order, visible errors, and cleanup pinned.

- [ ] **Step 2: Path-move only**

Use `git mv` and import-specifier changes only. Task 1 contains exact cross-feature consumer exceptions with `owner: "ai"` and `removeByTask: 22`, plus one exact Task 39 direct-import exception for every AI/settings-activity/visual-analysis raw Tauri or plugin package import characterized above.

```bash
pnpm test apps/desktop/tests/features/ai apps/desktop/tests/features/settings apps/desktop/tests/features/visual-explain -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with raw assertions unchanged, exact Task 22 cross-feature exceptions, and exact Task 39 raw-platform rows.

- [ ] **Step 3: Publish AI API separately**

Export only `AiQueryModal`, `AiExplainModal`, `AiDropdownButton`, and their props contracts. AI imports settings and connections only through public entry points. Settings never imports `features/ai`; app composition owns global approval wiring. Rewrite editor, notebooks, visual explain, and app consumers and remove all Task 22 cross-feature exceptions. Retain exact Task 39 raw-platform rows until their separate migration.

```bash
pnpm test apps/desktop/tests/features/ai apps/desktop/tests/features/settings apps/desktop/tests/features/visual-explain -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with no settings↔AI cycle.

### Task 23: Establish explicit task-manager ownership

**Files:**
- Move: `apps/desktop/src/pages/TaskManagerPage.tsx` -> `apps/desktop/src/features/tasks/pages/TaskManagerPage.tsx`
- Move: `apps/desktop/src/hooks/useTaskManager.ts` -> `apps/desktop/src/features/tasks/hooks/useTaskManager.ts`
- Move: `apps/desktop/src/utils/taskManager.ts` -> `apps/desktop/src/features/tasks/lib/taskManager.ts`
- Move: `apps/desktop/tests/pages/TaskManagerPage.test.tsx` -> `apps/desktop/tests/features/tasks/pages/TaskManagerPage.test.tsx`
- Move: `apps/desktop/tests/utils/taskManager.test.ts` -> `apps/desktop/tests/features/tasks/lib/taskManager.test.ts`
- Create: `apps/desktop/tests/features/tasks/hooks/useTaskManager.test.ts`
- Modify: `apps/desktop/src/features/tasks/index.ts`
- Modify: `apps/desktop/src/app/routes.tsx`

- [ ] **Step 1: Characterize raw task-manager workflows before movement**

Do not mock the hook in the new hook suite. Keep raw `invoke` mocks and pin initial `Promise.all` concurrency for `get_process_list` and `get_system_stats`, polling interval and cleanup, manual refresh loading, stale data during refresh, kill-then-refresh order, disable-then-enable-then-refresh restart order, rejection display, per-plugin pending sets, and exact payloads. Expand the page test to cover `get_nexora_children`, expand/loading/reload, child-process rows, rejection behavior, and the complete visible kill/restart workflow.

```bash
pnpm test apps/desktop/tests/pages/TaskManagerPage.test.tsx apps/desktop/tests/utils/taskManager.test.ts apps/desktop/tests/features/tasks/hooks/useTaskManager.test.ts -- --run
```

Expected: PASS against legacy paths with raw Tauri assertions.

- [ ] **Step 2: Path-move only**

Use `git mv` and import changes only. Keep the page's direct child-process call, all raw assertions, and exact Task 39 direct-import exceptions unchanged.

```bash
pnpm test apps/desktop/tests/features/tasks -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with polling, action order, errors, and cleanup assertions unchanged.

- [ ] **Step 3: Publish tasks API separately**

Export only `TaskManagerPage`; keep the hook and process helpers private. Update app routing through `features/tasks`. Keep raw Task 39 exceptions and characterization unchanged; task gateway migration occurs only in Task 39.

```bash
pnpm test apps/desktop/tests/features/tasks -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS after publication; no raw assertion has switched to a gateway assertion.

### Task 24: Characterize DataGrid against raw Tauri APIs

The Task 1 direct-import inventory must name every current data-grid owner importer rather than mark the feature clean: legacy `components/ui/DataGrid.tsx`, `JsonInput.tsx`, `pages/JsonViewerPage.tsx`, and each exact additional importer row produced by Task 1's complete source/direct-import scan. `DataGridRow.tsx`, `RowEditorSidebar.tsx`, `JsonTreeView.tsx`, and `useRowEditor.ts` are explicitly recorded as scanned/non-importing unless the post-prerequisite scan finds a direct package import. Every importing row is paired with its exact Tauri package and removal task.

**Files:**
- Create: `apps/desktop/tests/features/data-grid/components/DataGrid.test.tsx`
- Modify: `apps/desktop/tests/components/ui/MultiResultPanel.test.tsx`

- [ ] **Step 1: Add complete old-path characterization**

Import `../../../../src/components/ui/DataGrid`. Mock raw `@tauri-apps/api/core` and `@tauri-apps/api/event`; do not mock `recordGateway` or `windowGateway`. Cover rows/columns, loading/already-loaded rendering, selection, sort, parent-driven filters/pagination, pending mutations, immediate update, read-only behavior, related records, JSON viewer events, server-now, visible errors, and unlisten cleanup. For every enumerated data-grid direct importer, add a raw `invoke`/`listen`/`emit`/plugin API assertion that passes before Task 25 movement; if an importer has no existing suite, add the smallest owner test now.

Assert the current immediate update exactly:

```typescript
expect(invoke).toHaveBeenCalledWith("update_record", {
  connectionId: "conn-2",
  table: "orders",
  pkMap: { id: 7 },
  colName: "status",
  newVal: "paid",
  schema: "reporting",
});
```

A second case asserts absent schema is omitted, not emitted as `schema: undefined`. Do not add `database`.

```bash
pnpm test apps/desktop/tests/features/data-grid/components/DataGrid.test.tsx apps/desktop/tests/components/ui/MultiResultPanel.test.tsx -- --run
```

Expected: PASS against `apps/desktop/src/components/ui/DataGrid.tsx` using raw Tauri assertions.

### Task 25: Path-move DataGrid without assertion or logic changes

**Files:**
- Move: `apps/desktop/src/components/ui/DataGrid.tsx` -> `apps/desktop/src/features/data-grid/components/DataGrid.tsx`
- Move: `apps/desktop/src/components/ui/DataGridRow.tsx` -> `apps/desktop/src/features/data-grid/components/DataGridRow.tsx`
- Move: `apps/desktop/src/components/ui/RowEditorSidebar.tsx` -> `apps/desktop/src/features/data-grid/components/RowEditorSidebar.tsx`
- Move: `apps/desktop/src/hooks/useRowEditor.ts` -> `apps/desktop/src/features/data-grid/hooks/useRowEditor.ts`
- Move: `apps/desktop/src/hooks/useRowEditorResize.ts` -> `apps/desktop/src/features/data-grid/hooks/useRowEditorResize.ts`
- Move: `apps/desktop/src/utils/dataGrid.ts` -> `apps/desktop/src/features/data-grid/lib/dataGrid.ts`
- Move: `apps/desktop/src/utils/dataGridCell.tsx` -> `apps/desktop/src/features/data-grid/lib/dataGridCell.tsx`
- Move: `apps/desktop/src/utils/pendingInsertions.ts` -> `apps/desktop/src/features/data-grid/lib/pendingInsertions.ts`
- Move: `apps/desktop/src/pages/JsonViewerPage.tsx` -> `apps/desktop/src/features/data-grid/pages/JsonViewerPage.tsx`
- Move: `apps/desktop/src/components/ui/JsonInput.tsx` and `JsonTreeView.tsx` -> `apps/desktop/src/features/data-grid/components/`
- Move: `apps/desktop/tests/utils/dataGrid.test.ts` and `dataGridCell.test.tsx` -> `apps/desktop/tests/features/data-grid/lib/`
- Move: `apps/desktop/tests/hooks/useRowEditor.test.ts` and `useRowEditorResize.test.ts` -> `apps/desktop/tests/features/data-grid/hooks/`
- Modify: imports required by movement
- Modify: `apps/desktop/src/app/routes.tsx`

- [ ] **Step 1: Impact-check, `git mv`, and change imports only**

Change the characterization import to `../../../../src/features/data-grid/components/DataGrid`. Do not alter any assertion or production statement. Task 1 contains exact consumer exceptions for editor/notebooks and the app JsonViewer route with `owner: "data-grid"` and `removeByTask: 26`.

```bash
pnpm test apps/desktop/tests/features/data-grid/components/DataGrid.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with the same raw Tauri assertions, exact Task 26 cross-feature exceptions, and the enumerated Task 27 direct-Tauri rows reported.

### Task 26: Publish the DataGrid public API

**Files:**
- Modify: `apps/desktop/src/features/data-grid/contracts.ts`
- Modify: `apps/desktop/src/features/data-grid/index.ts`
- Modify: `apps/desktop/src/components/ui/ResultEntryContent.tsx`
- Modify: `apps/desktop/src/pages/Editor.tsx`
- Modify: `apps/desktop/src/features/notebooks/components/SqlCellResult.tsx`
- Modify: `apps/desktop/src/app/routes.tsx`

- [ ] **Step 1: Publish named API and rewrite consumers**

Export `DataGrid`, `DataGridProps`, `JsonViewerPage`, and supported row-editing/JSON-viewer contracts. Update both named editor consumers, notebook `SqlCellResult`, and app routes to import from `features/data-grid`. Keep row context, cell renderers, and controllers private. Remove every exact Task 26 exception.

```bash
pnpm test apps/desktop/tests/features/data-grid -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; cross-feature consumers use only `features/data-grid` and raw behavior assertions remain unchanged.

### Task 27: Migrate DataGrid through gateways

**Files:**
- Modify: `apps/desktop/src/features/data-grid/components/DataGrid.tsx`
- Modify: `apps/desktop/tests/features/data-grid/components/DataGrid.test.tsx`
- Modify: `apps/desktop/tests/platform/tauri/gatewayContracts.test.ts`

- [ ] **Step 1: Migrate JSON window/events, record update, then server-now**

After each production migration, change the component test for that family from raw Tauri mocks to gateway mocks. Add raw forwarding assertions only to `gatewayContracts.test.ts`. Preserve `{ session_id, value }`, pending session lifetime, catches, payload omission, and cleanup.

```bash
pnpm test apps/desktop/tests/features/data-grid/components/DataGrid.test.tsx apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS and no direct Tauri import remains in data-grid.

### Task 28: Decompose DataGrid leaf-first

**Files:**
- Create: `apps/desktop/src/features/data-grid/hooks/useGridSelection.ts`
- Create: `apps/desktop/src/features/data-grid/hooks/useJsonViewerSession.ts`
- Create: `apps/desktop/src/features/data-grid/hooks/useCellEditing.ts`
- Create: `apps/desktop/src/features/data-grid/hooks/useGridClipboard.ts`
- Create: `apps/desktop/src/features/data-grid/components/DataGridHeader.tsx`
- Create: `apps/desktop/src/features/data-grid/components/DataGridBody.tsx`
- Create: `apps/desktop/src/features/data-grid/components/DataGridContextMenus.tsx`
- Modify: `apps/desktop/src/features/data-grid/components/DataGrid.tsx`

- [ ] **Step 1: Extract controllers, then visual sections**

DataGrid remains the state/orchestration owner. Presentation sections receive props and callbacks only. Run after each extraction:

```bash
pnpm test apps/desktop/tests/features/data-grid/components/DataGrid.test.tsx -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Then run:

```bash
pnpm test apps/desktop/tests/features/data-grid -- --run
pnpm lint
pnpm check:architecture
```

Expected: PASS and the DataGrid file-size baseline decreases.

### Task 29: Characterize Explorer against raw Tauri APIs

The Task 1 direct-import inventory must name every current explorer owner importer: legacy `components/layout/ExplorerSidebar.tsx`; `components/modals/DumpDatabaseModal.tsx` and `ImportDatabaseModal.tsx`; `components/layout/sidebar/SidebarRoutineItem.tsx`, `SidebarViewItem.tsx`, `SidebarTableItem.tsx`, `SidebarColumnItem.tsx`, and `NotebooksSection.tsx`; and each explorer utility found with a direct package import. Record exact package targets and removal tasks; do not use a feature-level exception or claim explorer is clean before Task 32.

**Files:**
- Create: `apps/desktop/tests/features/explorer/components/ExplorerSidebar.test.tsx`
- Modify: existing sidebar tests only to add missing visible workflow coverage

- [ ] **Step 1: Add old-path workflow characterization**

Import `../../../../src/components/layout/ExplorerSidebar`. Mock raw invoke/dialog APIs. Cover database/schema/table/view selection, stale previous selection, editor tab creation, loading paths, capability-gated actions, routines/triggers, indexes/foreign keys, ER diagrams, notebook/history tabs, dump/import/clipboard modals, and visible confirmation/error behavior. Add a passing raw invoke/listen/emit/plugin API assertion for every enumerated explorer direct importer before Task 30 moves it; missing suites get focused owner tests in this characterization task.

```typescript
expect(setActiveTableContext).toHaveBeenCalledWith("orders", "analytics", "reporting");
expect(addTab).toHaveBeenCalledWith(expect.objectContaining({
  type: "table",
  activeTable: "orders",
  connectionId: "conn-2",
  database: "analytics",
  schema: "reporting",
}));
```

Also pin raw data-transfer payloads: `import_database` has no database field, `dump_database` conditionally has database and schema as defined above, and clipboard import keeps nested snake_case plus `schema: null` when absent.

```bash
pnpm test apps/desktop/tests/features/explorer/components/ExplorerSidebar.test.tsx apps/desktop/tests/components/layout/sidebar -- --run
```

Expected: PASS against the legacy explorer with raw Tauri assertions.

### Task 30: Path-move Explorer without assertion or logic changes

**Files:**
- Move: `apps/desktop/src/components/layout/ExplorerSidebar.tsx` -> `apps/desktop/src/features/explorer/components/ExplorerSidebar.tsx`
- Move: `apps/desktop/src/components/layout/sidebar/Accordion.tsx` -> `apps/desktop/src/features/explorer/components/sidebar/Accordion.tsx`
- Move: `SidebarDatabaseItem.tsx`, `SidebarSchemaItem.tsx`, `SidebarTableItem.tsx`, `SidebarViewItem.tsx`, `SidebarRoutineItem.tsx`, `SidebarRoutineGroupHeader.tsx`, `SidebarTriggerItem.tsx`, `SidebarColumnItem.tsx`, `SidebarIndexList.tsx`, `NotebooksSection.tsx`, and `QueryHistorySection.tsx` -> `apps/desktop/src/features/explorer/components/sidebar/`
- Move: `apps/desktop/src/components/modals/DumpDatabaseModal.tsx` and `ImportDatabaseModal.tsx` -> `apps/desktop/src/features/explorer/components/`
- Move: `apps/desktop/src/utils/quickNavigator.ts` -> `apps/desktop/src/features/explorer/lib/quickNavigator.ts`
- Move: `apps/desktop/src/utils/sidebarTableItem.ts` -> `apps/desktop/src/features/explorer/lib/sidebarTableItem.ts`
- Move: `apps/desktop/tests/components/layout/sidebar/Accordion.test.tsx`, `SidebarDatabaseItem.test.tsx`, `SidebarSchemaItem.test.tsx`, and `SidebarViewItem.test.tsx` -> `apps/desktop/tests/features/explorer/components/sidebar/`
- Move: `apps/desktop/tests/components/layout/sidebar/SidebarTableItem.test.ts` -> `apps/desktop/tests/features/explorer/lib/sidebarTableItem.test.ts`
- Modify: imports required by movement

- [ ] **Step 1: Impact-check, `git mv`, and change imports only**

Change the characterization import to `../../../../src/features/explorer/components/ExplorerSidebar`. Do not alter assertions, exports, Tauri calls, or component code. Task 1 contains exact app-shell and modal-consumer exceptions with `owner: "explorer"` and `removeByTask: 31`.

```bash
pnpm test apps/desktop/tests/features/explorer -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with unchanged raw Tauri assertions, exact Task 31 cross-feature exceptions, and the enumerated Task 32 direct-Tauri rows reported.

### Task 31: Publish Explorer API

**Files:**
- Modify: `apps/desktop/src/features/explorer/contracts.ts`
- Modify: `apps/desktop/src/features/explorer/index.ts`
- Modify: `apps/desktop/src/app/shell/`

- [ ] **Step 1: Publish named exports and update shell imports**

Export `ExplorerSidebar`, `SidebarTab`, `ContextMenuData`, `ExplorerObjectContext`, and `ExplorerTableContext`. Explorer consumes `features/editor` core, connections, schema, and notebooks only through feature roots. Update app shell imports and remove every exact Task 31 exception.

```bash
pnpm test apps/desktop/tests/features/explorer -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no cross-feature deep import is introduced.

### Task 32: Migrate Explorer through gateways

**Files:**
- Modify: `apps/desktop/src/features/explorer/components/ExplorerSidebar.tsx`
- Modify: `apps/desktop/src/features/explorer/components/DumpDatabaseModal.tsx`
- Modify: `apps/desktop/src/features/explorer/components/ImportDatabaseModal.tsx`
- Modify: `apps/desktop/tests/features/explorer/components/ExplorerSidebar.test.tsx`
- Modify: `apps/desktop/tests/platform/tauri/gatewayContracts.test.ts`

- [ ] **Step 1: Migrate focused families**

Order: definitions, semantic database/schema/table actions, index/foreign-key actions, ER window, dump/import/dialog/events. Component tests switch to gateways only after each corresponding production migration. Platform tests pin raw forwarding.

```bash
pnpm test apps/desktop/tests/features/explorer/components/ExplorerSidebar.test.tsx apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; no direct Tauri import remains in explorer.

### Task 33: Decompose Explorer leaf-first

**Files:**
- Create: `apps/desktop/src/features/explorer/hooks/useExplorerSelection.ts`
- Create: `apps/desktop/src/features/explorer/hooks/useExplorerActions.ts`
- Create: `apps/desktop/src/features/explorer/hooks/useExplorerContextMenu.ts`
- Create: `apps/desktop/src/features/explorer/components/CreateDatabaseModal.tsx`
- Create: `apps/desktop/src/features/explorer/components/ExplorerStructure.tsx`
- Create: `apps/desktop/src/features/explorer/components/ExplorerTabs.tsx`
- Create: `apps/desktop/src/features/explorer/components/ExplorerModals.tsx`
- Modify: `apps/desktop/src/features/explorer/components/ExplorerSidebar.tsx`

- [ ] **Step 1: Extract presentation, selection/actions, then coordination**

No hook may infer database from schema or labels or own active database/schema/table state. Run after each extraction:

```bash
pnpm test apps/desktop/tests/features/explorer/components/ExplorerSidebar.test.tsx -- --run
pnpm typecheck
```

Then run:

```bash
pnpm test apps/desktop/tests/features/explorer -- --run
pnpm lint
pnpm check:architecture
```

Expected: PASS and the ExplorerSidebar file-size baseline decreases.

### Task 34: Characterize Editor page against raw Tauri APIs

The Task 1 direct-import inventory must name every editor owner importer: legacy `pages/Editor.tsx`, `pages/ResultsWindowPage.tsx`, `components/ui/MultiResultPanel.tsx`, `SqlEditorWrapper.tsx`, `BlobInput.tsx`, `VisualQueryBuilder.tsx`, every editor-owned modal with a direct package import, `hooks/useReferencedRecord.ts`, `utils/editor.ts`, and every additional moved editor utility/importer found by the complete scan. `useSqlAutocompleteRegistration.ts` and `useDangerousQueryGuard.ts` are recorded as scanned/non-importing unless the post-prerequisite scan finds a direct package import. Each row names the exact package and Task 37 removal; no broad editor exception or pre-gateway cleanliness claim is valid.

**Files:**
- Create: `apps/desktop/tests/features/editor/pages/EditorPage.test.tsx`
- Modify: `apps/desktop/tests/components/ui/MultiResultPanel.test.tsx`

- [ ] **Step 1: Add complete old-path workflow characterization**

Import `../../../../src/pages/Editor`. Mock raw `invoke`, `listen`, `emit`, save dialogs, and file APIs; do not mock gateways. Cover single query, batch progressive events, stop-on-error, stale context, query params, pagination/count, metadata, pending records, cancel, export, detached results, notebooks, visual explain, AI, and visible errors. Add a passing raw invoke/listen/emit/dialog/fs/clipboard/window assertion for every enumerated editor direct importer before Task 35 moves it; create focused owner tests for any importer not reached by `EditorPage.test.tsx` or `MultiResultPanel.test.tsx`.

```typescript
expect(invoke).toHaveBeenCalledWith("execute_query", {
  connectionId: "conn-2",
  query: "select * from orders",
  limit: 100,
  page: 1,
  database: "analytics",
  schema: "reporting",
});
```

Pin pending delete/update/insert raw payloads with the same full tuple and assert `Promise.all` completion before pending-state reset. Pin listener-before-invoke and results-window emit order.

```bash
pnpm test apps/desktop/tests/features/editor/pages/EditorPage.test.tsx apps/desktop/tests/features/editor/state/EditorProvider.test.tsx apps/desktop/tests/components/ui/MultiResultPanel.test.tsx -- --run
```

Expected: PASS against the legacy editor page with raw Tauri assertions.

### Task 35: Path-move Editor page without assertion or logic changes

**Files:**
- Move: `apps/desktop/src/pages/Editor.tsx` -> `apps/desktop/src/features/editor/pages/EditorPage.tsx`
- Move: `apps/desktop/src/pages/ResultsWindowPage.tsx` -> `apps/desktop/src/features/editor/pages/ResultsWindowPage.tsx`
- Move: `apps/desktop/src/components/ui/MultiResultPanel.tsx` -> `apps/desktop/src/features/editor/components/MultiResultPanel.tsx`
- Move: `apps/desktop/src/components/ui/SqlEditorWrapper.tsx` -> `apps/desktop/src/features/editor/components/SqlEditorWrapper.tsx`
- Move: `apps/desktop/src/components/ui/VisualQueryBuilder.tsx`, `JoinEdge.tsx`, and `TableNode.tsx` -> `apps/desktop/src/features/editor/query-builder/`
- Move: `apps/desktop/src/components/modals/ExportProgressModal.tsx` -> `apps/desktop/src/features/editor/components/ExportProgressModal.tsx`
- Move: `apps/desktop/src/components/modals/QueryModal.tsx`, `QuerySelectionModal.tsx`, `ExplainSelectionModal.tsx`, `TabSwitcherModal.tsx`, `QueryParamsModal.tsx`, and `ErrorModal.tsx` -> `apps/desktop/src/features/editor/components/modals/`
- Move: `apps/desktop/src/hooks/useDangerousQueryGuard.ts`, `useSqlAutocompleteRegistration.ts`, and `useReferencedRecord.ts` -> `apps/desktop/src/features/editor/hooks/`
- Move: `apps/desktop/src/utils/editor.ts`, `editorContext.ts`, the remaining `sql.ts` utilities, `sqlSplitter/`, `multiResult.ts`, `queryParameters.ts`, `resultsWindowSync.ts`, `tabScroll.ts`, `tabCleaner.ts`, `tabFilters.ts`, and `newConsole.ts` -> `apps/desktop/src/features/editor/lib/`; retain Task 20's exact named legacy `isExplainableQuery` compatibility module/re-export unchanged until Task 40 proves zero consumers
- Move: `apps/desktop/src/utils/dragState.ts` and `visualQuery.ts` -> `apps/desktop/src/features/editor/query-builder/`
- Move: `apps/desktop/tests/utils/editor.test.ts`, `editorContext.test.ts`, and `multiResult.test.ts` -> `apps/desktop/tests/features/editor/lib/`
- Move: `apps/desktop/tests/hooks/useDangerousQueryGuard.test.ts` -> `apps/desktop/tests/features/editor/hooks/useDangerousQueryGuard.test.ts`
- Move: `apps/desktop/tests/components/modals/QueryModal.test.tsx` and `QuerySelectionModal.test.tsx` -> `apps/desktop/tests/features/editor/components/modals/`
- Move: `apps/desktop/tests/components/ui/MultiResultPanel.test.tsx` and `SqlEditorWrapper.test.tsx` -> `apps/desktop/tests/features/editor/components/`
- Move: `apps/desktop/tests/components/ui/TableNode.test.tsx` and `apps/desktop/tests/utils/visualQuery.test.ts` -> `apps/desktop/tests/features/editor/query-builder/`
- Modify: imports required by movement

- [ ] **Step 1: Impact-check, `git mv`, and change imports only**

Change the characterization import to `../../../../src/features/editor/pages/EditorPage`. Do not alter assertions, exports, direct Tauri calls, or production logic. Task 1 contains exact app/explorer and `SqlEditorWrapper` consumer exceptions with `owner: "editor"` and `removeByTask: 36`. Three Task-removal exceptions must be literal importer/target pairs: `features/schema/components/modals/ViewEditorModal.tsx -> components/ui/SqlEditorWrapper`, `features/schema/components/modals/TriggerEditorModal.tsx -> components/ui/SqlEditorWrapper`, and `features/connections/components/NewConnectionModal/NewConnectionModal.tsx -> components/ui/SqlEditorWrapper`, each with `removeByTask: 36`; notebook `SqlCellEditor.tsx` has its own exact pair. After the move, update only each exact target to `features/editor/components/SqlEditorWrapper` and retain the same importer-specific exception until publication. No directory wildcard or general “legacy editor” exception is allowed.

```bash
pnpm test apps/desktop/tests/features/editor/pages/EditorPage.test.tsx apps/desktop/tests/features/editor -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS with unchanged raw Tauri assertions, exact Task 36 cross-feature exceptions including the three named modal-to-`SqlEditorWrapper` pairs plus the notebook pair, and the enumerated Task 37 direct-Tauri rows reported.

### Task 36: Publish Editor page API

**Files:**
- Modify: `apps/desktop/src/features/editor/index.ts`
- Modify: `apps/desktop/src/app/routes.tsx`
- Modify: `apps/desktop/src/components/layout/SplitPaneLayout.tsx`
- Modify: `apps/desktop/src/features/explorer/components/ExplorerSidebar.tsx`
- Modify: `apps/desktop/src/features/connections/components/NewConnectionModal/NewConnectionModal.tsx`
- Modify: `apps/desktop/src/features/schema/components/modals/ViewEditorModal.tsx`
- Modify: `apps/desktop/src/features/schema/components/modals/TriggerEditorModal.tsx`
- Modify: `apps/desktop/src/features/notebooks/components/SqlCellEditor.tsx`

- [ ] **Step 1: Publish supported runtime entry points**

Export `EditorPage`, `EditorPageProps` including the notebook renderer/persistence adapter, `ResultsWindowPage`, `MultiResultPanel`, `SqlEditorWrapper`, `SqlEditorWrapperProps`, existing core providers/hooks, and the editor contracts consumed by explorer/data-grid/notebooks. Update app routes, app shell, explorer, connections, schema, and notebooks to use `features/editor`; app supplies notebook runtime composition to `EditorPage`, so editor never imports `features/notebooks`. Remove every exact Task 36 exception, including the literal `ViewEditorModal`, `TriggerEditorModal`, `NewConnectionModal`, and notebook `SqlEditorWrapper` pairs. Keep query-builder internals, execution controllers, and internal sections private because the editor page is their sole owner.

```bash
pnpm test apps/desktop/tests/features/editor -- --run
pnpm typecheck
pnpm lint
pnpm check:architecture
```

Expected: PASS; all cross-feature editor imports end at `features/editor`.

### Task 37: Migrate Editor through gateways

**Files:**
- Modify: `apps/desktop/src/features/editor/pages/EditorPage.tsx`
- Modify: `apps/desktop/tests/features/editor/pages/EditorPage.test.tsx`
- Modify: `apps/desktop/tests/platform/tauri/gatewayContracts.test.ts`

- [ ] **Step 1: Migrate command families independently**

Order: title/catalog; query/cancel/count/batch; results-window events; record mutations; export/dialog/file. After each production migration, switch only that component-test family to gateway mocks and add exact raw forwarding to platform tests. Preserve all ordering, catches, tuples, omission, and cleanup.

```bash
pnpm test apps/desktop/tests/features/editor/pages/EditorPage.test.tsx apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run
pnpm typecheck
```

Run after every family. Then run:

```bash
pnpm test apps/desktop/tests/features/editor -- --run
pnpm lint
pnpm check:architecture
```

Expected: PASS and no direct Tauri import remains in editor.

### Task 38: Decompose Editor leaf-first

**Files:**
- Create: `apps/desktop/src/features/editor/hooks/useQueryExecution.ts`
- Create: `apps/desktop/src/features/editor/hooks/useBatchExecution.ts`
- Create: `apps/desktop/src/features/editor/hooks/useTableMetadata.ts`
- Create: `apps/desktop/src/features/editor/hooks/usePendingRecords.ts`
- Create: `apps/desktop/src/features/editor/hooks/useQueryExport.ts`
- Create: `apps/desktop/src/features/editor/hooks/useDetachedResults.ts`
- Create: `apps/desktop/src/features/editor/components/EditorTabs.tsx`
- Create: `apps/desktop/src/features/editor/components/EditorToolbar.tsx`
- Create: `apps/desktop/src/features/editor/components/EditorWorkspace.tsx`
- Create: `apps/desktop/src/features/editor/components/EditorResults.tsx`
- Create: `apps/desktop/src/features/editor/components/EditorModals.tsx`
- Modify: `apps/desktop/src/features/editor/pages/EditorPage.tsx`

- [ ] **Step 1: Extract payload builders and hooks, then presentation**

Tab state stays in `EditorProvider`; connection/database/schema/table state stays in `DatabaseProvider`; presentation state stays local. Preserve refs, listener timing, progressive updates, pending mutation concurrency, export transitions, and detached-window handshake.

```bash
pnpm test apps/desktop/tests/features/editor/pages/EditorPage.test.tsx -- --run
pnpm typecheck
```

Run after each extraction. Then run:

```bash
pnpm test apps/desktop/tests/features/editor -- --run
pnpm lint
pnpm check:architecture
pnpm build
```

Expected: PASS and the EditorPage file-size baseline decreases.

### Task 39: Complete residual ownership and Tauri gateway rollout by exact owner

**Files:**
- Create: `apps/desktop/src/platform/tauri/schemaGateway.ts`
- Create: `apps/desktop/src/platform/tauri/tunnelGateway.ts`
- Create: `apps/desktop/src/platform/tauri/dataTransferGateway.ts`
- Create: `apps/desktop/src/platform/tauri/notebookGateway.ts`
- Create: `apps/desktop/src/platform/tauri/fileGateway.ts`
- Create: `apps/desktop/src/platform/tauri/settingsGateway.ts`
- Create: `apps/desktop/src/platform/tauri/updateGateway.ts`
- Create: `apps/desktop/src/platform/tauri/pluginGateway.ts`
- Create: `apps/desktop/src/platform/tauri/mcpGateway.ts`
- Create: `apps/desktop/src/platform/tauri/aiGateway.ts`
- Create: `apps/desktop/src/platform/tauri/taskGateway.ts`
- Modify: existing platform gateways/contracts
- Modify: classified feature callers and tests
- Modify: `apps/desktop/tests/platform/tauri/gatewayContracts.test.ts`
- Modify: `apps/desktop/tests/repository/frontendBoundaries.test.ts`

- [ ] **Step 1: Reconcile the exact direct-import inventory**

Start from Task 1's per-file inventory and rescan after Tasks 2-38. Every row is `{ importer, importTarget, owner, characterizationTest, gatewayOrAdapter, removeByTask: 39 }`; fail on an unclassified or uncharacterized importer and on a stale row. Preserve the explicit connections list from Task 11, data-grid list from Task 24, explorer list from Task 29, and editor list from Task 34. Also enumerate every schema, notebook, settings/update, plugin, MCP, visual-explain/AI, tasks, and app direct importer. Never collapse owners into `editor/data-grid`, `plugins/MCP`, or `windows/events/dialogs/files` rows.

```bash
pnpm test apps/desktop/tests/repository/frontendBoundaries.test.ts -- --run
```

Expected: FAIL listing only classified temporary exceptions.

- [ ] **Step 2: Make each residual owner's raw characterization independently green**

For one owner row batch at a time, add or extend tests that mock the raw imported package and assert exact `invoke`, `listen`, `emit`, dialog/fs, opener, notification, clipboard-manager, updater, path, or `convertFileSrc` forwarding. Run the owner's command below and require PASS against production still using raw APIs. Do not edit production or gateway mocks in this checkpoint.

- [ ] **Step 3: Migrate that owner through gateways/adapters in a separate checkpoint**

Only after the owner's raw checkpoint passes, switch production to gateways/adapters, switch only that owner's feature assertions to gateway/adapter mocks, add exact raw forwarding to `gatewayContracts.test.ts` or `platformAdapters.test.ts`, remove only that owner's exact direct-import rows, and rerun the same owner command plus `pnpm typecheck`, `pnpm lint`, and `pnpm check:architecture`:

| Owner batch | Exact test command |
|---|---|
| connections/tunnels (only rows remaining after Tasks 13-14) | `pnpm test apps/desktop/tests/features/connections apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| schema | `pnpm test apps/desktop/tests/features/schema apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| notebooks (only rows remaining after Task 19 persistence migration) | `pnpm test apps/desktop/tests/features/notebooks apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| settings and updates | `pnpm test apps/desktop/tests/features/settings apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| plugins | `pnpm test apps/desktop/tests/features/plugins apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| MCP | `pnpm test apps/desktop/tests/features/mcp apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| AI, including visual-explain AI analysis and settings audit/activity | `pnpm test apps/desktop/tests/features/ai apps/desktop/tests/features/visual-explain apps/desktop/tests/features/settings apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |
| tasks, including page child-process calls | `pnpm test apps/desktop/tests/features/tasks apps/desktop/tests/platform/tauri/gatewayContracts.test.ts -- --run` |
| app windows/events/dialogs/files/opener/path/assets | `pnpm test apps/desktop/tests/app apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts -- --run` |

Expected: PASS for each independent batch. Preserve settings language timeout/theme/update order, plugin defaults/RPC fallback, MCP safety, AI audit/error/event behavior, and task polling/concurrency/cancellation/process shapes.

- [ ] **Step 4: Prove rollout completion**

```bash
pnpm test apps/desktop/tests/platform/tauri/gatewayContracts.test.ts apps/desktop/tests/platform/tauri/platformAdapters.test.ts apps/desktop/tests/repository/frontendBoundaries.test.ts -- --run
pnpm check:architecture
pnpm typecheck
pnpm lint
```

Expected: PASS with zero direct imports of Tauri core/event/window/dialog/fs/opener/notification/clipboard-manager/updater/path/`convertFileSrc` outside platform, zero platform-to-feature imports, zero feature cycles, and zero frontend Tauri exceptions. This is the first task allowed to make the global prohibition claim.

### Task 40: Normalize residual feature/app/shared ownership, remove compatibility paths, and rerun debt canaries

Task 1's manifest, not the abbreviated examples below, is the complete staging contract. Before moving anything, print all `moveTask: 40` rows grouped by owner and verify every source exists, every destination is unique, and each group has an exact narrow test command.

**Files:**
- Modify: `apps/desktop/src/app/App.tsx`
- Modify: `apps/desktop/src/app/main.tsx`
- Modify: `apps/desktop/src/app/providers.tsx`
- Modify: `apps/desktop/src/app/routes.tsx`
- Move: `apps/desktop/src/components/layout/MainLayout.tsx`, `SplitPaneLayout.tsx`, `Sidebar.tsx`, and `PanelDatabaseProvider.tsx` -> `apps/desktop/src/app/shell/`
- Move: `apps/desktop/src/components/layout/sidebar/NavItem.tsx` -> `apps/desktop/src/app/shell/NavItem.tsx`
- Move: `apps/desktop/src/components/SocialLinks.tsx` -> `apps/desktop/src/app/components/SocialLinks.tsx`
- Create before movement: `apps/desktop/tests/app/components/SocialLinks.test.tsx`
- Create before movement: `apps/desktop/tests/app/shell/PanelDatabaseProvider.test.tsx`
- Move: `apps/desktop/src/contexts/AlertContext.ts` and `AlertProvider.tsx` -> `apps/desktop/src/app/state/`
- Move: `apps/desktop/src/contexts/ConnectionLayoutContext.ts` and `ConnectionLayoutProvider.tsx` -> `apps/desktop/src/app/shell/state/`
- Move: `apps/desktop/src/polyfills.ts` -> `apps/desktop/src/app/polyfills.ts`
- Move: `apps/desktop/src/index.css` -> `apps/desktop/src/app/index.css`
- Move: `apps/desktop/src/App.css` -> `apps/desktop/src/app/App.css`
- Move: `apps/desktop/src/pluginApi.ts` -> `apps/desktop/src/features/plugins/pluginApi.ts`
- Move: `apps/desktop/src/config/links.ts`, `socialLinks.ts`, `shortcuts.json`, `apps/desktop/src/data/changelog.ts`, and `apps/desktop/src/version.ts` -> `apps/desktop/src/app/config/`
- Move: `apps/desktop/tests/version.test.ts` -> `apps/desktop/tests/app/config/version.test.ts` in the same path-only batch as `version.ts`
- Move: `apps/desktop/src/i18n/config.ts`, `language.ts`, and `locales/` -> `apps/desktop/src/app/i18n/`
- Move: `apps/desktop/src/themes/colorUtils.ts`, `themeRegistry.ts`, `themeUtils.ts`, `monaco/`, and `presets/` -> `apps/desktop/src/features/settings/themes/`
- Move: `apps/desktop/src/workers/layoutWorker.ts` -> `apps/desktop/src/shared/workers/layoutWorker.ts`
- Move: `apps/desktop/src/types/wkx.d.ts` -> `apps/desktop/src/shared/types/wkx.d.ts`
- Move: `apps/desktop/src/components/ui/Modal.tsx`, `Select.tsx`, `ContextMenu.tsx`, `ErrorDisplay.tsx`, `EditorErrorBoundary.tsx`, `PasswordInput.tsx`, `BetaBadge.tsx`, and `SlotErrorBoundary.tsx` -> `apps/desktop/src/shared/ui/`
- Move: `apps/desktop/src/hooks/useEscapeKey.ts`, `useContainerWidth.ts`, `useColumnResize.ts`, and `useAlert.ts` -> `apps/desktop/src/shared/hooks/`
- Move: `apps/desktop/src/utils/errors.ts`, `formatTime.ts`, `fuzzy.ts`, `dropdownPosition.ts`, `text.ts`, and `versionCompare.ts` -> `apps/desktop/src/shared/lib/`
- Modify: `packages/plugin-api/scripts/check-sync.ts`
- Modify: `architecture/policy.json`
- Modify: `scripts/check-architecture.mjs`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/frontend.md`
- Modify: `.rules/react.md`
- Modify: `.rules/modals.md`
- Modify: `.rules/testing.md`
- Test: `apps/desktop/tests/repository/frontendBoundaries.test.ts`
- Test: `tests/repository/architectureDocumentation.test.ts`
- Test: `tests/repository/frontendSourceOwnership.test.ts`
- Test unchanged: `tests/repository/frontendSql.test.ts`
- Test unchanged: `tests/repository/driverSpecificFrontend.test.ts`

- [ ] **Step 1: Reconcile and print the complete residual owner batches**

Fail unless every Task 40 manifest row is assigned to a named owner batch with an exact destination and test command, including all residual UI/modals/hooks/types/utils plus app shell/config/i18n/styles, settings themes, shared worker/declaration, `SocialLinks`, and `PanelDatabaseProvider`. This generated list is also the only optional `git add` list; do not stage files not present in it.

- [ ] **Step 2: Prove shared candidates have two real feature consumers**

Keep domain helpers in their owner. `Modal`, `Select`, `ContextMenu`, generic error boundaries, resize/escape hooks, and domain-neutral formatting may qualify; connection, schema, query, grid, notebook, capability, and driver helpers do not.

- [ ] **Step 3: Path-move residual feature, app, shared, and shell modules only**

Use `git mv`, move tests, and change imports. Do not refactor implementation in this batch. Execute the generated Task 1 ownership rows in owner-sized path-only batches, including every residual `ui`, modal, hook, type, utility, worker, locale, declaration, and style file not moved by Tasks 7-39. Each batch's staging list is generated by filtering manifest rows on `moveTask: 40`; never stage a directory wildcard. Move `apps/desktop/tests/version.test.ts` with `version.ts`, and run `apps/desktop/tests/app/config/version.test.ts` only after that move. Run the existing app tests plus each just-moved test after every owner-sized path batch; this command occurs after Tasks 2, 4, and 5 created `apps/desktop/tests/app`, so it never targets a nonexistent directory.

- [ ] **Step 4: Normalize composition and remove shims**

Preserve the exact Task 2 route paths and Task 4 provider nesting. Change `HOST_BARREL` in `packages/plugin-api/scripts/check-sync.ts` from `src/pluginApi.ts` to `apps/desktop/src/features/plugins/pluginApi.ts`; preserve the host barrel's exported names and keep `pnpm check:plugin-api` green. For each compatibility file/re-export, run content search against production, tests, config, and scripts and require zero consumers before deletion. This includes Task 20's legacy `isExplainableQuery` re-export; remove it only here after the zero-consumer result. Remove all frontend exceptions.

- [ ] **Step 5: Enforce final assertions**

```typescript
expect(directTauriImportsOutsidePlatform).toEqual([]);
expect(platformImportsFromFeatures).toEqual([]);
expect(featureCycles).toEqual([]);
expect(crossFeatureDeepImports).toEqual([]);
expect(sharedImportsFromFeatures).toEqual([]);
expect(sharedUiContextAccess).toEqual([]);
expect(legacyFrontendCompatibilityFiles).toEqual([]);
expect(frontendTestsOutsideDesktopTests).toEqual([]);
expect(unownedFrontendProductionFiles).toEqual([]);
expect(missingDeclaredDestinations).toEqual([]);
expect(duplicateMoveSources).toEqual([]);
expect(unexpectedLegacyProductionPaths).toEqual([]);
expect(ownerManifestMismatches).toEqual([]);
expect(unapprovedGeneratedFrontendFiles).toEqual([]);
```

```bash
pnpm test apps/desktop/tests/repository/frontendBoundaries.test.ts tests/repository/architecturePolicy.test.ts tests/repository/architectureDocumentation.test.ts tests/repository/frontendSourceOwnership.test.ts -- --run
pnpm check:architecture
pnpm typecheck
pnpm lint
```

Expected: PASS with no compatibility path or temporary frontend exception, every post-prerequisite production TS/TSX/style/worker/locale/declaration source assigned to one exact destination/task, every destination present, and only explicit generated-file rows accepted.

- [ ] **Step 6: Re-run unchanged frontend SQL and driver-specific debt canaries**

The exact sorted baselines were created in Task 1. Do not edit or regenerate either test.

```bash
pnpm test tests/repository/frontendSql.test.ts tests/repository/driverSpecificFrontend.test.ts -- --run
```

Expected: PASS with exactly the pre-recorded baseline. This structural program neither adds nor remediates SQL/driver-specific debt.

## Final Verification

First verify the plan/ownership bookkeeping produced attainable completion claims:

```bash
python - <<'PY'
import re
from pathlib import Path
p = Path("docs/superpowers/plans/2026-07-20-frontend-modularization.md")
text = p.read_text()
nums = [int(n) for n in re.findall(r"^### Task (\d+):", text, re.M)]
assert nums == list(range(1, 41)), nums
PY
pnpm test tests/repository/frontendSourceOwnership.test.ts -- --run
git diff --check
```

Expected: task headings are exactly `1..40`, the generated ownership map has no stale/unassigned/duplicate row or missing destination, and `git diff --check` exits `0`.

Before pushing, creating/updating a PR, or reporting the program complete, run from the repository root:

```bash
pnpm check:architecture
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm build
```

Expected: every command exits `0`. If any Rust/Tauri file changed, also run:

```bash
pnpm test:rust
```

Expected: exits `0`. Do not push, create/update a PR, or report completion while a required command fails.
