# Rust/Tauri Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose Nexora's migrated Rust/Tauri backend into focused app, command, domain, driver, plugin, and infrastructure modules while preserving every runtime and public contract.

**Architecture:** Work leaf-first behind compatibility re-exports. First freeze command registration and shared behavior, then move app setup and command families without rewriting them, extract connection resolution and cancellation, and split pool/plugin/infrastructure mechanisms. Convert only workflows already expressed through `DatabaseDriver` into thin Tauri adapters over Tauri-independent domains; retain current transfer/clipboard workflows and the two count/server-time SQL workflows in narrow exact-path compatibility owners until separate behavior programs add approved semantic driver operations.

**Tech Stack:** Rust 2021 (MSRV 1.85), Cargo, Tauri 2.10, Tokio, sqlx, deadpool-postgres, rustls, serde/serde_json, pnpm workspace orchestration, GitNexus.

## Global Constraints

- This plan starts only after the desktop migration and Rust test normalization plans are merged; all paths below assume `apps/desktop/src-tauri/` exists.
- Structural changes must not alter runtime behavior, visible UI, SQL, database-specific semantics, state ownership, command names, payload shapes, serde/JSON behavior, error strings, event names, timeouts, cancellation behavior, plugin JSON-RPC, or driver capabilities.
- Preserve every entry in the current `tauri::generate_handler!` registration, including ordering and the existing duplicate `dump_commands::cancel_dump` entry. Removing the duplicate requires a separate behavior-approved task.
- Preserve the complete context tuple a current command actually accepts: `connection_id`, `database`, `schema`, and `table` where present. Never infer database context from a schema, label, window title, or saved primary database, and never add `database`, `schema`, or `table` to a command or workflow that does not currently carry that field.
- Do not change `DatabaseDriver`, `DriverCapabilities`, built-in SQL generation, plugin manifest fields, RPC method names, RPC parameter keys, fallback detection, error codes, timeout values, or audit ordering. In particular, do not add semantic transfer methods or capabilities in this structural program.
- Current export, dump/import, and clipboard-import code that branches on driver IDs, calls built-in pools/modules directly, or constructs engine-specific SQL is legacy behavior, not domain logic. Keep it in an explicitly allowlisted compatibility owner until a separately approved behavior program adds matching semantic operations to `DatabaseDriver`; domains and generic infrastructure must not absorb or bypass it.
- Keep the existing count-wrapper and server-time SQL outside commands and generic domains in exact crate-private owners `count_query_compat.rs` and `server_time_compat.rs`; preserve their complete workflows unchanged and add no related `DatabaseDriver` methods in this structural program.
- Legacy characterization tests must compile and pass against the pre-extraction owner before any move. Target-interface TDD tests are separate tests added afterward and must fail only because the proposed interface or boundary is absent; never describe a characterization test as initially failing because its production file has not moved yet.
- Preserve `PLUGIN_CALL_TIMEOUT = 120s`, `PLUGIN_INIT_TIMEOUT = 15s`, health `PING_TIMEOUT = 5s`, health failure threshold `2`, approval polling `500ms`, and all existing cancellation slot keys.
- Preserve multiple abort handles per connection. Dump and import continue to use distinct slots; import retains `format!("{}_import", connection_id)`.
- Use `git mv` before editing a file whose contents are primarily moving. Do not mix unrelated cleanup, warning fixes, formatting, SQL remediation, or behavior changes into extraction tasks.
- Keep compatibility paths usable during staged extraction with `pub use`, especially `crate::commands::*`, `crate::pool_manager::*`, `crate::config::*`, `crate::plugins::driver::{PluginProcess, RpcDriver}`, `crate::export::*`, `crate::dump_commands::*`, and `crate::health_check::*`.
- Treat externally reachable facades such as `nexora_lib::commands`, `nexora_lib::pool_manager`, `nexora_lib::config`, `nexora_lib::plugins::driver`, and `nexora_lib::health_check` as preserved public API. Never remove or narrow one because repository-local GitNexus/text search reports zero consumers; removal requires a separately approved public-API deprecation/breaking-change program with external-consumer evidence.
- Keep non-trivial Rust tests in a canonical sibling `tests.rs` aggregator plus `tests/*.rs` children when a suite has multiple files. Do not create a competing `tests/mod.rs` or add inline production test modules.
- Follow the Standard Task Gate in `docs/superpowers/plans/2026-07-20-repository-modularization-master.md` before every task. During that gate, run commands from repository root through the preserved root scripts; after the desktop migration, raw Cargo commands use `apps/desktop/src-tauri/Cargo.toml`. A task is complete only after its listed narrow tests, `pnpm test:rust`, structural diff review, and any architecture/root-command contracts affected by that task pass.
- Before editing every externally referenced symbol, refresh GitNexus and run upstream impact analysis. The current index fails with LadybugDB storage version 42 versus runner version 40; implementation must stop until `node .gitnexus/run.cjs analyze` succeeds. Warn and stop for HIGH or CRITICAL risk.
- Do not create commits unless the user explicitly asks. This plan contains no commit steps.

---

## Target File Structure and Responsibilities

```text
apps/desktop/src-tauri/src/
├── app/
│   ├── mod.rs                    # desktop-mode orchestration only
│   ├── commands.rs               # generate_handler registration only
│   ├── debug.rs                  # debug/devtools Tauri commands and debug flag
│   ├── setup.rs                  # setup hook and startup side effects
│   ├── state.rs                  # managed-state construction
│   ├── tests.rs                  # canonical aggregator declaring all children
│   └── tests/
│       ├── command_registration.rs
│       ├── setup.rs
│       └── state.rs
├── commands/
│   ├── mod.rs                    # family declarations and compatibility re-exports
│   ├── legacy.rs                 # retained shared helpers through Tasks 5–6 only
│   ├── blobs.rs
│   ├── catalog.rs
│   ├── connection_groups.rs
│   ├── connection_lifecycle.rs
│   ├── connection_store.rs
│   ├── connection_transfer.rs
│   ├── config.rs                  # Tauri config command adapters
│   ├── ddl.rs
│   ├── drivers.rs
│   ├── keybindings.rs
│   ├── kubernetes.rs
│   ├── queries.rs
│   ├── records.rs
│   ├── routines.rs
│   ├── ssh.rs
│   ├── triggers.rs
│   ├── views.rs
│   ├── windows.rs
│   ├── tests.rs                  # declares normalized child suites
│   └── tests/
│       ├── blobs.rs
│       ├── compatibility.rs
│       ├── connection_groups.rs
│       ├── connection_lifecycle.rs
│       ├── connection_store.rs
│       ├── connection_transfer.rs
│       ├── context_forwarding.rs
│       ├── export_import.rs
│       ├── group_tree.rs
│       ├── keybindings.rs
│       ├── queries.rs
│       ├── records.rs
│       ├── ssh.rs
│       └── windows.rs
├── domains/
│   ├── mod.rs
│   ├── catalog/
│   │   ├── mod.rs
│   │   ├── service.rs
│   │   └── tests.rs
│   ├── connections/
│   │   ├── mod.rs
│   │   ├── context.rs
│   │   ├── groups.rs
│   │   ├── lifecycle.rs
│   │   ├── service.rs
│   │   └── tests/
│   └── queries/
│       ├── mod.rs
│       ├── blobs.rs
│       ├── records.rs
│       ├── service.rs
│       └── tests/
├── infrastructure/
│   ├── mod.rs
│   ├── cancellation/
│   │   ├── mod.rs
│   │   └── tests.rs
│   ├── config/
│   │   ├── mod.rs
│   │   ├── ai_keys.rs
│   │   ├── model.rs
│   │   ├── prompts.rs
│   │   ├── store.rs
│   │   └── tests/
│   ├── connections/
│   │   ├── mod.rs
│   │   ├── repository.rs
│   │   ├── resolution.rs
│   │   └── tests/
│   ├── health/
│   │   ├── mod.rs
│   │   ├── active.rs
│   │   ├── events.rs
│   │   ├── ping.rs
│   │   └── tests.rs
│   ├── import_export/
│   │   ├── mod.rs                 # engine-neutral format/sink/reader mechanisms only
│   │   ├── format.rs
│   │   ├── progress.rs
│   │   ├── sink.rs
│   │   ├── sql_reader.rs
│   │   ├── tests.rs               # canonical aggregator declaring all children
│   │   └── tests/
│   │       ├── format.rs
│   │       ├── progress.rs
│   │       ├── sink.rs
│   │       └── sql_reader.rs
│   ├── keybindings/
│   │   ├── mod.rs                 # characterized keybinding JSON storage
│   │   └── tests.rs
│   └── pools/
│       ├── mod.rs
│       ├── key.rs
│       ├── mysql.rs
│       ├── postgres.rs
│       ├── registry.rs
│       ├── sqlite.rs
│       ├── startup_script.rs
│       ├── tls.rs
│       └── tests/
├── mcp/
│   ├── mod.rs                    # public exports only
│   ├── audit.rs
│   ├── connections.rs
│   ├── install.rs
│   ├── preflight.rs
│   ├── protocol.rs
│   ├── resources.rs
│   ├── router.rs
│   ├── server.rs
│   ├── tools/
│   │   ├── mod.rs
│   │   ├── describe.rs
│   │   ├── list.rs
│   │   └── query.rs
│   └── tests/
│       ├── mod.rs                 # declares all five child suites
│       ├── audit.rs
│       ├── protocol.rs
│       ├── query_approval.rs
│       ├── router.rs
│       └── target_interfaces.rs
├── plugins/
│   ├── mod.rs
│   ├── driver.rs                 # preserved public compatibility facade; re-export only
│   ├── process.rs                # child lifecycle and newline JSON-RPC transport
│   ├── rpc.rs                    # wire types only
│   ├── rpc_driver.rs             # DatabaseDriver adapter only
│   ├── tests.rs                  # canonical aggregator; retains manifest suite slot
│   └── tests/
│       ├── manifest.rs
│       ├── process.rs
│       └── rpc_driver.rs
├── config.rs                     # preserved public compatibility facade; re-export only
├── count_query_compat/
│   └── tests.rs                  # frozen SQL/arguments/conversion/errors
├── count_query_compat.rs          # crate-private unchanged count-wrapper SQL workflow
├── dump_commands.rs              # allowlisted legacy transfer workflow owner
├── export.rs                     # allowlisted legacy transfer workflow owner plus compatibility exports
├── clipboard_import.rs           # allowlisted legacy transfer workflow owner
├── health_check.rs               # preserved public compatibility facade; re-export only
├── pool_manager.rs               # preserved public compatibility facade; re-export only
├── server_time_compat/
│   └── tests.rs                  # frozen branch/SQL/arguments/conversion/errors
├── server_time_compat.rs          # crate-private unchanged server-time SQL workflow
└── lib.rs                        # module declarations, global log access, run delegation
```

### Stable interfaces

```rust
pub struct DatabaseContext<'a> {
    pub connection_id: &'a str,
    pub database: Option<&'a str>,
    pub schema: Option<&'a str>,
    pub table: Option<&'a str>,
}

// Construct this from the exact fields already present on each command.
// `None` means that command does not carry the field; it is not permission
// to infer it from another field or invent a new command argument.

pub struct ResolvedConnection {
    pub saved: crate::models::SavedConnection,
    pub params: crate::models::ConnectionParams,
    pub driver: std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>,
}

#[async_trait::async_trait]
pub trait ConnectionContextResolver: Send + Sync {
    async fn resolve(&self, context: DatabaseContext<'_>) -> Result<ResolvedConnection, String>;
}

pub type AbortHandleMap = std::collections::HashMap<
    String,
    Vec<std::sync::Arc<tokio::task::AbortHandle>>,
>;

pub fn register_abort_handle(
    handles: &std::sync::Mutex<AbortHandleMap>,
    key: String,
    handle: std::sync::Arc<tokio::task::AbortHandle>,
);

pub fn unregister_abort_handle(
    handles: &std::sync::Mutex<AbortHandleMap>,
    key: &str,
    handle: &std::sync::Arc<tokio::task::AbortHandle>,
);

pub fn abort_slot(
    handles: &std::sync::Mutex<AbortHandleMap>,
    key: &str,
) -> Vec<std::sync::Arc<tokio::task::AbortHandle>>;
```

`ConnectionContextResolver::resolve` must execute the existing sequence without reordering it: load saved connection, expand saved SSH, expand saved Kubernetes, create/reuse tunnel, set stable `connection_id`, apply the explicit database override, then resolve the driver. `schema` and `table` are carried unchanged for the domain method and are not interpreted by the resolver.

### Preserved compatibility facades and re-exports

```rust
// commands/mod.rs
pub use self::blobs::*;
pub use self::catalog::*;
pub use self::connection_groups::*;
pub use self::connection_lifecycle::*;
pub use self::connection_store::*;
pub use self::connection_transfer::*;
pub use self::config::*;
pub use self::ddl::*;
pub use self::drivers::*;
pub use self::keybindings::*;
pub use self::kubernetes::*;
pub use self::queries::*;
pub use self::records::*;
pub use self::routines::*;
pub use self::ssh::*;
pub use self::triggers::*;
pub use self::views::*;
pub use self::windows::*;
pub use crate::infrastructure::cancellation::{
    register_abort_handle, unregister_abort_handle, AbortHandleMap,
};
pub use crate::infrastructure::connections::repository::find_connection_by_id;
pub use crate::infrastructure::connections::resolution::{
    expand_k8s_connection_params, expand_ssh_connection_params,
    resolve_connection_params, resolve_connection_params_with_id,
};

// pool_manager.rs
pub use crate::infrastructure::pools::*;

// config.rs
pub use crate::commands::config::*;
pub use crate::infrastructure::config::*;

// plugins/driver.rs
pub use super::process::PluginProcess;
pub use super::rpc_driver::RpcDriver;

// export.rs: retain the current public command/state names while legacy
// driver-specific execution remains owned here; also re-export moved neutral helpers.
pub use crate::infrastructure::import_export::{
    parse_csv_delimiter, value_to_csv_string, CsvSink, ExportFormat, JsonSink,
    ProgressEmitter, RowSink, DEFAULT_CSV_DELIMITER, DEFAULT_PROGRESS_INTERVAL,
};

// dump_commands.rs: retain DumpOptions, DumpCancellationState, ImportProgress,
// dump_database, cancel_dump, import_database, and cancel_import in this owner.

// health_check.rs
pub use crate::infrastructure::health::{
    active_connections, emit_active_changed, register_connection, restart_ping_loop,
    start_ping_loop, stop_ping_loop, unregister_connection,
    ACTIVE_CONNECTIONS_CHANGED_EVENT, DEFAULT_PING_INTERVAL,
};
```

These are the complete current health compatibility exports: `DEFAULT_PING_INTERVAL`, `ACTIVE_CONNECTIONS_CHANGED_EVENT`, `register_connection`, `unregister_connection`, `active_connections`, `emit_active_changed`, `start_ping_loop`, `stop_ping_loop`, and `restart_ping_loop`. `FAILURE_THRESHOLD`, `PING_TIMEOUT`, `ping_all_connections`, `ping_single_connection`, and `handle_connection_failure` remain private and are exercised through sibling unit tests, not integration tests.

Keep every pure compatibility facade for the duration of this plan. Repository-local GitNexus and text search may identify internal migration progress but must never authorize removal of a public facade: `nexora_lib::pool_manager` and the other externally reachable facades are preserved public API, even at zero local consumers. Any removal belongs to a separately approved public-API deprecation/breaking-change program, not automatic packages/tooling cleanup. The allowlisted legacy `export.rs`, `dump_commands.rs`, and `clipboard_import.rs` owners are not logic-free shims and are removable only after a separately approved `DatabaseDriver` transfer-capability program replaces their driver-name branches, direct pools, and engine-specific SQL.

---

### Task 1: Clear the backend prerequisite and capture the behavioral baseline

**Files:**
- Read: `AGENTS.md`
- Read: `.rules/general.md`
- Read: `.rules/rust.md`
- Read: `.rules/testing.md`
- Read: `docs/architecture/repository-structure.md`
- Read: `architecture/policy.json`
- Verify: `apps/desktop/src-tauri/Cargo.toml`

**Interfaces:**
- Consumes: migrated desktop workspace and normalized Rust tests.
- Produces: a green baseline and usable GitNexus index; no source changes.

- [ ] **Step 1: Verify migration prerequisites**

Run:

```bash
test -f apps/desktop/src-tauri/Cargo.toml
test -f docs/architecture/repository-structure.md
test -f architecture/policy.json
! test -d src-tauri
```

Expected: exit code `0`. If any check fails, stop and complete the desktop migration, foundation, and test-normalization plans first.

- [ ] **Step 2: Inspect branch and working tree**

Run:

```bash
git status --short --branch
git log --oneline -10
```

Expected: intended implementation branch and no unrelated uncommitted files. Preserve pre-existing user changes.

- [ ] **Step 3: Rebuild GitNexus with the installed runner**

Run:

```bash
node .gitnexus/run.cjs analyze
```

Expected: analysis completes without the LadybugDB version mismatch. Then run a GitNexus query for `Tauri command registration connection resolution cancellation pool plugin RPC`; expected: readable processes and symbols. Do not edit if the index remains unavailable.

- [ ] **Step 4: Run upstream impact analysis**

Analyze at minimum `run`, `find_connection_by_id`, `resolve_connection_params`, `register_abort_handle`, `get_mysql_pool_with_id`, `get_postgres_pool_with_id`, `get_sqlite_pool_with_id`, `PluginProcess`, `RpcDriver`, `load_config_internal`, `run_mcp_server`, `export_query_to_file`, `dump_database`, `import_database`, and `start_ping_loop`.

Expected: direct callers and affected processes are recorded. Warn and stop before editing any HIGH or CRITICAL result.

- [ ] **Step 5: Add and pass complete pre-move legacy characterization gates**

Before creating any target module or changing ownership, add sibling legacy tests under the normalized source tree and a source-only app contract test. These tests call or parse the current owners (`lib.rs`, `export.rs`, `dump_commands.rs`, `health_check.rs`, `clipboard_import.rs`, and `connection_import_commands.rs`), not proposed target interfaces. Use small test seams in the current owner when a private orchestration path cannot otherwise be exercised; any seam is `#[cfg(test)]`/`pub(crate)` only and must not change production visibility.

The pre-move gate must cover:

- app setup: exact six-plugin order (updater, clipboard manager, opener, dialog, fs, notification); exact 11-state order; setup attached after states and before the invoke handler; built-in driver registration before external plugin loading; then health loop, approval watcher, heartbeat, maximize, devtools, and explain-window handling; build error text; run call; and Exit-only tunnel shutdown/log behavior;
- query export: sanitization, selected `database` override, CSV/JSON bytes, built-in direct-stream versus plugin pagination behavior, final `export_progress` payload, multiple cancellation handles, and success/driver-error/cancellation mapping;
- dump/import: selected `database` and existing default-`public` schema behavior, header/table order and exact SQL, first `.sql` ZIP selection, statement/error attribution, initial/periodic/final `import_progress` ordering and payloads, separate dump/import slots, every registered handle aborted, and exact absent/cancel/join errors;
- health: active registration/unregistration snapshots, immediate first interval tick, disabled interval, concurrent pinging, success counter reset, threshold `2`, timeout `5s`, no-new-built-in-pool check, failure order `unregister -> close pool -> connection-health-failed -> connections:active-changed`, and exact payloads;
- clipboard import: current tuple only (`connection_id`, optional `schema`, `table_name`; no invented `database`), create/fail/append/replace paths, drop/add/create/insert ordering, empty rows, 500-row batches, exact driver calls/SQL/errors, and successful result;
- connection-import workflow: source availability/count ordering; unknown source/import error; preview imports then loads existing connections and registered drivers, analyzes, and only then caches the secret-bearing envelope; keychain cancellation/error propagation from the importer; apply requires and removes the cached preview before driver/group resolution and `apply_export_payload`; failed apply does not restore the one-shot cache; Nexora preview/apply order; exact errors; and cancellation paths perform no cache write or apply.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app_setup_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml health_check::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml clipboard_import::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import_commands::tests
```

Expected: every legacy characterization test executes at least one test and PASS against the pre-extraction owners. If a test fails, fix only the test seam, fixture, or an independently approved existing bug; do not begin a move. Record these exact filters as the pre-move gate for Tasks 3, 6, and 11.

- [ ] **Step 6: Run the remaining narrow Rust baseline**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml pool_manager
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp
```

Expected: all selected tests PASS. Filtering out every test is not acceptable; record the executed test count and use exact module filters if names changed during normalization.

- [ ] **Step 7: Run the complete backend baseline**

Run:

```bash
pnpm test:rust
```

Expected: PASS, with environment-dependent integration tests explicitly reported as ignored rather than silently passing as no-ops.

---

### Task 2: Freeze Tauri command registration and managed-state contracts

**Files:**
- Create: `apps/desktop/src-tauri/tests/tauri_command_contract.rs`
- Create: `apps/desktop/src-tauri/tests/fixtures/tauri-command-registration.txt`
- Create: `apps/desktop/src-tauri/tests/fixtures/managed-state-registration.txt`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: the current `tauri::generate_handler!` block and `.manage(...)` chain.
- Produces: immutable ordered snapshots used by every later extraction task.

The command fixture contains one fully qualified handler path per line, copied in order from the migrated `lib.rs`. It must include all 234 current entries, the local `is_debug_mode`, `open_devtools`, and `close_devtools` entries, and both occurrences of `dump_commands::cancel_dump`. The state fixture contains these exact managed types in order:

```text
commands::QueryCancellationState
export::ExportCancellationState
dump_commands::DumpCancellationState
SharedLogBuffer
Arc<credential_cache::CredentialCache>
Arc<connection_cache::ConnectionCache>
connection_import_commands::ImportEnvelopeCache
explain_import::PendingExplainFile
json_viewer::JsonViewerStore
results_window::ResultsWindowStore
query_history::QueryHistoryState
```

- [ ] **Step 1: Write the characterization test**

Implement source normalization in `tauri_command_contract.rs` that extracts the contents of `tauri::generate_handler![...]`, removes `//` comments, trims commas/whitespace, and compares the resulting ordered vector to `tests/fixtures/tauri-command-registration.txt`. Add the same comparison for `.manage(...)` expressions against the managed-state fixture.

```rust
#[test]
fn tauri_handler_registration_matches_baseline() {
    let source = include_str!("../src/lib.rs");
    let actual = extract_generate_handler_paths(source);
    let expected = fixture_lines(include_str!("fixtures/tauri-command-registration.txt"));
    assert_eq!(actual, expected);
}

#[test]
fn managed_state_registration_matches_baseline() {
    let source = include_str!("../src/lib.rs");
    let actual = extract_managed_state_types(source);
    let expected = fixture_lines(include_str!("fixtures/managed-state-registration.txt"));
    assert_eq!(actual, expected);
}
```

- [ ] **Step 2: Run the contract test before moving code**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
```

Expected: PASS against the pre-extraction `lib.rs`. If it fails, fix only the parser or fixture; do not alter registration.

- [ ] **Step 3: Add explicit assertions for fragile constants**

Add source-level assertions that the registration contains the event-producing commands `execute_query_batch`, `export_query_to_file`, `import_database`, and active-connection commands exactly as captured. Assert that `cancel_dump` occurs twice.

- [ ] **Step 4: Re-run the contract and full backend tests**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
pnpm test:rust
```

Expected: PASS with no production behavior change.

---

### Task 3: Extract desktop app setup from `lib.rs`

**Files:**
- Create: `apps/desktop/src-tauri/src/app/mod.rs`
- Create: `apps/desktop/src-tauri/src/app/commands.rs`
- Create: `apps/desktop/src-tauri/src/app/debug.rs`
- Create: `apps/desktop/src-tauri/src/app/plugins.rs`
- Create: `apps/desktop/src-tauri/src/app/setup.rs`
- Create: `apps/desktop/src-tauri/src/app/state.rs`
- Create: `apps/desktop/src-tauri/src/app/tests.rs`
- Create: `apps/desktop/src-tauri/src/app/tests/command_registration.rs`
- Create: `apps/desktop/src-tauri/src/app/tests/setup.rs`
- Create: `apps/desktop/src-tauri/src/app/tests/state.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/tests/tauri_command_contract.rs`

**Interfaces:**
- Consumes: `cli::Args`, `logger::SharedLogBuffer`, all current command functions and managed-state types.
- Produces: `app::run_desktop(args: cli::Args, log_buffer: SharedLogBuffer)` and these crate-private builder stages: `attach_plugins`, `manage_state`, `attach_setup`, and `register_commands`.

The stages are structural names for contiguous segments of the current chain. Their signatures preserve and return the same generic builder:

```rust
pub(crate) fn attach_plugins<R: tauri::Runtime>(
    builder: tauri::Builder<R>,
) -> tauri::Builder<R>;

pub(crate) fn manage_state<R: tauri::Runtime>(
    builder: tauri::Builder<R>,
    log_buffer: crate::logger::SharedLogBuffer,
) -> tauri::Builder<R>;

pub(crate) fn attach_setup<R: tauri::Runtime>(
    builder: tauri::Builder<R>,
    args: crate::cli::Args,
) -> tauri::Builder<R>;

pub(crate) fn register_commands<R: tauri::Runtime>(
    builder: tauri::Builder<R>,
) -> tauri::Builder<R>;
```

`run_desktop` must call them in this exact order, with nothing inserted between stages:

```rust
pub fn run_desktop(args: crate::cli::Args, log_buffer: crate::logger::SharedLogBuffer) {
    sqlx::any::install_default_drivers();
    let builder = attach_plugins(tauri::Builder::default());
    let builder = manage_state(builder, log_buffer);
    let builder = attach_setup(builder, args);
    let builder = register_commands(builder);
    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                log::info!("Application exiting, stopping all active SSH tunnels...");
                crate::ssh_tunnel::stop_all_tunnels();
            }
        });
}
```

`attach_plugins` registers exactly these six current plugins in order: `tauri_plugin_updater::Builder::new().build()`, `tauri_plugin_clipboard_manager::init()`, `tauri_plugin_opener::init()`, `tauri_plugin_dialog::init()`, `tauri_plugin_fs::init()`, and `tauri_plugin_notification::init()`. `manage_state` applies the exact 11-entry fixture from Task 2. `attach_setup` attaches the one existing closure without executing or splitting its side effects. `register_commands` applies the exact 234-entry `generate_handler!` fixture. Build, `expect`, run, and Exit handling remain after registration and byte-for-byte equivalent.

`lib.rs::run` retains askpass short-circuiting, Wayland environment setup, CLI parsing, MCP mode, logger initialization, global log buffer initialization, the exact debug flag write, startup logs, and the point at which `app::run_desktop` is called. It delegates only the existing desktop builder sequence.

- [ ] **Step 1: Re-run the passing legacy setup characterization before target TDD**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app_setup_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
```

Expected: PASS against pre-extraction `lib.rs`; six plugins, 11 states, setup position/body ordering, 234 handlers, build/run, and Exit behavior are already characterized. These are legacy characterization tests and must never be made red to drive the extraction.

- [ ] **Step 2: Add the initially failing target-interface contract**

Extend `tauri_command_contract.rs` with a target-layout test that reads `src/app/mod.rs`, `plugins.rs`, `state.rs`, `setup.rs`, and `commands.rs`; asserts the four exact stage names and order; then applies the existing plugin/state/handler/setup fixtures to those files. Do not import crate-private stage functions from an integration test. Add canonical sibling `app/tests.rs` only after `app/mod.rs` exists; it declares `mod command_registration; mod setup; mod state;` exactly once, and `app/mod.rs` declares only `#[cfg(test)] mod tests;`. Do not create `app/tests/mod.rs` or retain a competing inline app test module.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract target_app_builder_stages_match_frozen_sequence
```

Expected: FAIL because the target app files/interfaces do not exist. The two legacy commands from Step 1 remain PASS.

- [ ] **Step 3: Move debug commands, plugins, and state registration unchanged**

Move `DEBUG_MODE`, `is_debug_mode`, `open_devtools`, and `close_devtools` to `app/debug.rs`. Move the six contiguous `.plugin(...)` calls to `plugins::attach_plugins` and the 11 contiguous `.manage(...)` calls to `state::manage_state`; preserve every expression and order. Keep `LOG_BUFFER` and `get_log_buffer()` in `lib.rs` because existing consumers use the crate-level accessor.

- [ ] **Step 4: Attach setup and register commands without reordering**

Move the single `.setup(move |app| { ... })` attachment to `setup::attach_setup`. Preserve closure order exactly: askpass handle; first persisted-config read/cache write capturing active external IDs; MySQL, PostgreSQL, and SQLite registration; second persisted-config read/cache write supplying plugin configs; enabled external plugin load; later health/maximize config reads at their current positions; health loop; approval watcher; heartbeat; maximize; debug devtools; explain-window creation followed by main-window close; `Ok(())`. This exact pre-Task-10 ordering is the baseline that Task 10's deferred provider must retain. Move the complete `generate_handler!` block to `commands::register_commands` without changing any of 234 entries or the duplicate `dump_commands::cancel_dump`.

- [ ] **Step 5: Reduce `lib.rs::run` to mode selection and exact desktop delegation**

Add `pub mod app;` and call `app::run_desktop(args, log_buffer)` at the current builder location. Do not move the askpass/Wayland/CLI/MCP/logger/debug/startup-log sequence. Keep `.build(...).expect(...).run(...)` and the Exit-only tunnel cleanup exactly as shown above.

- [ ] **Step 6: Run target and legacy app contracts**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app_setup_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
```

Expected: PASS; exact stage order, six plugins, 11 states, setup closure ordering, 234 handlers, build/run, and Exit behavior match the frozen pre-move baseline.

- [ ] **Step 7: Run the backend suite**

Run:

```bash
pnpm test:rust
```

Expected: PASS.

---

### Task 4: Split the oversized command module by exact command family

**Files:**
- Move: `apps/desktop/src-tauri/src/commands.rs` → `apps/desktop/src-tauri/src/commands/legacy.rs` and retain it through Tasks 5–6
- Create: all focused `apps/desktop/src-tauri/src/commands/*.rs` family files listed in the target structure
- Create: `apps/desktop/src-tauri/src/commands/tests/compatibility.rs`
- Create: `apps/desktop/src-tauri/src/commands/tests/context_forwarding.rs`
- Create: `apps/desktop/src-tauri/src/commands/tests/records.rs`
- Create: `apps/desktop/src-tauri/src/commands/tests/blobs.rs`
- Create: `apps/desktop/src-tauri/src/commands/tests/windows.rs`
- Create: `apps/desktop/src-tauri/src/commands/tests/connection_lifecycle.rs`
- Create: `apps/desktop/src-tauri/src/commands/tests/keybindings.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify: normalized `apps/desktop/src-tauri/src/commands/tests.rs` aggregator and command test modules under `apps/desktop/src-tauri/src/commands/tests/`

**Interfaces:**
- Consumes: all current `crate::commands::*` functions and helpers.
- Produces: the same paths through `commands/mod.rs` re-exports; no body rewrites in this task.

Move these exact command sets:

| File | Commands |
|---|---|
| `connection_store.rs` | `get_connection_by_id`, `save_connection`, `delete_connection`, `update_connection`, `set_connection_appearance`, `duplicate_connection`, `get_connections` |
| `ssh.rs` | `get_ssh_connections`, `save_ssh_connection`, `update_ssh_connection`, `delete_ssh_connection`, `test_ssh_connection` |
| `kubernetes.rs` | `get_k8s_connections`, `save_k8s_connection`, `update_k8s_connection`, `delete_k8s_connection`, `test_k8s_connection_cmd`, `get_k8s_contexts_cmd`, `get_k8s_namespaces_cmd`, `get_k8s_resources_cmd`, `get_k8s_resource_ports_cmd` |
| `connection_groups.rs` | `get_connection_groups`, `get_connections_with_groups`, `create_connection_group`, `create_group_path`, `update_connection_group`, `move_group_to_parent`, `delete_connection_group`, `move_connection_to_group`, `reorder_groups`, `reorder_connections_in_group` |
| `connection_transfer.rs` | `export_connections_payload`, `encrypt_export_payload`, `decrypt_export_payload`, `import_connections_payload` |
| `catalog.rs` | `get_schemas`, `get_available_databases`, `create_database`, `drop_database`, `rename_database`, `create_schema`, `truncate_table`, `drop_table`, `get_tables`, `get_columns`, `get_foreign_keys`, `get_indexes`, `get_schema_snapshot`, `get_ai_schema_context` |
| `routines.rs` | `get_routines`, `get_routine_parameters`, `get_routine_definition`, `build_routine_call_sql`, `get_routine_create_template`, `get_routine_edit_script`, `drop_routine` |
| `views.rs` | `get_views`, `get_view_definition`, `create_view`, `alter_view`, `drop_view`, `get_view_columns`, `get_materialized_views`, `get_materialized_view_columns`, `get_materialized_view_definition`, `refresh_materialized_view` |
| `triggers.rs` | `get_triggers`, `get_trigger_definition`, `create_trigger`, `drop_trigger` |
| `records.rs` | `delete_record`, `update_record`, `insert_record` |
| `blobs.rs` | `save_blob_to_file`, `fetch_blob_as_data_url`, `detect_blob_mime`, `load_blob_from_file`, `detect_mime_type`, `get_file_stats`, `read_file_as_data_url` |
| `queries.rs` | `cancel_query`, `execute_query`, `execute_query_batch`, `explain_query_plan`, `count_query` |
| `connection_lifecycle.rs` | `test_connection`, `list_databases`, `register_active_connection`, `get_active_connections`, `disconnect_connection`, `get_server_now` |
| `ddl.rs` | `get_create_table_sql`, `get_add_column_sql`, `get_alter_column_sql`, `get_create_index_sql`, `get_create_foreign_key_sql`, `drop_index_action`, `drop_foreign_key_action` |
| `drivers.rs` | `get_data_types`, `map_inferred_column_types`, `get_registered_drivers`, `get_driver_manifest` |
| `keybindings.rs` | `get_keybindings`, `save_keybindings` |
| `windows.rs` | `set_window_title`, `open_er_diagram_window` |

Keep each private helper with its only consumer. Keep shared cancellation, connection repository, and connection-resolution helpers in `legacy.rs` until Tasks 5 and 6 move them to their final owners. `legacy.rs` remains declared and selectively re-exported throughout Task 4 and Task 5; do not duplicate helpers across families and do not remove the file in Task 4.

- [ ] **Step 1: Write and pass the legacy compatibility import test**

Create a crate integration test with `#![allow(unused_imports)]` that imports the 106 public command names from `nexora_lib::commands::{...}` using the exact table above. Because `AbortHandleMap`, `register_abort_handle`, `unregister_abort_handle`, and `merge_groups` are currently `pub(crate)`, test those from the existing sibling unit-test boundary rather than importing them from an integration test. Integration-test imports are limited to genuinely public `QueryCancellationState`, `find_connection_by_id`, `resolve_connection_params`, `resolve_connection_params_with_id`, and `apply_export_payload`.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test command_module_compatibility
```

Expected: PASS against the current single-file `commands.rs`. This is a legacy compatibility gate, not a red target-interface test.

- [ ] **Step 2: Add the target family-ownership test**

Add a source-layout test that expects every family file in the table, checks each listed command has exactly one owner, and checks `commands/mod.rs` re-exports every family. Run it before the move.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test command_module_compatibility command_families_have_exact_single_owners
```

Expected: FAIL because the target family files do not exist; the legacy import test from Step 1 remains PASS.

- [ ] **Step 3: Convert `commands.rs` to a directory module without changing behavior**

Run `git mv apps/desktop/src-tauri/src/commands.rs apps/desktop/src-tauri/src/commands/legacy.rs`, create `commands/mod.rs`, declare `mod legacy;`, and temporarily `pub use legacy::*;`. Run the compatibility test; expected: PASS before family extraction.

- [ ] **Step 4: Move one command family at a time**

For each table row, move the complete command functions and exclusively used helpers, add `pub use self::<family>::*;`, and leave every helper shared across families or consumed by Tasks 5–6 in declared `legacy.rs`. Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
```

Expected after every family: PASS. Do not proceed to the next family on failure.

- [ ] **Step 5: Move normalized tests beside their owning family and establish every Task 13 legacy gate**

Move existing tests without changing assertions. Group-tree helpers go under `commands/tests/connection_groups.rs`; credential resolution under `commands/tests/ssh.rs` and `connection_store.rs`; query sanitation/cancellation under `commands/tests/queries.rs`; export payload merge tests under `commands/tests/connection_transfer.rs`.

Before any Task 13 service extraction, add pre-service command-owner characterization in `commands/tests/records.rs`, `commands/tests/blobs.rs`, `commands/tests/windows.rs`, and `commands/tests/connection_lifecycle.rs`. Record tests cover exact resolver/driver arguments and returned errors for delete/update/insert; BLOB wire parsing, file-size rejection, MIME/data-URL behavior, and driver arguments; window title, ER URL/title/label sanitation, dimensions, existing-window focus, and build errors; and the exact `get_server_now` branch SQL, execute arguments, result conversion, and error. Use `#[cfg(test)]` fake seams in the command family where a Tauri handle/window cannot be constructed; the seams remain command-owner tests and do not import proposed domain services. Retain the existing query characterization in `commands/tests/queries.rs`, extending it to freeze count-wrapper SQL, execute arguments, conversion, and errors before Task 13.

Keep `commands/tests.rs` as the normalized aggregator and declare each child exactly once:

```rust
mod blobs;
mod compatibility;
mod connection_groups;
mod connection_lifecycle;
mod connection_store;
mod connection_transfer;
mod context_forwarding;
mod export_import;
mod group_tree;
mod keybindings;
mod queries;
mod records;
mod ssh;
mod windows;
```

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::keybindings -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::keybindings
```

Expected: each `--list` command reports at least one leaf test and each filter PASS against the pre-service command owner. Record all six nonzero counts; queries, records, blobs, windows, and connection lifecycle are mandatory Task 13 pre-service baselines, while keybindings is the mandatory Task 11 pre-storage baseline. Zero tests is a failure.

- [ ] **Step 6: Ratchet retained `legacy.rs` to helpers only**

Assert `legacy.rs` contains no `#[tauri::command]` functions after all 106 commands move, but still owns the shared cancellation and connection lookup/resolution helpers required by Tasks 5–6. Keep `mod legacy;` and only the compatibility re-exports needed to preserve current paths. Task 5 removes cancellation items from it; Task 6 removes repository/resolution items and deletes `legacy.rs` only after the file is empty.

- [ ] **Step 7: Verify command split with the helper owner retained**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::keybindings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test command_module_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
pnpm test:rust
```

Expected: all PASS; all six named command-family filters execute their recorded nonzero counts, including queries, records, blobs, windows, connection lifecycle, and keybindings; handler and Rust import paths remain unchanged; and `commands/legacy.rs` remains declared, contains no Tauri commands, and retains only helpers awaiting Tasks 5–6.

---

### Task 5: Extract shared cancellation without changing state ownership

**Files:**
- Create: `apps/desktop/src-tauri/src/infrastructure/mod.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/cancellation/mod.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/cancellation/tests.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify: `apps/desktop/src-tauri/src/commands/legacy.rs`
- Modify: `apps/desktop/src-tauri/src/commands/queries.rs`
- Modify: `apps/desktop/src-tauri/src/export.rs`
- Modify: `apps/desktop/src-tauri/src/dump_commands.rs`

**Interfaces:**
- Consumes: existing `AbortHandleMap`, `register_abort_handle`, and `unregister_abort_handle` semantics.
- Produces: the stable cancellation interface defined above and compatibility exports through `crate::commands`.

- [ ] **Step 1: Confirm the legacy cancellation characterization remains green**

The pre-move legacy tests from Task 1 cover multiple live handles in one slot; pruning finished handles on registration; identity-based unregister; empty-slot removal; aborting every handle; absent-slot behavior; separate dump/import keys; and query/explain sharing a connection slot.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml cancellation_legacy
```

Expected: PASS against current `commands.rs`, `export.rs`, and `dump_commands.rs`.

- [ ] **Step 2: Write the target cancellation-interface test**

Add sibling target-module tests for the same cases through `infrastructure::cancellation::{AbortHandleMap, register_abort_handle, unregister_abort_handle, abort_slot}`.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::cancellation
```

Expected: FAIL because the target interface does not exist; `cancellation_legacy` remains PASS.

- [ ] **Step 3: Move the map and helpers unchanged**

Move `AbortHandleMap`, `register_abort_handle`, and `unregister_abort_handle` from retained `commands/legacy.rs` and implement `abort_slot` beside them. Remove only those moved items from `legacy.rs`; keep the file and its Task 6 connection helpers declared. `abort_slot` only removes and returns handles; callers preserve their existing distinct error strings and decide whether an empty result is an error.

- [ ] **Step 4: Re-export through `commands/mod.rs`**

Keep `crate::commands::AbortHandleMap`, `register_abort_handle`, and `unregister_abort_handle` compiling. Do not move `QueryCancellationState`, `ExportCancellationState`, or `DumpCancellationState`; their managed-state ownership remains unchanged.

- [ ] **Step 5: Route query, export, dump, and import through the shared helper**

Replace only duplicated lock/remove loops with `abort_slot`. Preserve:

```text
cancel_query absent slot       -> "No running query found"
cancel_export absent slot      -> Ok(())
cancel_dump absent slot        -> "No active dump process found"
cancel_import absent slot      -> "No active import process found"
query task cancellation        -> "Query cancelled"
explain task cancellation      -> "Explain query cancelled"
export task cancellation       -> "Export cancelled"
dump task cancellation         -> "Dump cancelled"
import task cancellation       -> "Import cancelled"
```

- [ ] **Step 6: Verify cancellation**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml cancellation
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump
pnpm test:rust
```

Expected: PASS.

---

### Task 6: Extract connection lookup and resolution behind an explicit context

**Files:**
- Create: `apps/desktop/src-tauri/src/domains/mod.rs`
- Create: `apps/desktop/src-tauri/src/domains/connections/mod.rs`
- Create: `apps/desktop/src-tauri/src/domains/connections/context.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/connections/mod.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/connections/repository.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/connections/resolution.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/connections/tests.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify/delete when empty: `apps/desktop/src-tauri/src/commands/legacy.rs`
- Modify: all command families that currently repeat lookup/SSH/Kubernetes/database override/driver resolution
- Modify: `apps/desktop/src-tauri/src/export.rs`
- Modify: `apps/desktop/src-tauri/src/dump_commands.rs`
- Modify: `apps/desktop/src-tauri/src/health_check.rs`
- Modify: `apps/desktop/src-tauri/src/clipboard_import.rs` in place; do not move it

**Interfaces:**
- Consumes: saved connection persistence/cache, credential cache, SSH/Kubernetes saved references and tunnel caches, driver registry.
- Produces: `DatabaseContext`, `ResolvedConnection`, `ConnectionContextResolver`, and `TauriConnectionContextResolver<R>`.

```rust
pub struct TauriConnectionContextResolver<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
}

impl<R: tauri::Runtime> TauriConnectionContextResolver<R> {
    pub fn new(app: tauri::AppHandle<R>) -> Self;
}
```

- [ ] **Step 1: Confirm legacy resolution/context characterization remains green**

Run the pre-move tests against current lookup, SSH/Kubernetes expansion, database override, and command owners. Because the resolver will touch the legacy transfer and health owners, also run their complete Task 1 gates before editing them:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_resolution_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml context_forwarding_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml health_check::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml clipboard_import::tests
```

Expected: every filter executes at least one test and PASS before any resolver or command-owner move; clipboard import's current tuple and full create/fail/append/replace workflow are green before its owner is modified.

- [ ] **Step 2: Write target resolution tests with fakes**

Use a fake resolver in `commands/tests/context_forwarding.rs` to capture each representative command's exact current tuple. For a record/table command that currently accepts all four fields:

```rust
DatabaseContext {
    connection_id: "conn-2",
    database: Some("analytics"),
    schema: Some("reporting"),
    table: Some("monthly_sales"),
}
```

For commands that currently omit a field, assert that field is `None` and do not add it to the Tauri signature. Examples from the current paths: query export carries `connection_id` and optional `database` but no `schema`/`table`; dump carries `connection_id`, optional `database`, and optional `schema` but no single `table`; import carries `connection_id` and optional `schema` but no `database`/`table`; clipboard import carries `connection_id`, optional `schema`, and `table_name` but no `database`. Cover catalog metadata, record mutation, query execution, export, dump/import, clipboard import, and a stale previous database case. Assert a selected explicit database is forwarded only on paths that already carry it, never replaced by the saved primary database or inferred from schema.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml context_forwarding
```

Expected: FAIL because the target context/resolver interfaces do not exist; every legacy characterization filter from Step 1 remains PASS.

- [ ] **Step 3: Move existing persistence lookup helpers unchanged**

Move `get_config_path`, `get_ssh_config_path`, `find_connection_by_id`, and cache invalidation helpers from `commands/legacy.rs` to `infrastructure/connections/repository.rs`. The actual owner is `repository.rs`: re-export `find_connection_by_id` through `infrastructure/connections/mod.rs` as needed and through `commands/mod.rs` with `pub use crate::infrastructure::connections::repository::find_connection_by_id;`; never re-export it from `resolution.rs`. Preserve its public signature and `nexora_lib::commands::find_connection_by_id` compatibility path.

- [ ] **Step 4: Move tunnel expansion and parameter resolution unchanged**

Move `expand_ssh_connection_params`, `expand_k8s_connection_params`, `resolve_connection_params`, `resolve_connection_params_with_id`, and their exclusive helpers from `commands/legacy.rs` to `resolution.rs`. Preserve mutual-exclusion errors, default ports, tunnel keys, keychain lookup order, and tunnel reuse behavior. After Steps 3–4, assert `legacy.rs` is empty, then remove it and `mod legacy;`; this is the first task allowed to delete it.

- [ ] **Step 5: Add the explicit resolver adapter**

Implement `ConnectionContextResolver` for `TauriConnectionContextResolver`. Do not use `schema` or `table` to modify parameters. Apply only `context.database` through `apply_database_override`.

- [ ] **Step 6: Route one family at a time through the resolver**

Start with read-only catalog commands, then query commands, then records/blobs, export/dump, health, `clipboard_import.rs`, and finally mutation commands. Explicitly modify `clipboard_import.rs` in place to construct its exact current `DatabaseContext` (`connection_id`, `database: None`, optional `schema`, `table: Some(table_name.as_str())`), call the resolver once, and then continue its existing compatibility workflow unchanged; do not move it, add a `database` argument, alter its tuple, reorder create/fail/append/replace operations, or rewrite its SQL/driver calls. Preserve operation-specific sequences that intentionally differ; do not force `test_connection` or ad-hoc `list_databases` through saved-connection lookup when `connection_id` is absent.

- [ ] **Step 7: Verify resolution and compatibility**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::connections
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml context_forwarding
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml health_check::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml clipboard_import::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp
pnpm test:rust
```

Expected: PASS; exact context tuples and old `crate::commands::*` helper paths remain valid, `clipboard_import.rs` remains the compatibility owner with unchanged command signature/result/branching/SQL but resolves through the shared adapter, and now-empty `commands/legacy.rs` is removed only here.

---

### Task 7: Modularize pool management behind the existing `pool_manager` API

**Files:**
- Move: `apps/desktop/src-tauri/src/pool_manager.rs` → `apps/desktop/src-tauri/src/infrastructure/pools/mod.rs`
- Create: `apps/desktop/src-tauri/src/pool_manager.rs`
- Create: pool sibling files and tests listed in the target structure
- Move: normalized pool tests → `apps/desktop/src-tauri/src/infrastructure/pools/tests/`
- Create: `apps/desktop/src-tauri/tests/pool_manager_compatibility.rs`

**Interfaces:**
- Consumes: `ConnectionParams`, cached config, sqlx/deadpool/rustls.
- Produces: unchanged `crate::pool_manager::*` and external `nexora_lib::pool_manager::*` functions and focused pool internals; the root module is a preserved public-API facade, not a locally removable shim.

The compatibility test must import and exercise the existing public API:

```rust
use nexora_lib::pool_manager::{
    close_all_pools, close_pool, close_pool_with_id, get_mysql_pool,
    get_mysql_pool_for_database, get_mysql_pool_with_id, get_postgres_pool,
    get_postgres_pool_with_id, get_sqlite_pool, get_sqlite_pool_with_id,
    has_pool, has_pool_for_database,
};
```

Crate-visible compatibility also preserves `build_connection_key`, `build_mysql_options`, `build_postgres_configurations`, `build_postgres_tls_connector`, `format_error_chain`, `is_pipes_as_concat_unsupported`, and `load_roots_from_pem` for current internal consumers and tests.

- [ ] **Step 1: Write and pass the legacy public compatibility test**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test pool_manager_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml pool_manager
```

Expected: PASS against current `pool_manager.rs`. The integration test imports only the public API shown above; crate-visible helpers are covered by sibling unit tests.

- [ ] **Step 2: Add the initially failing target pool-layout test**

Add a source-layout test for the target shim and focused modules, then run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test pool_manager_compatibility target_pool_modules_exist
```

Expected: FAIL because the target modules/shim do not exist; both legacy commands from Step 1 remain PASS.

- [ ] **Step 3: Move the monolith and install the shim**

Use `git mv` to place the unchanged module at `infrastructure/pools/mod.rs`, declare `pub mod infrastructure`, and create root `pool_manager.rs` containing `pub use crate::infrastructure::pools::*;`. Classify that facade in policy/docs as preserved `nexora_lib::pool_manager` public API with no local-consumer auto-removal condition.

Run the full pool test filter; expected: PASS before splitting internals.

- [ ] **Step 4: Extract pool key and registry state**

Move key hashing/normalization to `key.rs`; move `MYSQL_POOLS`, `POSTGRES_POOLS`, `SQLITE_POOLS`, `has_pool*`, `close_pool*`, and `close_all_pools` to `registry.rs`. Preserve exact key inputs, maintenance-database normalization, startup-script hashing, and lock scopes.

- [ ] **Step 5: Extract startup scripts and TLS**

Move startup-script normalization/preflight/hook helpers to `startup_script.rs`. Move certificate verifiers, root loading, and PostgreSQL TLS connector construction to `tls.rs`. Preserve all exact error prefixes, verification modes, and fallback behavior.

- [ ] **Step 6: Extract engine pool constructors**

Move MySQL option/pool/fallback logic to `mysql.rs`, deadpool PostgreSQL construction to `postgres.rs`, and SQLite options/pool construction to `sqlite.rs`. Do not change pool sizes, acquire timeouts, connection hooks, SSL mappings, or SQL.

- [ ] **Step 7: Verify each focused suite**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::pools::tests::key
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::pools::tests::mysql
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::pools::tests::postgres
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::pools::tests::startup_script
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test pool_manager_compatibility
pnpm test:rust
```

Expected: PASS. SQLite startup-script tests must still prove execution on each new physical connection, blank-script skipping, and attributed invalid-script errors.

---

### Task 8: Separate plugin process transport from the RPC driver adapter

**Files:**
- Move: `apps/desktop/src-tauri/src/plugins/driver.rs` → `apps/desktop/src-tauri/src/plugins/rpc_driver.rs`
- Create: `apps/desktop/src-tauri/src/plugins/process.rs`
- Create: `apps/desktop/src-tauri/src/plugins/driver.rs`
- Modify: `apps/desktop/src-tauri/src/plugins/mod.rs`
- Modify: `apps/desktop/src-tauri/src/plugins/manager.rs`
- Modify: `apps/desktop/src-tauri/src/plugins/tests.rs` as the canonical aggregator
- Move: normalized tests → `apps/desktop/src-tauri/src/plugins/tests/process.rs` and `rpc_driver.rs`
- Create/retain: `apps/desktop/src-tauri/src/plugins/tests/manifest.rs` for current manifest/installer/registry tests and later manifest-contract additions
- Create: `apps/desktop/src-tauri/tests/plugin_driver_compatibility.rs`

**Interfaces:**
- Consumes: `JsonRpcRequest`, `JsonRpcResponse`, plugin executable/interpreter, `PluginManifest`, `DatabaseDriver`.
- Produces: `PluginProcess` transport and `RpcDriver` adapter, still available at `plugins::driver::*`.

`process.rs` owns `PluginCommand`, child spawning, stdin/stdout framing, pending request routing, cancellation cleanup, shutdown, PID, and timeout enforcement. `rpc_driver.rs` owns manifest/data types, initialization, `DatabaseDriver`, serde conversion, optional-method fallback, and no process I/O loop.

- [ ] **Step 1: Write and pass legacy transport/adapter characterization tests**

In the current `plugins/driver.rs` sibling test boundary, cover monotonically increasing IDs, one JSON request per newline, success/error routing, pending-entry removal on timeout, channel-closed errors, kill-on-drop/shutdown signaling, 120-second default and 15-second initialize constants through test-visible accessors. Cover exact method names and parameter keys for every existing RPC method represented in current tests. Preserve `plugins/tests.rs` as the sole `#[cfg(test)] mod tests;` target and canonical aggregator: move its existing manifest/installer/registry cases to `tests/manifest.rs`, then declare `mod manifest; mod process; mod rpc_driver;` exactly once. Do not replace it with `plugins/tests/mod.rs`; this keeps the canonical slot where later `manifest.rs` coverage is extended.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test plugin_driver_compatibility
```

Expected: PASS against current `plugins/driver.rs` and its current public paths.

- [ ] **Step 2: Add the initially failing target separation test**

Add source-layout tests requiring `process.rs`, `rpc_driver.rs`, and compatibility-only `driver.rs`, plus forbidden-dependency assertions for each target. Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test plugin_driver_compatibility target_plugin_transport_and_adapter_are_separate
```

Expected: FAIL because target files do not exist; both legacy filters from Step 1 remain PASS.

- [ ] **Step 3: Move `RpcDriver` as a history-preserving file move**

Use `git mv`, then extract lines belonging to `PluginProcess` into `process.rs`. Keep `JsonRpcRequest`/`JsonRpcResponse` in `rpc.rs` unchanged.

- [ ] **Step 4: Add compatibility re-exports**

Create `plugins/driver.rs` with the compatibility exports shown above. Update manager construction to use `plugins::rpc_driver::RpcDriver` internally while keeping old imports valid. Keep `plugins/mod.rs` declaring `#[cfg(test)] mod tests;`; `plugins/tests.rs` remains the aggregator for `manifest`, `process`, and `rpc_driver`.

- [ ] **Step 5: Preserve optional fallback behavior exactly**

Keep method-not-found detection case-insensitive for `"method not found"` and matching `"-32601"`. Preserve the existing `ping` fallback for `"Method not found"` or `"not implemented"`, routine fallbacks, AI schema fallback, and audit-visible error strings.

- [ ] **Step 6: Verify plugin contracts**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test plugin_driver_compatibility
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm test:rust
```

Expected: all PASS; no manifest, RPC method, error, timeout, or response-shape change.

---

### Task 9: Modularize configuration storage and Tauri adapters

**Files:**
- Move: `apps/desktop/src-tauri/src/config.rs` → `apps/desktop/src-tauri/src/infrastructure/config/mod.rs`
- Create: `apps/desktop/src-tauri/src/config.rs`
- Create: `apps/desktop/src-tauri/src/commands/config.rs`
- Create: focused config files and tests listed in the target structure
- Move: normalized config tests → `apps/desktop/src-tauri/src/infrastructure/config/tests/`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs` to declare and re-export `config`
- Create: `apps/desktop/src-tauri/tests/config_compatibility.rs`

**Interfaces:**
- Consumes: filesystem paths, keychain/credential cache, health restart, Tauri restart.
- Produces: unchanged `AppConfig`, `PluginConfig`, `AiKeyStatus`, constants, helper functions, and command names through `crate::config::*`.

- [ ] **Step 1: Write and pass legacy config characterization tests**

Against current `config.rs`, cover camelCase field names, absent-field defaults, ignored legacy fields, partial `save_config` merge semantics for every `Option` field, cache write-through, exact default constants, selected schema removal on empty vector, keychain-before-env AI key precedence, prompt filenames/defaults, JSON validation error prefix, and ping-loop restart only when the interval changes.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml config::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test config_compatibility
```

Expected: PASS against current `config.rs` and current public exports.

- [ ] **Step 2: Add the initially failing target config-interface tests**

Add sibling target tests for the focused config modules and source-layout assertions for the root shim. Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::config
```

Expected: FAIL because the target module does not exist; both legacy filters from Step 1 remain PASS.

- [ ] **Step 3: Move models and store without changing serde behavior**

Move `AppConfig`, `PluginConfig`, `AiKeyStatus`, constants, `CONFIG_CACHE`, load/cache/save logic to `model.rs` and `store.rs`. Do not reorder merge checks or change defaults.

- [ ] **Step 4: Move key and prompt mechanisms**

Move AI key resolution/status functions to `ai_keys.rs`; move prompt defaults and file operations to `prompts.rs`. Preserve exact provider-to-environment mappings and prompt text.

- [ ] **Step 5: Make config commands adapters**

Place all `#[tauri::command]` functions in `commands/config.rs`; each calls the corresponding infrastructure function and performs only AppHandle/state extraction. Declare `pub mod config;` in `commands/mod.rs` and add `pub use self::config::*;` alongside the other family exports. Root `config.rs` re-exports commands and infrastructure APIs so AI, updater, plugins, MCP, query history, pools, tests, and external `nexora_lib::config` consumers keep compiling.

- [ ] **Step 6: Verify config**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml config
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test config_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
pnpm test:rust
```

Expected: PASS with unchanged serialized JSON and command registration.

---

### Task 10: Share driver bootstrap, then split MCP transport, routing, resolution, tools, approvals, and audit

**Files:**
- Create: `apps/desktop/src-tauri/src/drivers/bootstrap.rs`
- Modify: `apps/desktop/src-tauri/src/app/setup.rs`
- Modify: `apps/desktop/src-tauri/src/drivers/mod.rs` or existing inline driver module declaration in `lib.rs`
- Move/split: `apps/desktop/src-tauri/src/mcp/mod.rs`
- Create: `apps/desktop/src-tauri/src/mcp/server.rs`
- Create: `apps/desktop/src-tauri/src/mcp/router.rs`
- Create: `apps/desktop/src-tauri/src/mcp/connections.rs`
- Create: `apps/desktop/src-tauri/src/mcp/resources.rs`
- Create: `apps/desktop/src-tauri/src/mcp/audit.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tools/mod.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tools/list.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tools/describe.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tools/query.rs`
- Move: `apps/desktop/src-tauri/src/mcp/tests.rs` → `apps/desktop/src-tauri/src/mcp/tests/router.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tests/mod.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tests/protocol.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tests/audit.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tests/query_approval.rs`
- Create: `apps/desktop/src-tauri/src/mcp/tests/target_interfaces.rs`

**Interfaces:**
- Consumes: MCP protocol structs, config, connection resolution, driver registry, plugin loader, heartbeat, approval and activity stores.
- Produces: unchanged `pub async fn run_mcp_server()` through `mcp/mod.rs` and shared `drivers::bootstrap::register_all_drivers(load_external_driver_config)` used by desktop and MCP.

```rust
pub async fn register_all_drivers<F>(load_external_driver_config: F)
where
    F: FnOnce() -> (
        std::collections::HashMap<String, crate::config::PluginConfig>,
        Option<Vec<String>>,
    ),
{
    crate::drivers::registry::register_driver(crate::drivers::mysql::MysqlDriver::new()).await;
    crate::drivers::registry::register_driver(crate::drivers::postgres::PostgresDriver::new()).await;
    crate::drivers::registry::register_driver(crate::drivers::sqlite::SqliteDriver::new()).await;
    let (plugin_configs, enabled_ids) = load_external_driver_config();
    crate::plugins::manager::load_plugins_with_configs(plugin_configs, enabled_ids.as_deref()).await;
}
```

The provider is deliberately synchronous and invoked exactly once only after all three built-ins are registered. It defers configuration acquisition without moving it across the desktop/MCP ownership boundary.

Desktop preserves its two bootstrap-related `load_config_internal(&app.handle())` calls and their cache writes in exact order: the setup closure first reads and stores `active_external_drivers`; shared bootstrap then registers MySQL, PostgreSQL, and SQLite; only then its provider performs the second internal-config read/cache write and returns that read's `plugins.unwrap_or_default()` together with the already captured active IDs; external plugins load last. Do not collapse these reads, source active IDs from the second read, or move either cache write. The later health-loop and maximize config reads/cache writes remain after plugin loading at their existing setup positions.

MCP passes a provider that calls startup `load_config_from_disk()` exactly once after SQLite registration, then returns that snapshot's `plugins.unwrap_or_default()` and `active_external_drivers`; the stdin loop starts only after enabled external plugins finish loading. `load_config_from_disk()` remains non-caching. Only built-in registration is shared before the provider: do not eagerly load startup MCP config before built-ins or change startup timing/error handling.

- [ ] **Step 1: Confirm passing legacy MCP/bootstrap characterization**

Add/retain source and fake-registry tests against the current desktop and MCP owners for built-in order, plugin-last order, enabled-ID forwarding, and bootstrap-before-request-loop behavior. The desktop test records exactly two bootstrap-related internal-config reads/cache writes around registration: active-ID read before MySQL and plugin-config read after SQLite but before plugin loading; it also asserts later health/maximize reads remain after plugin loading. The MCP test records no startup disk-config read before the three built-ins, exactly one non-caching startup disk read after SQLite, and external plugins before the request loop.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml driver_bootstrap_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp
```

Expected: PASS before creating `drivers/bootstrap.rs`; these are legacy characterization tests.

- [ ] **Step 2: Add initially failing target bootstrap and MCP interface tests**

Add sibling target tests for deferred-provider `register_all_drivers` and target MCP module ownership. Bootstrap tests assert the provider is called exactly once after MySQL/PostgreSQL/SQLite and before plugin loading, desktop still records its first internal read before bootstrap and second internal read/cache write inside the provider, and MCP performs its only disk read inside the provider. Cover notifications returning no response; unknown method `-32601`; missing params/arguments/fields `-32602`; domain failures `-32000`; initialize protocol version/server info; exact tool schemas; resource URI and MIME shapes; connection ID-or-case-insensitive-name lookup; read-only fail-closed behavior; heartbeat fast failure; preflight best-effort behavior; approval denial/timeout/edited-query reclassification; and audit mutation before final append.

Create `mcp/tests/mod.rs` as the valid `#[cfg(test)] mod tests;` entry and declare every child exactly once:

```rust
mod audit;
mod protocol;
mod query_approval;
mod router;
mod target_interfaces;
```

Place target layout/ownership compile checks in `mcp/tests/target_interfaces.rs`; do not leave a directory-only `mcp/tests/` without `mod.rs`, and do not retain a competing `mcp/tests.rs` after the move.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::bootstrap
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::target_interfaces
```

Expected: both target filters execute at least one test and FAIL because target modules/interfaces do not exist; both legacy filters from Step 1 remain PASS. Zero tests is a failure.

- [ ] **Step 3: Extract the shared driver bootstrap**

Implement the deferred-provider `register_all_drivers` exactly as shown. Desktop captures active IDs with its existing first internal-config read before calling bootstrap; its provider performs the existing second internal-config read after built-ins and returns plugin configs plus the captured IDs. MCP's provider performs its existing single disk read after built-ins and returns both fields from that snapshot. Re-run `driver_bootstrap_legacy`; expected: PASS with one shared built-in registration sequence, unchanged read/cache-write order and counts, plugin loading last, and no registry reset or capability change.

- [ ] **Step 4: Extract server and router**

Move stdin/stdout newline framing and broken-pipe handling to `server.rs`. Move `handle_request`, initialize, and method dispatch to `router.rs`. Keep stdout JSON-only and all diagnostics on stderr.

- [ ] **Step 5: Extract MCP connection resolution**

Move disk lookup, DB credential loading, SSH/Kubernetes expansion, tunnel resolution, and driver resolution to `connections.rs`. Driver registration now remains in shared `drivers::bootstrap` and is called once by `run_mcp_server` before the request loop. Preserve JSON-RPC conversion codes/messages and the exact expansion order.

- [ ] **Step 6: Extract resources and tools**

Move resource handlers to `resources.rs`; move list, describe, and query tools to focused files. Preserve default PostgreSQL schema behavior, concurrent describe calls, row limits, returned JSON text, and query execution parameters.

- [ ] **Step 7: Extract audit and approval orchestration**

Move `CallAudit` and `emit_audit` to `audit.rs`. Keep status/error mutation order exactly: dispatch mutates audit, result fallback fills status/error, append happens once after dispatch. Keep approval polling at 500ms and configured timeout unchanged.

- [ ] **Step 8: Reduce `mcp/mod.rs` to declarations and exports**

```rust
pub mod install;
pub mod preflight;
pub mod protocol;
mod audit;
mod connections;
mod resources;
mod router;
mod server;
mod tools;

pub use server::run_mcp_server;

#[cfg(test)]
mod tests;
```

This declaration resolves to `mcp/tests/mod.rs`, whose five declarations are shown in Step 2. `mcp/tests.rs` must be absent after its contents move to `tests/router.rs`.

- [ ] **Step 9: Verify MCP behavior**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::bootstrap -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::router -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::protocol -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::audit -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::query_approval -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::target_interfaces -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml drivers::bootstrap
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml driver_bootstrap_legacy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app::tests
pnpm test:rust
```

Expected: every listed bootstrap/MCP filter reports at least one leaf test and every command PASS; `mcp/tests/mod.rs` loads router, protocol, audit, query-approval, and target-interface suites exactly once. Desktop preserves two bootstrap-related internal reads/cache writes around built-in registration plus later health/maximize reads at their existing positions; MCP preserves one post-built-in non-caching startup disk read; both share one MySQL-then-PostgreSQL-then-SQLite sequence followed by external plugins. JSON-RPC methods, codes, response shapes, fallback behavior, and audit ordering match baseline.

---

### Task 11: Modularize engine-neutral transfer helpers and health; retain legacy transfer owners

**Files:**
- Modify: `apps/desktop/src-tauri/src/export.rs` only to re-export moved neutral helper modules and retain all current commands/state/driver dispatch
- Modify: `apps/desktop/src-tauri/src/dump_commands.rs` only to call moved neutral reader/value helpers and retain all current commands/state/workflows
- Do not move: `apps/desktop/src-tauri/src/clipboard_import.rs`
- Move/split: `apps/desktop/src-tauri/src/health_check.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/import_export/{mod.rs,format.rs,progress.rs,sink.rs,sql_reader.rs,tests.rs}` and child suites under `infrastructure/import_export/tests/`
- Create: `apps/desktop/src-tauri/src/infrastructure/keybindings/{mod.rs,tests.rs}`
- Modify: `apps/desktop/src-tauri/src/commands/keybindings.rs` and `apps/desktop/src-tauri/src/commands/tests/keybindings.rs`
- Create: `apps/desktop/src-tauri/src/infrastructure/health/{mod.rs,active.rs,events.rs,ping.rs,tests.rs}`
- Recreate: `apps/desktop/src-tauri/src/health_check.rs` as the complete preserved compatibility re-export facade listed above
- Modify: normalized sibling tests for export, dump/import, health, clipboard import, connection-import commands, and keybindings
- Modify: `architecture/policy.json` and `tests/repository/architecture.test.ts` only to add the temporary legacy-transfer allowlist needed by this task

**Interfaces:**
- Consumes: passing legacy characterization gates from Task 1, cancellation registry, current resolver, current driver registry/pools, filesystem, and Tauri emitter.
- Produces: engine-neutral format/sink/progress/reader helpers; characterized keybinding JSON storage behind thin commands; unchanged health APIs; and unchanged legacy transfer command/state/workflow owners.

There is deliberately no `domains::import_export`, no generic dump/import/export service, and no new transfer capability in this task. Repository inspection shows:

```text
export.rs             branches on mysql/postgres/sqlite, directly calls built-in streamers,
                      and separately paginates external DatabaseDriver::execute_query
dump_commands.rs      branches on driver names, uses direct pools/extractors, and constructs
                      engine-specific dump/import SQL and transaction settings
clipboard_import.rs   constructs SQL above DatabaseDriver and has no database argument
DatabaseDriver        has no semantic export/dump/import/clipboard-transfer operations
```

Moving those workflows into a domain or generic infrastructure module would bless the wrong ownership and bypass the driver abstraction. Keep `ExportCancellationState`, `export_query_to_file`, `cancel_export`, `DumpOptions`, `DumpCancellationState`, `ImportProgress`, `dump_database`, `cancel_dump`, `import_database`, `cancel_import`, and `execute_clipboard_import` in their current root owners. Keep their exact context fields; do not add missing `database`, `schema`, or `table` arguments.

- [ ] **Step 1: Re-run every passing legacy workflow characterization gate**

Run before creating target modules:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml health_check::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml clipboard_import::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::keybindings
```

Expected: every filter executes at least one test and PASS against current owners, including success/error/cancellation/event-order coverage from Task 1. The keybinding suite characterizes missing-file `{}`, exact JSON round-trip, pretty serialization, directory creation, malformed-JSON/read/write errors, and the `keybindings.json` filename before storage moves. These tests stay green throughout Task 11.

- [ ] **Step 2: Add initially failing target-interface tests for neutral helpers, keybinding storage, and health only**

Add sibling tests that reference only these target interfaces:

```rust
crate::infrastructure::import_export::{
    parse_csv_delimiter, value_to_csv_string, CsvSink, ExportFormat, JsonSink,
    ProgressEmitter, RowSink, SqlStatementStream, create_sql_reader,
};
crate::infrastructure::health::{
    active_connections, emit_active_changed, register_connection, restart_ping_loop,
    start_ping_loop, stop_ping_loop, unregister_connection,
    ACTIVE_CONNECTIONS_CHANGED_EVENT, DEFAULT_PING_INTERVAL,
};
crate::infrastructure::keybindings::{load_keybindings, save_keybindings};
```

`SqlStatementStream` and `create_sql_reader` are `pub(crate)`, because no external consumer currently exists. Keybinding storage accepts an explicit config directory/path so its missing-file, parse, serialization, directory-creation, and I/O behavior is testable without Tauri; `commands/keybindings.rs` retains the same two command signatures and only resolves the app config directory before calling one storage function. Health private loop helpers remain private; place tests in `infrastructure/health/tests.rs` so Rust child-module visibility can exercise `ping_all_connections`, `ping_single_connection`, timeout, failure count, and event ordering. Do not create integration tests that import private constants or functions.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::import_export
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::keybindings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::health
```

Expected: all three target filters execute at least one test and FAIL because their modules/interfaces do not exist; every legacy filter from Step 1 remains PASS. Zero tests is a failure.

- [ ] **Step 3: Move only engine-neutral format, sink, progress, and reader helpers**

Use history-preserving moves for current `export/{format.rs,progress.rs,sink.rs}`. Move `SqlStatementStream`, `create_sql_reader`, and value escaping only after their pre-move assertions pass. Preserve CSV/JSON bytes, delimiter parsing, progress intervals/final emission, comment/empty-line handling, semicolon behavior, 128 KiB regular-file buffering, first `.sql` ZIP selection, ZIP errors, and exact value escaping. Re-export the current public export helper surface through root `export.rs`; keep new reader helpers crate-private.

Do not move `run_export`, `stream_to_sink`, `stream_query_via_plugin`, dump table enumeration/DDL/data streaming, import transaction setup/execution, event emission, cancellation registration, or clipboard SQL. Their exact branches, direct pools, SQL, and error strings remain in the allowlisted owners.

Keep `infrastructure/import_export/tests.rs` as the sole aggregator declared by `#[cfg(test)] mod tests;` in `import_export/mod.rs`; it declares `mod format; mod progress; mod sink; mod sql_reader;` exactly once for the four children under `import_export/tests/`. Do not create a competing `tests/mod.rs` or mix direct tests into `mod.rs`.

- [ ] **Step 4: Extract characterized keybinding storage and split health**

Move keybinding file/path, missing-file empty-object, read/parse, pretty-serialize, directory-create, and write behavior to `infrastructure/keybindings/mod.rs`. Keep `get_keybindings` and `save_keybindings` in `commands/keybindings.rs` with unchanged Tauri names/signatures/results, but make each a thin adapter that resolves `app_config_dir` and calls exactly one storage operation. Re-run both keybinding suites; expected: PASS. This extraction is required before Task 13's recursive command guard and must not be deferred.

Then move active-set identity and operations to `health/active.rs`, public event constant/emission to `events.rs`, and stop/restart/ping/failure orchestration to `ping.rs`. Preserve the one global active set and stop sender, immediate first `tokio::time::interval` tick, interval-zero disable behavior, concurrent `join_all`, no-new-built-in-pool check for exactly `mysql|postgres|sqlite`, driver ping, five-second timeout, threshold two, success reset, and failure sequence `unregister -> best-effort close -> connection-health-failed -> connections:active-changed`.

Root `health_check.rs` re-exports exactly the nine current public items listed in Preserved compatibility facades and re-exports. `FAILURE_THRESHOLD`, `PING_TIMEOUT`, `ping_all_connections`, `ping_single_connection`, and `handle_connection_failure` do not become public.

- [ ] **Step 5: Install a recursive legacy-transfer architecture allowlist**

The architecture policy gives only `export.rs`, `dump_commands.rs`, and `clipboard_import.rs` a legacy-transfer exception for driver-name branching, transfer-specific direct-pool access, and engine-specific transfer SQL, with owner `future DatabaseDriver semantic transfer program`. The recursive test walks every Rust file under `src/commands/`, `src/domains/`, and `src/infrastructure/`; it must fail when transfer-specific patterns appear outside the three exact legacy owner paths. Existing focused pool/driver implementation modules retain their separate, narrowly defined infrastructure/driver policy entries; they are not covered by the legacy-transfer exception. It also asserts no `domains/import_export/` exists and no transfer method/capability was added to `drivers/driver_trait.rs`.

Run:

```bash
pnpm test tests/repository/architecture.test.ts -- --run
```

Expected: PASS with exactly the three legacy-transfer owner paths in that allowlist, separate narrow entries for legitimate focused pool/driver implementations, and no blanket directory exception.

- [ ] **Step 6: Verify Task 11 independently**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::import_export
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::keybindings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::keybindings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::health
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml export::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dump_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml health_check::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml clipboard_import::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml connection_import_commands::tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
pnpm test tests/repository/architecture.test.ts -- --run
pnpm test:rust
```

Expected: every command exits `0`; legacy commands/states/context fields/branches/pools/SQL, generated bytes, event order/payloads, cancellation, health APIs, keybinding JSON behavior, and command registration are unchanged. `commands/keybindings.rs` contains no `std::fs` calls, so Task 13's recursive guard can pass. Task 11 is independently green without a domain transfer service or any `DatabaseDriver`/`DriverCapabilities` change.

---

### Task 12: Extract connection and catalog domain services

**Files:**
- Create/complete: `apps/desktop/src-tauri/src/domains/connections/*.rs`
- Create/complete: `apps/desktop/src-tauri/src/domains/catalog/*.rs`
- Modify: connection, catalog, routine, view, trigger, DDL, and driver command families
- Create: domain tests under `apps/desktop/src-tauri/src/domains/connections/tests/` and `catalog/tests.rs`

**Interfaces:**
- Consumes: repository/credential ports, `ConnectionContextResolver`, `DatabaseDriver`.
- Produces: Tauri-independent services called by command adapters.

Domain services receive explicit primitives or `DatabaseContext`; they return existing model/result types and `String` errors. No domain service imports `tauri`.

- [ ] **Step 1: Confirm current connection/catalog characterization remains green**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml context_forwarding_legacy
```

Expected: PASS against current command owners before service extraction; record a non-zero test count.

- [ ] **Step 2: Write initially failing fake-backed target service tests**

For each family, fake the repository/resolver/driver and assert call order, exact arguments, exact per-command context tuple, returned values, and errors. Include save/update/delete/duplicate credential handling; group hierarchy and cycle errors; connection configuration payload merge; active/disconnect order; database/schema/table operations; routines; views/materialized views; triggers; and DDL generation. Do not include query export, database dump/import, clipboard import, or foreign-client connection import in a generic transfer domain; their allowlisted owners and tests remain unchanged.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::connections
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::catalog
```

Expected: both target filters FAIL because services do not exist; both legacy filters from Step 1 remain PASS.

- [ ] **Step 3: Extract connection workflows without changing persistence order**

Move command bodies into connection services only where they are already repository/credential/group orchestration. Preserve UUID creation, keychain write/delete order, cache invalidation, appearance/icon behavior, query-history cleanup, single-to-multi backfill, group ordering/cascade rules, migration behavior, and connection configuration payload merge order. Keep `connection_import_commands.rs` in its current compatibility owner in this structural program; its importer/keychain/cache/apply ordering is frozen by Task 1.

- [ ] **Step 4: Extract catalog/schema workflows without changing delegation**

Move database/schema/table metadata and mutation, routines, views, triggers, driver metadata, and DDL orchestration into catalog services. Driver methods remain the only owner of database semantics already delegated there.

- [ ] **Step 5: Convert commands to one-call adapters**

For commands included in Tasks 12–13, an adapter may extract `AppHandle`/`State`, construct infrastructure adapters and the exact current `DatabaseContext`, resolve it, call one domain service, and return the result. The only alternate destinations are `commands::queries::count_query` calling `crate::count_query_compat::run` and `commands::connection_lifecycle::get_server_now` calling `crate::server_time_compat::run` after the same exact-context resolution; neither adapter contains SQL or branching. Adapters must not perform filesystem I/O, keychain access, SQL construction, driver branching, or workflow sequencing. This one-call rule explicitly excludes the three allowlisted legacy transfer owners and `connection_import_commands.rs`; do not claim root-wide thin adapters while those compatibility workflows remain.

- [ ] **Step 6: Verify connection/catalog behavior**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::connections
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::catalog
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test command_module_compatibility
pnpm test:rust
```

Expected: PASS with unchanged public behavior.

---

### Task 13: Extract query, record, BLOB, and window services; finish thin adapters

**Files:**
- Create/complete: `apps/desktop/src-tauri/src/domains/queries/*.rs`
- Create: `apps/desktop/src-tauri/src/count_query_compat.rs`
- Create: `apps/desktop/src-tauri/src/count_query_compat/tests.rs`
- Create: `apps/desktop/src-tauri/src/server_time_compat.rs`
- Create: `apps/desktop/src-tauri/src/server_time_compat/tests.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` to declare both compatibility owners as `pub(crate) mod`
- Modify: `apps/desktop/src-tauri/src/commands/queries.rs`
- Modify: `apps/desktop/src-tauri/src/commands/connection_lifecycle.rs`
- Modify: `apps/desktop/src-tauri/src/commands/records.rs`
- Modify: `apps/desktop/src-tauri/src/commands/blobs.rs`
- Modify: `apps/desktop/src-tauri/src/commands/windows.rs`
- Modify: `apps/desktop/src-tauri/src/commands/tests/connection_lifecycle.rs`
- Create: tests under `apps/desktop/src-tauri/src/domains/queries/tests/`
- Create: `apps/desktop/src-tauri/tests/thin_command_boundaries.rs`

**Interfaces:**
- Consumes: resolved driver/params, cancellation registry, max BLOB size, file/window infrastructure callbacks.
- Produces: query services preserving `QueryResult`, `BatchStatementResult`, `ExplainPlan`, cancellation, and progressive batch events; crate-private `count_query_compat::run` and `server_time_compat::run` owners for the two unchanged engine-SQL workflows.

Declare the owners from `lib.rs` without public external API:

```rust
pub(crate) mod count_query_compat;
pub(crate) mod server_time_compat;
```

`count_query_compat.rs` owns the complete current post-resolution count workflow unchanged: trim/semicolon removal, exact `SELECT COUNT(*) FROM ({}) as count_wrapper` construction, `execute_query(&params, &count_q, None, 1, schema)`, first-cell signed-to-`u64` conversion, and zero fallback. `commands::queries::count_query` constructs the exact current `DatabaseContext`, resolves once, and makes one call to:

```rust
pub(crate) async fn run(
    driver: std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>,
    params: crate::models::ConnectionParams,
    query: String,
    schema: Option<String>,
) -> Result<u64, String>;
```

`server_time_compat.rs` owns the complete current post-resolution server-time workflow unchanged: exact driver branch (`sqlite` → `SELECT datetime('now', 'localtime')`, otherwise `SELECT NOW()`), `execute_query(&params, query, Some(1), 1, None)`, first-cell string/JSON conversion, and `No timestamp returned from server`. `commands::connection_lifecycle::get_server_now` constructs the exact current connection-only `DatabaseContext`, resolves once, and makes one call to:

```rust
pub(crate) async fn run(
    driver: std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>,
    params: crate::models::ConnectionParams,
    driver_id: String,
) -> Result<String, String>;
```

Each owner declares `#[cfg(test)] mod tests;`, resolving to its sibling `<owner>/tests.rs`. Neither owner is a generic domain, driver implementation, Tauri command, public re-export, or permission to add new SQL. Both exact paths are temporary compatibility workflow owners and removable only by the future backend behavior program after behavior-approved `DatabaseDriver` operations exist.

- [ ] **Step 1: Confirm current query/record/BLOB/window and engine-SQL characterization remains green**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle -- --list
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle
```

Expected: every legacy filter executes at least one test and PASS before service or compatibility-owner extraction. The queries suite freezes count-wrapper SQL/arguments/conversion/errors; connection-lifecycle freezes server-time branch SQL/arguments/conversion/errors. Counts for queries, records, blobs, and windows match the nonzero Task 4 baseline; zero tests is a failure.

- [ ] **Step 2: Write initially failing target query service tests**

Cover smart-quote normalization and semicolon trimming; default page `1`; exact current database/schema forwarding and `None` for fields the command does not carry; multiple shared cancellation handles; success/driver-error/join-cancel mappings; batch order and `batch-statement-complete` payload; explainability error; record mutation arguments; BLOB wire parsing/errors; file-size validation; MIME detection; data URLs; and window label/URL construction. Do not place count-wrapper or server-time SQL in these generic-domain target tests; their separate initially failing compatibility-owner tests import `crate::count_query_compat::run` and `crate::server_time_compat::run` and assert the frozen SQL, driver branch, execute arguments, result conversion, and exact errors.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml count_query_compat
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml server_time_compat
```

Expected: all three target filters execute at least one test and FAIL because target services/owners do not exist; all five legacy filters from Step 1 remain PASS. Zero tests is a failure.

- [ ] **Step 3: Extract query orchestration and the exact count-query compatibility workflow**

Move sanitation, task spawning, cancellation registration/unregistration, driver calls, and result mapping to query services. Replace direct Tauri event emission with an injected batch-progress callback. Preserve event name `batch-statement-complete` and payload keys `batch_id`, `index`, `statement`.

Move only the frozen post-resolution `count_query` workflow to crate-private `count_query_compat.rs` exactly as defined above; do not rewrite its SQL, conversion, arguments, or errors and do not put it in `domains/queries`. Leave `commands::queries::count_query` as a one-call adapter after exact-context resolution. Keep `count_query_compat/tests.rs` as the exact compatibility-owner suite and retain the original `commands::tests::queries` assertions as the independently nonzero legacy command suite. Run both filters; expected: both PASS with the recorded nonzero legacy count and the new owner tests.

- [ ] **Step 4: Extract record and BLOB workflows**

Move record delegation and BLOB/file mechanisms to focused services/infrastructure. Preserve `BLOB:<size>:<mime>:<base64>` and `BLOB_FILE_REF:<size>:<mime>:<filepath>` formats and exact errors.

- [ ] **Step 5: Extract window construction and the exact server-time compatibility workflow**

Move ER URL/title/label pure construction to a tested helper and leave Tauri window lookup/build/focus in infrastructure. Preserve URL parameter names, encoding, dimensions, title, and label sanitation.

Move only the frozen post-resolution `get_server_now` workflow to crate-private `server_time_compat.rs` exactly as defined above; do not rewrite its branch SQL, conversion, arguments, or errors and do not put it in a generic domain or driver. Leave `commands::connection_lifecycle::get_server_now` as a one-call adapter after exact-context resolution. Keep `server_time_compat/tests.rs` as the exact owner suite and retain `commands::tests::connection_lifecycle` as an independently nonzero legacy command suite. Run `commands::tests::windows`, `commands::tests::connection_lifecycle`, and `server_time_compat`; expected: all PASS with nonzero tests.

- [ ] **Step 6: Add the thin-boundary architecture test**

`thin_command_boundaries.rs` recursively traverses `src/commands/` (including every nested directory and `mod.rs`) with `std::fs::read_dir`, follows only `.rs` files, canonicalizes paths, and fails if any command adapter imports or invokes `sqlx`, `std::fs`, `keychain_utils`, built-in driver modules, pool constructors, or raw SQL literals. A top-level `src/commands/*.rs` glob is insufficient. `commands/keybindings.rs` is not exempt: Task 11's characterized storage extraction must leave it as a transport/path adapter with no filesystem calls. Allow `tauri`, model types, domain services, infrastructure adapter constructors, logging, and event callback construction.

A separate recursive ownership scan traverses all `.rs` files under `src/` and reports the exact relative path and offending pattern. It allows transfer-specific direct pools/driver branches/SQL only in root `export.rs`, `dump_commands.rs`, and `clipboard_import.rs`; it does not exempt `src/commands/`, `src/domains/`, or all of `src/infrastructure/`. It separately allows the frozen count-wrapper SQL only at exact path `src/count_query_compat.rs` and the frozen server-time branch/SQL only at exact path `src/server_time_compat.rs`. Those two entries allow only their current patterns, forbid `#[tauri::command]` and public re-export, and carry owner/removal metadata `future backend behavior program` / `after behavior-approved DatabaseDriver operation replaces this workflow`. No directory-wide SQL exception is allowed. This task does not rewrite SQL or add a trait method.

- [ ] **Step 7: Verify final adapters**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml domains::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml count_query_compat
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml server_time_compat
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test thin_command_boundaries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test command_module_compatibility
pnpm test:rust
```

Expected: every filter executes at least one test and PASS; every command adapter in the completed `src/commands/` scope is transport-only, recursive scans cover nested modules, exact-path `count_query_compat.rs` and `server_time_compat.rs` retain only their unchanged frozen workflows, and all frozen contracts remain unchanged. This is not a claim that every root-level `#[tauri::command]` in the crate has been converted.

---

### Task 14: Ratchet architecture boundaries and update living documentation

**Files:**
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/rust.md`
- Modify: `.rules/testing.md` only if normalized Rust paths need clarification
- Modify: `architecture/policy.json`
- Modify: `scripts/check-architecture.mjs`
- Modify: `tests/repository/architecture.test.ts`

**Interfaces:**
- Consumes: completed target modules, preserved public compatibility facades, and temporary crate-private exceptions.
- Produces: machine-enforced ownership/dependency rules and accurate current-state documentation.

- [ ] **Step 1: Write failing architecture tests**

Assert:

```text
app/ owns builder, managed states, setup, handler registration
commands/ may depend on domains, models, and adapter constructors; not sqlx/filesystem/keychain/driver implementations
command-boundary and ownership scans recurse through every nested Rust module
non-command domains do not import tauri and contain no direct pool, built-in driver, or engine-SQL transfer workflow
drivers do not import commands or domains
DatabaseDriver and DriverCapabilities contain no transfer API/capability added by this program
plugins process transport does not implement DatabaseDriver
plugins RPC adapter does not spawn/read/write child processes
infrastructure does not import commands and engine-neutral import_export helpers contain no driver dispatch/SQL
pure compatibility facades are re-export-only and public ones are preserved API, never local-consumer auto-removal candidates
export.rs, dump_commands.rs, and clipboard_import.rs are exact-path legacy-transfer owners, not shims; no other path receives that exception
count_query_compat.rs alone owns the frozen count-wrapper SQL; server_time_compat.rs alone owns the frozen driver branch/server-time SQL; both are crate-private, non-Tauri, non-re-exported exact-path compatibility owners
app/tests.rs, commands/tests.rs, infrastructure/import_export/tests.rs, and plugins/tests.rs are canonical aggregators declaring every child suite exactly once; MCP alone uses mcp/tests/mod.rs as specified; required app/command/import-export/plugin/MCP filters execute nonzero tests
commands/mod.rs declares and re-exports commands/config.rs; infrastructure/connections/repository.rs is the actual find_connection_by_id owner; commands/legacy.rs survives through Tasks 5–6 and is removed only when empty
new Rust files stay below the configured 800-line soft threshold
```

Run:

```bash
pnpm test tests/repository/architecture.test.ts -- --run
pnpm check:architecture
```

Expected: FAIL until policy/docs are updated and all remaining violations are fixed or explicitly ratcheted.

- [ ] **Step 2: Update architecture policy**

Add backend layer rules, current file-size baselines, pure compatibility facades, and the exact-path legacy-transfer allowlist with removal phase/owner. Mark externally reachable facades, especially `nexora_lib::pool_manager`, as preserved public API with no repository-local zero-consumer auto-removal rule. Add separate exact-path entries for `apps/desktop/src-tauri/src/count_query_compat.rs` and `apps/desktop/src-tauri/src/server_time_compat.rs`; each entry permits only its frozen SQL/driver-pattern inventory, requires crate-private non-Tauri ownership, names `future backend behavior program`, and removes only after a behavior-approved `DatabaseDriver` operation replaces that workflow. Reject the same patterns in commands, domains, generic infrastructure, drivers, or any unlisted root file. Remove oversized-file baselines for former `commands.rs`, `pool_manager.rs`, `plugins/driver.rs`, `config.rs`, `mcp/mod.rs`, and `health_check.rs` once they become focused modules or logic-free facades; this removes only stale size exceptions, never the public facade files. Do not remove or call `dump_commands.rs` a shim while it still owns current direct-pool/SQL workflows; retain an explicit size baseline until the future semantic transfer program removes that logic.

- [ ] **Step 3: Update canonical documentation**

Document current enforced layout, dependency direction, public entry points, test placement, and these temporary compatibility exceptions:

```text
nexora_lib::commands compatibility facade — owner: public backend API — preserve; removal requires separately approved deprecation/breaking-change program
nexora_lib::pool_manager compatibility facade — owner: public backend API — preserve even with zero repository-local consumers; never auto-remove
nexora_lib::config compatibility facade — owner: public backend API — preserve; removal requires separately approved deprecation/breaking-change program
nexora_lib::plugins::driver compatibility facade — owner: public backend API — preserve; removal requires separately approved deprecation/breaking-change program
nexora_lib::health_check compatibility facade — owner: public backend API — preserve; removal requires separately approved deprecation/breaking-change program
root export.rs, dump_commands.rs, clipboard_import.rs legacy-transfer owners — owner: future DatabaseDriver semantic transfer program — remove only after behavior-approved trait/plugin/capability work
connection_import_commands.rs compatibility workflow owner — owner: future connection-import port extraction — remove only after its cache/keychain/apply ordering has a replacement
root count_query_compat.rs frozen count-wrapper workflow — crate-private exact-path owner: future backend behavior program — remove only after a behavior-approved DatabaseDriver count operation replaces it
root server_time_compat.rs frozen driver branch/server-time workflow — crate-private exact-path owner: future backend behavior program — remove only after a behavior-approved DatabaseDriver server-time operation replaces it
```

- [ ] **Step 4: Update contributor and agent rules**

Add concise rules to `AGENTS.md` and `.rules/rust.md`: commands moved into `src/commands/` are adapters; domains use only context fields already carried by the command and no Tauri; drivers own database semantics; plugins split transport/adapter; infrastructure owns engine-neutral mechanisms; pure compatibility facades cannot receive new logic and externally public facades cannot be removed from local zero-consumer evidence; exact-path legacy-transfer owners cannot grow or move into domains until `DatabaseDriver` supplies approved semantic operations; and `count_query_compat.rs`/`server_time_compat.rs` are frozen crate-private exceptions that cannot gain commands, re-exports, or additional SQL.

- [ ] **Step 5: Verify architecture docs and guards**

Run:

```bash
pnpm test tests/repository/architecture.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm check:architecture
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test thin_command_boundaries
```

Expected: PASS and all documented paths exist.

---

### Task 15: Final equivalence and release gate

**Files:**
- Verify all files changed by Tasks 1–14
- Do not remove compatibility facades in this task; public facades are never locally auto-removed

**Interfaces:**
- Consumes: completed backend modularization.
- Produces: evidence that the branch is behavior-equivalent, test-complete, and ready for review.

- [ ] **Step 1: Verify compatibility surfaces and registration**

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test tauri_command_contract
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test command_module_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test pool_manager_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test plugin_driver_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test config_compatibility
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test thin_command_boundaries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app::tests::command_registration
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app::tests::setup
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml app::tests::state
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::import_export
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml infrastructure::keybindings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests::manifest
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests::process
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests::rpc_driver
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml count_query_compat
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml server_time_compat
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::router
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::protocol
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::audit
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::query_approval
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml mcp::tests::target_interfaces
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::queries
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::records
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::blobs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::windows
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::connection_lifecycle
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml commands::tests::keybindings
```

Expected: all filters execute at least one test and PASS; registration fixture remains byte-for-byte unchanged from Task 2; canonical app, command, import/export, plugin, and MCP aggregators load every named suite exactly once; keybinding commands remain filesystem-free adapters; and both exact-path SQL compatibility owners match their frozen workflows.

- [ ] **Step 2: Verify preserved root command scope**

Run from repository root:

```bash
pnpm test tests/repository/rootCommands.test.ts -- --run
pnpm test:rust
```

Expected: PASS; the root command contract still maps `test:rust` to `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`, all required root scripts remain available, and ignored integration tests retain their explicit classification. Raw Cargo commands in this plan are narrow implementation filters, not replacements for the preserved root command surface.

- [ ] **Step 3: Run the full CI-equivalent local gate**

Run from repository root:

```bash
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm build:plugin-api
pnpm check:plugin-api
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm build
pnpm test:rust
pnpm check:architecture
```

Expected: every command exits `0`. Fix failures and rerun the failed narrow command, then rerun this complete set.

- [ ] **Step 4: Review affected execution flows**

Run GitNexus change detection against the default branch:

```text
detect_changes(scope: "compare", base_ref: "main", repo: "nexora")
```

Expected: changed symbols are limited to app wiring, command adapters, approved domain extraction, pool/plugin/config/MCP modularization, engine-neutral export/dump helper moves, health modularization, deferred-provider shared driver bootstrap, exact unchanged moves of count/server-time workflows, tests, guards, and architecture docs. Desktop still performs its two bootstrap-related internal-config reads/cache writes at the frozen points and later setup reads at their existing positions; MCP still performs one post-built-in non-caching startup disk read. `export_query_to_file`, `dump_database`, `import_database`, `execute_clipboard_import`, their driver branches/direct pools/SQL, and connection-import workflow ordering remain in their compatibility owners. Count-wrapper and server-time SQL appear only in `count_query_compat.rs` and `server_time_compat.rs`. No driver trait/capability, plugin protocol, payload, timeout, event, or frontend flow change is reported.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git status --short
git diff --stat
git diff --check
git diff -- apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock
```

Expected: only intended files changed, no whitespace errors, and no dependency or lockfile change unless separately justified and approved. Do not commit, push, or create a pull request unless explicitly requested.

## Completion Criteria

- [ ] `lib.rs` delegates desktop builder work to `app/`; setup, managed states, and handler registration are focused and tested.
- [ ] Every frozen Tauri command remains registered under the same name and shape; `commands/config.rs` is declared and re-exported by `commands/mod.rs`.
- [ ] The 106 former `commands.rs` commands live in exact focused families and remain available through `crate::commands::*`; `commands/legacy.rs` remains through Tasks 5–6 and is deleted only after its final helpers move; every queries/records/BLOB/windows/connection-lifecycle legacy suite is established before extraction, declared by `commands/tests.rs`, and executes its recorded nonzero count.
- [ ] Tauri commands moved into `src/commands/` are thin adapters and contain no SQL, filesystem, keychain, pool, or built-in-driver workflow logic; recursive guards cover nested command modules. `count_query` and `get_server_now` are one-call adapters after exact-context resolution, with frozen post-resolution workflows owned only by crate-private `count_query_compat.rs` and `server_time_compat.rs`. Root compatibility workflows are reported separately, not hidden by a root-wide completion claim.
- [ ] Database context preserves the exact fields each current path carries: `connection_id`, and `database`/`schema`/`table` only where already present, including stale/previous-selection tests; no missing field is invented.
- [ ] Query, export, dump, and import cancellation preserve multiple handles, slot identities, and error strings.
- [ ] `count_query_compat.rs` and `server_time_compat.rs` remain the exact compatibility owners with complete frozen SQL/branch/argument/conversion/error tests; the original queries and connection-lifecycle command suites remain independently nonzero.
- [ ] Pool keys, TLS, startup scripts, hooks, fallback detection, pool caches, and close behavior are unchanged.
- [ ] Plugin process lifecycle/transport and `RpcDriver` are separate while RPC methods, parameter keys, errors, timeouts, and fallbacks remain unchanged.
- [ ] Config serialization/defaults/merge behavior, keybinding storage behavior, MCP protocol/audit/approval behavior, export/dump bytes/SQL/events, clipboard-import behavior, connection-import error/cancellation/cache ordering, and health state/timeouts/events remain equivalent; `clipboard_import.rs` is explicitly routed through the resolver without moving or changing its tuple/workflow; `mcp/tests/mod.rs` declares router/protocol/audit/query-approval/target-interface suites exactly once and every filter is nonzero.
- [ ] Desktop and MCP use one shared built-in-then-plugin driver bootstrap with deferred config acquisition in exact order: desktop first reads/caches active IDs, registers MySQL → PostgreSQL → SQLite, then the provider performs the second internal read/cache write and external plugins load, with later health/maximize reads unchanged; MCP registers the same three built-ins before its sole non-caching disk read/provider and loads external plugins before the request loop.
- [ ] `DatabaseDriver`, `DriverCapabilities`, built-in SQL, plugin manifests, and external package contracts are unchanged; no transfer, count, or server-time semantic was added or bypassed.
- [ ] Pure compatibility facades are documented, machine-allowlisted, and logic-free; public facades such as `nexora_lib::pool_manager` are preserved API and never removed from repository-local zero-consumer evidence; legacy workflow owners are separately exact-path allowlisted with a future behavior-program owner, including narrow crate-private entries for `count_query_compat.rs` and `server_time_compat.rs`.
- [ ] `infrastructure/connections/repository.rs` owns `find_connection_by_id`, while `commands/mod.rs` re-exports that actual owner; no declaration falsely attributes it to resolution.
- [ ] `app/tests.rs`, `commands/tests.rs`, `infrastructure/import_export/tests.rs`, and `plugins/tests.rs` are canonical aggregators with consistent child declarations; `plugins/tests.rs` retains its `manifest` child for later additions.
- [ ] Architecture docs, `AGENTS.md`, focused rules, tests, and policy agree with the current enforced layout.
- [ ] All narrow tests, `pnpm test:rust`, architecture checks, and the full CI-equivalent gate pass.
