# Nexora Repository Structure

## Current enforced state

Foundation architecture guards are current and enforced through `pnpm check:architecture`. Workspace discovery includes `apps/*`, and `apps/desktop/package.json` defines the working private `@nexora/desktop` package. All desktop-owned production, configuration, and test paths are current under `apps/desktop/`, including frontend source, tests, assets, dependencies, scripts, app-local Vite/Vitest/TypeScript/PostCSS configuration, and the complete Tauri crate at `apps/desktop/src-tauri/`. Root owns command orchestration, ESLint configuration and runtime dependencies, repository assets, and `tests/repository/` as the sole root test namespace. `apps/desktop/src/pluginApi.ts` is the canonical host-side mirror for `@nexora/plugin-api`. Root `package.json` is the release version source of truth and synchronizes `apps/desktop/package.json`, `apps/desktop/src/version.ts`, `apps/desktop/src-tauri/tauri.conf.json`, and `apps/desktop/src-tauri/Cargo.toml`. Contributors continue running commands from the repository root.

## Target state

The desktop product owns `apps/desktop/{src,tests,src-tauri,public}` and app-local configuration. Root owns workspace orchestration, root ESLint, repository assets, and `tests/repository/`. Packages own their source, tests, builds, and public entry points. Desktop source, tests, assets, configuration, dependencies, scripts, and the complete Tauri crate have reached their target paths.

## Dependency direction

- Desktop may import package public entry points.
- Packages may not import desktop internals.
- Features may import `shared` and `platform`; shared modules may not import features.
- Cross-feature imports use explicit feature public entry points.
- Rust commands are transport adapters; domains own workflows; drivers own database semantics; infrastructure owns mechanisms.

## Test ownership

- Current desktop TypeScript tests live in `apps/desktop/tests/` and mirror `apps/desktop/src/`; four documented colocated tests remain temporary exceptions under `apps/desktop/src/`.
- Root `tests/repository/` is the sole root test namespace and owns workspace/release contracts only.
- Rust unit tests use sibling `tests.rs`; crate integration tests use `apps/desktop/src-tauri/tests/`.

## Architecture policy

Run `pnpm check:architecture` to enforce `architecture/policy.json`. The checker inventories Git-tracked files under configured source/test roots and package manifests belonging to the pnpm workspace, so arbitrary untracked, ignored, or non-workspace files are outside the policy inventory. The checker fails when:

- frontend tests are added under forbidden production roots such as `apps/desktop/src/` unless explicitly allowlisted;
- `.spec.*` test files are introduced anywhere;
- a source file without a baseline exceeds 500 lines for TypeScript/TSX or 800 lines for Rust;
- a ratcheted file exceeds its stored line count;
- tracked workspace packages depend on another workspace package not listed in `allowedWorkspaceDependencies`;
- Rust inline test modules are added outside `rustInlineTestAllowlist`;
- root repository contract tests import desktop-private modules from paths such as `apps/desktop/src/` or `apps/desktop/src-tauri/`.

File-size baselines are maximum current line counts. Do not increase baselines; reduce or remove them when splitting files. If an allowlisted Rust inline test module is moved to a sibling `tests.rs` file, remove that path from `rustInlineTestAllowlist` in the same change.

## Temporary compatibility exceptions

| Exception | Owner | Reason | Removal phase |
|---|---|---|---|
| Root `tests/repository/` | Repository maintainers | Sole documented root test exception for workspace/release contracts; may inspect repository files but must not import desktop-private modules | Permanent repository ownership |
| Four frontend tests under `apps/desktop/src/` | Frontend maintainers | Existing convention debt | Test normalization |
| Crate-level Rust `*_tests.rs` | Backend maintainers | Existing convention debt | Test normalization |
| Rust inline test modules listed in `architecture/policy.json` | Backend maintainers | Existing convention debt | Test normalization |
| Rust inline test modules in create-plugin templates listed in `architecture/policy.json` | Plugin tooling maintainers | Existing generated template convention debt | Test normalization |
| Oversized files listed in `architecture/policy.json` | Owning module maintainers | Guard ratchet baseline | Frontend/backend modularization |

Do not introduce new legacy exceptions. Remove existing exceptions only in the planned removal phase or with a same-change architecture update.

## CI and release workflow ownership

CI and release commands run from the repository root and delegate through root scripts. Cargo caches resolve `apps/desktop/src-tauri`, and Tauri build actions set `projectPath: apps/desktop`. The release dry run owns triggers for moved desktop version manifests, Vite configuration, Tauri manifests, and icons while preserving its unsigned bundle arguments and artifact names. Workflow YAML is validated through `pnpm lint:workflows`, a checksum-verified launcher pinned to actionlint v1.7.7.

## Required verification

Run the narrowest relevant checks first, then run required affected checks from `AGENTS.md`:

- `pnpm test apps/desktop/tests/utils/foo.test.ts apps/desktop/tests/components/bar.test.tsx` or the narrowest applicable test files
- `pnpm typecheck` after TypeScript changes
- `pnpm lint` after TypeScript/React changes
- `pnpm test:rust` or the relevant `cargo test` command against `apps/desktop/src-tauri/Cargo.toml` after Rust/backend changes
- Before pushing, creating/updating a PR, merging, tagging, or releasing: `pnpm test -- --run`, `pnpm typecheck`, `pnpm lint`, `pnpm build:plugin-api`, `pnpm check:plugin-api`, `pnpm build:create-plugin`, `pnpm smoke:create-plugin`, `pnpm build`, and `pnpm test:rust` when Rust/Tauri files changed
