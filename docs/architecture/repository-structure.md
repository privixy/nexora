# Nexora Repository Structure

## Current enforced state

Foundation architecture guards are current and enforced through `pnpm check:architecture`. The desktop application still owns root `src/`, `tests/`, `src-tauri/`, `public/`, and app-local Vite/Vitest/TypeScript/Tauri configuration. Root package scripts remain the supported contributor and CI interface until the desktop migration lands.

## Target state

The desktop product will own `apps/desktop/{src,tests,src-tauri,public}` and app-local configuration. Root will own workspace orchestration and `tests/repository/`. Packages own their source, tests, builds, and public entry points. These target paths are planned destinations only until the migration that creates and wires them lands.

## Dependency direction

- Desktop may import package public entry points.
- Packages may not import desktop internals.
- Features may import `shared` and `platform`; shared modules may not import features.
- Cross-feature imports use explicit feature public entry points.
- Rust commands are transport adapters; domains own workflows; drivers own database semantics; infrastructure owns mechanisms.

## Test ownership

- Current TypeScript tests use root `tests/`; four documented colocated tests remain temporary exceptions.
- Target desktop TypeScript tests live in `apps/desktop/tests/` and mirror `apps/desktop/src/` after the desktop migration creates those paths.
- Root `tests/repository/` owns workspace/release contracts only.
- Rust unit tests use sibling `tests.rs`; crate integration tests use `src-tauri/tests/`.

## Architecture policy

Run `pnpm check:architecture` to enforce `architecture/policy.json`. The checker inventories Git-tracked files under configured source/test roots and package manifests belonging to the pnpm workspace, so arbitrary untracked, ignored, or non-workspace files are outside the policy inventory. The checker fails when:

- frontend tests are added under forbidden production roots such as `src/` unless explicitly allowlisted;
- `.spec.*` test files are introduced anywhere;
- a source file without a baseline exceeds 500 lines for TypeScript/TSX or 800 lines for Rust;
- a ratcheted file exceeds its stored line count;
- tracked workspace packages depend on another workspace package not listed in `allowedWorkspaceDependencies`;
- Rust inline test modules are added outside `rustInlineTestAllowlist`;
- root repository contract tests import desktop-private modules from paths such as `src/` or `src-tauri/`.

File-size baselines are maximum current line counts. Do not increase baselines; reduce or remove them when splitting files. If an allowlisted Rust inline test module is moved to a sibling `tests.rs` file, remove that path from `rustInlineTestAllowlist` in the same change.

## Temporary compatibility exceptions

| Exception | Owner | Reason | Removal phase |
|---|---|---|---|
| Root desktop paths | Desktop maintainers | App has not moved yet | Desktop migration |
| Root `tests/repository/` | Repository maintainers | Sole documented root test exception for workspace/release contracts; may inspect repository files but must not import desktop-private modules | Permanent repository ownership |
| Four frontend tests under `src/` | Frontend maintainers | Existing convention debt | Test normalization |
| Crate-level Rust `*_tests.rs` | Backend maintainers | Existing convention debt | Test normalization |
| Rust inline test modules listed in `architecture/policy.json` | Backend maintainers | Existing convention debt | Test normalization |
| Rust inline test modules in create-plugin templates listed in `architecture/policy.json` | Plugin tooling maintainers | Existing generated template convention debt | Test normalization |
| Oversized files listed in `architecture/policy.json` | Owning module maintainers | Guard ratchet baseline | Frontend/backend modularization |

Do not introduce new legacy exceptions. Remove existing exceptions only in the planned removal phase or with a same-change architecture update.

## Required verification

Run the narrowest relevant checks first, then run required affected checks from `AGENTS.md`:

- `pnpm test tests/utils/foo.test.ts tests/components/bar.test.tsx` or the narrowest applicable test files
- `pnpm typecheck` after TypeScript changes
- `pnpm lint` after TypeScript/React changes
- `pnpm test:rust` or the relevant `cargo test` command in `src-tauri` after Rust/backend changes
- Before pushing, creating/updating a PR, merging, tagging, or releasing: `pnpm test -- --run`, `pnpm typecheck`, `pnpm lint`, `pnpm build:plugin-api`, `pnpm check:plugin-api`, `pnpm build:create-plugin`, `pnpm smoke:create-plugin`, `pnpm build`, and `pnpm test:rust` when Rust/Tauri files changed
