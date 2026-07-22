# Nexora Repository Structure

## Current enforced state

Foundation architecture guards are current and enforced through `pnpm check:architecture`. Workspace discovery includes `apps/*`, and `apps/desktop/package.json` defines the working private `@nexora/desktop` package. Desktop-owned production and test paths are current under `apps/desktop/`, including frontend source, tests, assets, dependencies, scripts, app-local Vite/TypeScript/PostCSS configuration, the named desktop Vitest project with setup and coverage, and the complete Tauri crate at `apps/desktop/src-tauri/`. Root owns command orchestration, the named-project Vitest aggregator and CLI dependency, ESLint configuration and runtime dependencies, repository assets, and `tests/repository/` as the sole root test namespace. `apps/desktop/src/pluginApi.ts` is the canonical host-side mirror for `@nexora/plugin-api`. Root `package.json` is the release version source of truth and synchronizes `apps/desktop/package.json`, `apps/desktop/src/version.ts`, `apps/desktop/src-tauri/tauri.conf.json`, and `apps/desktop/src-tauri/Cargo.toml`. Contributors continue running commands from the repository root.

## Target state

The desktop workspace migration is complete: the desktop product owns `apps/desktop/{src,tests,src-tauri,public}` and app-local configuration, while root owns workspace orchestration, root ESLint, repository assets, and `tests/repository/`. The next phase is test architecture normalization, which will remove the documented colocated frontend and legacy Rust test-layout exceptions. Later modularization phases will establish the planned frontend feature/shared/platform boundaries and thin Rust command/domain/infrastructure ownership.

## Dependency direction

- Desktop may import package public entry points.
- Packages may not import desktop internals.
- Features may import `shared` and `platform`; shared modules may not import features.
- Cross-feature imports use explicit feature public entry points.
- Rust commands are transport adapters; domains own workflows; drivers own database semantics; infrastructure owns mechanisms.

## Test ownership

- Desktop TypeScript tests live in `apps/desktop/tests/` and mirror `apps/desktop/src/`; `apps/desktop/tests/repository/` owns desktop contracts that do not mirror one source file. The named `desktop` Vitest project owns JSDOM setup and coverage of `apps/desktop/src`.
- Root `tests/repository/` is the sole root test namespace and owns workspace/release contracts only. The root Vitest aggregator exposes it as the named `repository` project in Node and composes the desktop project. Repository tests may inspect files but may not import desktop-private modules.
- Desktop Rust unit tests use sibling `tests.rs`; crate integration tests use `apps/desktop/src-tauri/tests/`. Non-trivial desktop Rust unit tests are module-local under their production owners, including the intact commands and PostgreSQL extractor suites; no crate-level peer suites remain. The command inventory contract partitions Cargo's prefix-inclusive `commands::tests::` listing into 59 owner tests, 7 export/import tests, 17 group-tree tests, and the 2 unrelated `dump_commands::tests` substring matches. Checked-in create-plugin Rust templates retain their two exact inline suites under package-owned policy until the package/tooling plan changes generated output.

## Architecture policy

Run `pnpm check:architecture` to enforce `architecture/policy.json`. The checker inventories Git-tracked files under configured source/test roots and package manifests belonging to the pnpm workspace, so arbitrary untracked, ignored, or non-workspace files are outside the policy inventory. The checker fails when:

- frontend tests are added under forbidden production roots such as `apps/desktop/src/` unless explicitly allowlisted;
- `.spec.*` test files are introduced anywhere;
- a source file without a baseline exceeds 500 lines for TypeScript/TSX or 800 lines for Rust;
- a ratcheted file exceeds its stored line count;
- tracked workspace packages depend on another workspace package not listed in `allowedWorkspaceDependencies`;
- desktop Rust inline test modules are added outside the empty `rustInlineTestAllowlist`, or create-plugin template inline suites are added outside the exact package-owned `rustTemplateInlineTestAllowlist`;
- root repository contract tests import desktop-private modules from paths such as `apps/desktop/src/` or `apps/desktop/src-tauri/`, including configured desktop aliases such as `@` and `@/…`;
- desktop-owned source, assets, tests, manifests, dependencies, app-local configuration, or the Tauri crate are reintroduced at repository-root paths listed in `forbiddenRootDesktopPaths`.

File-size baselines are maximum current line counts. Do not increase baselines; reduce or remove them when splitting files. Desktop Rust inline-test debt is closed with an empty `rustInlineTestAllowlist`. The separate `rustTemplateInlineTestAllowlist` classifies only the two checked-in create-plugin template suites owned by the later package/tooling plan, and every entry must remain below an exact `rustTemplateInlineTestRoots` path; it cannot exempt desktop Rust.

## Temporary compatibility exceptions

| Exception | Owner | Reason | Removal phase |
|---|---|---|---|
| Root `tests/repository/` | Repository maintainers | Sole documented root test exception for workspace/release contracts; may inspect repository files but must not import desktop-private modules | Permanent repository ownership |
| Rust inline test modules in create-plugin templates listed in `rustTemplateInlineTestAllowlist` | Plugin tooling maintainers | Existing generated template convention retained without changing generated output | Packages/tooling cleanup |
| Oversized files listed in `architecture/policy.json` | Owning module maintainers | Guard ratchet baseline | Frontend/backend modularization |

Do not introduce new legacy exceptions. Remove existing exceptions only in the planned removal phase or with a same-change architecture update.

## CI and release workflow ownership

CI and release commands run from the repository root and delegate through root scripts. Cargo caches resolve `apps/desktop/src-tauri`, and Tauri build actions set `projectPath: apps/desktop`. The release dry run owns triggers for moved desktop version manifests, Vite configuration, Tauri manifests, and icons while preserving its unsigned bundle arguments and artifact names. Root-owned `aur/` and `snap/` metadata consume released desktop artifacts by their unchanged names and do not own desktop source. Workflow YAML is validated through `pnpm lint:workflows`, a checksum-verified launcher pinned to actionlint v1.7.7.

## Required verification

Run the narrowest relevant checks first, then run required affected checks from `AGENTS.md`:

- `pnpm exec vitest run --project repository tests/repository/<file>.test.ts` or `pnpm exec vitest run --project desktop apps/desktop/tests/<mirror>.test.tsx`
- `pnpm test -- --run`, `pnpm test:repository -- --run`, `pnpm test:desktop -- --run`, and desktop-owned coverage through `pnpm test:coverage` as applicable
- `pnpm typecheck` after TypeScript changes
- `pnpm lint` after TypeScript/React changes
- `pnpm test:rust` or the relevant `cargo test` command against `apps/desktop/src-tauri/Cargo.toml` after Rust/backend changes
- Before pushing, creating/updating a PR, merging, tagging, or releasing: `pnpm test -- --run`, `pnpm typecheck`, `pnpm lint`, `pnpm build:plugin-api`, `pnpm check:plugin-api`, `pnpm build:create-plugin`, `pnpm smoke:create-plugin`, `pnpm build`, and `pnpm test:rust` when Rust/Tauri files changed
