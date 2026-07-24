# Nexora Repository Structure

## Current state

Workspace discovery includes `apps/*`, and `apps/desktop/package.json` defines the private `@nexora/desktop` package. Desktop production is organized under `apps/desktop/src/app`, `features`, `shared`, and `platform`; tests mirror those owners under `apps/desktop/tests`. The app composition entry points are `app/App.tsx`, `app/main.tsx`, `app/providers.tsx`, and `app/routes.tsx`. The canonical host-side mirror for `@nexora/plugin-api` is `apps/desktop/src/features/plugins/lib/pluginApi.ts`, and the desktop version module is `apps/desktop/src/app/config/version.ts`. Direct Tauri imports are confined to `apps/desktop/src/platform/tauri`, with no remaining direct-import exceptions. Root owns command orchestration, repository tests, lint configuration, and release metadata. `packages/plugin-api/` independently owns runtime tests, compiler contracts, normalized read-only host/package contract synchronization against a reasoned baseline, fresh staged builds, one canonical tarball/checksum, and package-content inspection. `plugins/` owns shared neutral manifest fixtures and schema authoring documentation; JSON Schema, Rust Serde/default/projection, frontend compiler/runtime, and create-plugin generation remain independently characterized contracts. `packages/create-plugin/` owns CLI/scaffold tests, compiler checks, fresh `.tmp/build`, full Cargo smoke, one canonical staged tarball/checksum, and packed-CLI inspection while preserving Node `>=18.17.0` and CLI version `0.1.0`.

## Target state

The frontend modularization target is the current structure. App shell, configuration, localization, styles, and cross-feature dependency injection live under `app`; domain code lives under named `features`; reusable presentation, contracts, and utilities live under `shared`; Tauri transport and adapters live under `platform/tauri`. Feature public entry points are the supported cross-feature API, and the feature dependency graph should remain acyclic.

## Dependency direction

- Desktop may import package public entry points.
- Packages may not import desktop internals.
- Features may import `shared` and `platform`; shared modules may not import features.
- Cross-feature imports use explicit feature public entry points and must preserve an acyclic feature graph.
- App composition injects implementations for reverse dependencies such as editor UI used by connections/schema and visual explain UI used by editor.
- Rust commands under `apps/desktop/src-tauri/src/commands/` are transport adapters and may depend on domains, models, and infrastructure adapter constructors, but not `sqlx`, built-in driver implementations, or pool constructors. Existing root legacy transfer owners are documented below and must not expand.
- Tauri-independent domains own workflows and explicit database context; domains do not import Tauri, direct pools, or built-in drivers, and must not re-export infrastructure APIs. Drivers own database semantics and do not import commands or domains. Infrastructure owns engine-neutral mechanisms and does not import commands.
- Plugin discovery, loading, installation, filesystem access, and lifecycle workflows live under `plugins`; `commands/plugin_manager.rs` and `commands/plugin_commands.rs` are transport adapters. Plugin process transport and the `RpcDriver` adapter are separate, and the compatibility direction is legacy public facade → canonical plugin implementation, never plugin implementation → commands. Notebook and editor-preference filesystem workflows live under `infrastructure`, with commands as adapters. Compatibility facades contain re-exports only and remain stable public entry points.

## Test ownership

- Desktop TypeScript suites live in `apps/desktop/tests/` and mirror their source or contract owner under `apps/desktop/src/`. `apps/desktop/tests/repository/` owns desktop-wide contracts that do not mirror one source file. The named `desktop` Vitest project owns JSDOM setup and coverage of `apps/desktop/src`.
- Root `tests/repository/` is the sole root test namespace and owns workspace/release contracts only. The root Vitest aggregator exposes it as the named `repository` project in Node and composes the desktop project. Repository tests may inspect files but may not import desktop-private modules, including normalized relative or aliased imports and static `import.meta.glob`/`globEager` references; absolute, escaping, ambiguous-alias, and non-static glob references are rejected. Package-owned tests live below `packages/<package>/tests/`.
- Frontend production modules use TypeScript (`.ts` or `.tsx`) unless a build tool specifically requires another format.
- Desktop Rust unit tests use module-local `tests.rs` or `tests/` suites loaded with private `#[cfg(test)] mod tests;` declarations. Avoid non-trivial inline test modules, test-source `include!`, test-to-test `#[path]` inclusions, and peer `*_tests.rs` files. Crate integration tests live in `apps/desktop/src-tauri/tests/` and cover compile/public contracts, behavior, compatibility, or external database integration. `apps/desktop/src-tauri/tests/database_integration.rs` is the external-infrastructure suite; its tests remain ignored in default Cargo runs, and explicit runs use the documented MySQL and PostgreSQL services. Generated create-plugin Rust utility tests use sibling `tests.rs` suites.

## Review guidance

Architecture constraints are maintained as human-readable guidance in `AGENTS.md` and `.rules/`. Review repository changes for these enduring constraints:

- keep desktop production, tests, assets, configuration, and the Tauri crate under `apps/desktop/`;
- keep package code and tests under the owning package, with root `tests/repository/` reserved for workspace, package, release, and workflow contracts;
- preserve frontend layer direction, feature public entry points, and the Tauri gateway boundary;
- keep new TypeScript/TSX files below 500 lines and new Rust files below 800 lines, and avoid growing existing oversized files without explicit approval;
- keep workspace dependencies intentional and directed from applications to package public entry points, never from packages into desktop internals;
- preserve canonical Rust unit-test layout and retain behavior, regression, compile/public-contract, compatibility, package, release, workflow, and database integration tests;
- classify every deleted or replaced test by purpose during review; removing static architecture enforcement must never remove observable behavior or public-contract coverage;
- do not reintroduce legacy root desktop paths or new compatibility exceptions.

These constraints are reviewed in code review rather than represented by generated inventories or source-scanning policy tests.

Default: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

Explicit external integration run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --ignored`

Required services: MySQL on `127.0.0.1:33060` and PostgreSQL on `127.0.0.1:54320` with the existing test credentials and database. Explicit runs fail with the required-service precondition when infrastructure is absent rather than succeeding as no-ops.

## Temporary compatibility exceptions

| Exception | Owner | Reason | Removal phase |
|---|---|---|---|
| Root `tests/repository/` | Repository maintainers | Sole documented root test exception for workspace/release contracts; may inspect repository files but must not import desktop-private modules | Permanent repository ownership |
| Existing oversized files | Owning module maintainers | Preserve behavior while creating focused refactoring opportunities | Frontend/backend modularization |
| `nexora_lib::commands`, `nexora_lib::config`, `nexora_lib::plugins::driver`, `nexora_lib::pool_manager`, and `nexora_lib::health_check` compatibility facades | Public backend API | Preserve re-export-only public paths; repository-local zero consumers do not authorize removal | Separately approved deprecation or breaking-change program |
| Root `export.rs`, `dump_commands.rs`, and `clipboard_import.rs` | Future `DatabaseDriver` semantic transfer program | Exact-path legacy transfer owners; their current direct pools, driver branches, and SQL must not move into commands, domains, or generic infrastructure | After behavior-approved trait, plugin, and capability operations replace each workflow |
| `connection_import_commands.rs` | Future connection-import port extraction | Preserve cache, keychain, cancellation, and apply ordering | After an equivalent connection-import service replaces the workflow |
| Root `count_query_compat.rs` | future backend behavior program | Crate-private, non-Tauri exact-path owner of the frozen count-wrapper workflow only | After a behavior-approved `DatabaseDriver` count operation replaces it |
| Root `server_time_compat.rs` | Future backend behavior program | Crate-private, non-Tauri exact-path owner of the frozen driver branch and server-time SQL only | After a behavior-approved `DatabaseDriver` server-time operation replaces it |

No frontend compatibility or direct-Tauri exceptions remain. Existing oversized files should shrink rather than grow. Do not introduce new legacy exceptions. Remove backend exceptions only through a separately approved behavior/deprecation program.

## CI and release workflow ownership

CI diagnoses repository, desktop, plugin API, create-plugin, and Rust gates independently. npm publication validates canonical package tarballs and SHA256 sidecars, preflights exact public-registry versions, and publishes those same immutable paths without rebuilding or repacking. Cargo caches resolve `apps/desktop/src-tauri`, and Tauri build actions set `projectPath: apps/desktop` with the desktop-owned Tauri CLI. The release dry run owns broad moved desktop source/config/version triggers while preserving its unsigned bundle arguments and artifact names. Root-owned `aur/` and `snap/` metadata consume exact-cased `Nexora_<version>_amd64.deb` and `Nexora_<version>_x64-setup.exe` release artifacts; `pnpm validate:distribution` performs non-publishing static validation. Workflow YAML is validated through `pnpm lint:workflows`, a checksum-verified launcher pinned to actionlint v1.7.7.

## Required verification

Run the narrowest relevant checks first, then run required affected checks from `AGENTS.md`:

- `pnpm exec vitest run --project repository tests/repository/<file>.test.ts` or `pnpm exec vitest run --project desktop apps/desktop/tests/<mirror>.test.tsx`
- `pnpm test --run`, `pnpm test:repository --run`, `pnpm test:desktop --run`, and desktop-owned coverage through `pnpm test:coverage` as applicable; do not place `--` before `--run` because that leaves Vitest in watch mode
- `pnpm typecheck` after TypeScript changes
- `pnpm lint` after TypeScript/React changes
- `pnpm test:rust` or the relevant `cargo test` command against `apps/desktop/src-tauri/Cargo.toml` after Rust/backend changes
- Package and tooling changes: `pnpm test:plugin-api`, `pnpm typecheck:plugin-api`, `pnpm pack:plugin-api`, `pnpm test:create-plugin`, `pnpm typecheck:create-plugin`, `pnpm smoke:create-plugin`, `pnpm pack:create-plugin`, `pnpm check:packages`, `node scripts/sync-version.js --check`, `pnpm validate:distribution`, and `pnpm lint:workflows`
- Before pushing, creating/updating a PR, merging, tagging, or releasing: `pnpm test --run`, `pnpm typecheck`, `pnpm lint`, `pnpm check:packages`, `pnpm validate:distribution`, `pnpm lint:workflows`, `pnpm build`, and `pnpm test:rust` when Rust/Tauri files changed
- During review, compare structural changes with `AGENTS.md`, `.rules/frontend.md`, `.rules/rust.md`, and `.rules/testing.md`
