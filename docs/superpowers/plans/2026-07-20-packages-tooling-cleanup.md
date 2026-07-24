# Packages and Tooling Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nexora's published packages, plugin manifest contract, workspace scripts, CI, release jobs, and distribution metadata independently verifiable after the desktop move to `apps/desktop/`, while preserving every public and runtime contract.

**Architecture:** Treat `packages/plugin-api/`, `plugins/`, `packages/create-plugin/`, and root release tooling as separate owners connected by explicit fixtures, checked-in reasoned baselines, and repository tests. `plugins/` owns shared manifest fixtures and schema documentation, not every runtime contract: JSON Schema, Rust deserialization/defaulting and projection, frontend structural/runtime handling, and create-plugin generation each retain their existing layer-specific contract. Add package-local test/typecheck/build/pack gates first, characterize those contracts without forcing convergence, then repair workspace-aware automation and remove only migration shims whose consumers have already moved.

**Tech Stack:** pnpm 10 workspaces, Node.js 24, TypeScript 5.9, Vitest 4, tsup 8, JSON Schema draft-07, Rust 2021/Serde, Cargo, Tauri 2, GitHub Actions, Snapcraft, AUR `PKGBUILD`, WinGet.

## Global Constraints

- This is the sixth plan in `docs/superpowers/plans/2026-07-20-repository-modularization-master.md`; start only after the desktop move and stabilized frontend/backend public paths are merged.
- Assume the desktop package, React source/tests/config, and Rust crate are already under `apps/desktop/`; do not reintroduce root `src/`, `tests/`, `src-tauri/`, Vite, Vitest, TypeScript, or Tauri compatibility paths.
- Preserve `@nexora/plugin-api` exports, signatures, error text, version comparison behavior, global names, slot names, runtime delegation, package entry points, peer dependency range, and package contents unless a separately versioned API change is approved.
- Preserve `@nexora/create-plugin` CLI flags, defaults, validation, console behavior, generated file tree, template substitutions, manifest defaults, JSON-RPC behavior, package bin name, and supported Node floor (`>=18.17.0`).
- No manifest fixture is globally valid or invalid. Preserve each manifest-facing layer's contract exactly as it exists when Task 2 begins: JSON Schema acceptance/rejection and `additionalProperties`; Rust Serde deserialization, aliases, defaults, unknown-field handling, and `ConfigManifest -> PluginManifest` projection; TypeScript structural assignability plus frontend runtime handling; and create-plugin output where applicable. Record per-layer expectations; never alter one layer to satisfy another in this structural batch.
- Treat `@nexora/plugin-api` source declarations, the checked-in emitted `dist/index.d.ts` as found at Task 1 start, and any declaration recovered from the published package version as read-only evidence for this structural task. Capture the emitted declaration before any build that cleans `dist`; semantic synchronization may report drift but must not rewrite declarations or change public/runtime behavior.
- Do not change SQL, database semantics, driver capabilities, command names or payloads, serialization, errors, timeouts, UI behavior, plugin JSON-RPC methods/error codes/fallbacks, or state ownership. Preserve both distinct frontend contracts: `pluginModuleLoader` rejects an unknown slot with its exact warning before invoking the supplied loader, while `PluginSlotProvider` reads and executes each UI-extension module first, silently omits an unknown slot afterward, emits no unknown-slot warning, and continues loading supported contributions.
- Preserve `@nexora/create-plugin --version` as `0.1.0` in this structural task, even if the package version differs. Preserve `--with-ui`: generate the existing UI files without adding a manifest `ui_extensions` link.
- Root contributor commands remain stable orchestration entry points even when their implementation becomes workspace-filtered. Root `test` remains multi-project Vitest orchestration and must not delegate solely to `@nexora/desktop`.
- Every publishable workspace package has one canonical staged tarball path under that package's `.tmp/`, created once from its fresh `.tmp/build` output. `pack:check`, CI artifact validation, and publication must consume that exact path and SHA256; they must never read stale checked-in `dist`, copy a different build, or repack after validation.
- Keep `pluginPackageVersion` (the `@nexora/plugin-api` package manifest version), `pluginApiVersion` (the package compatibility constant), and `hostApiVersion` (the desktop-injected host compatibility constant) as separate named values. Compare only the approved compatibility relation among those three and the registry version attached to published declaration evidence; never compare the root or desktop application release version to a plugin API version.
- Preserve behavior-only exclusions: schema/type/template reconciliation, declaration correction/versioning, SQL/driver/UI/runtime changes, and release-policy changes remain separate behavior-approved work and must not be pulled into a structural task to make a check pass.
- Keep P1, P2, and P4a independently green and mergeable where the dependency table permits; a failure or unresolved contract decision in one does not justify coupling or blocking an otherwise independent task.
- Every behavior-preserving extraction or tooling change starts with a failing test or contract assertion, then the minimal implementation, then narrow verification.
- Follow the Standard Task Gate in `docs/superpowers/plans/2026-07-20-repository-modularization-master.md`: inspect branch state, read living architecture instructions, run GitNexus upstream impact before every symbol edit, record risk, preserve unrelated user changes, and run change detection before any requested commit.
- GitNexus currently reports an incompatible LadybugDB storage version; if still true at execution time, run the foundation index-refresh task before symbol-level work. Warn and stop for HIGH or CRITICAL impact until reviewed.
- Every PR that changes commands, paths, rules, or boundaries must update the applicable `architecture/policy.json`, focused `.rules/`, living docs, complete staging paths, and any repository-test/policy `changedFiles` expectations or allowlists that enumerate those files in the same PR.
- The commit steps below are optional checkpoints. Execute them only when the user explicitly requests commits; never push, create/update a PR, merge, tag, release, or publish without explicit instruction.

---

## Pull Request Decomposition and Dependency Order

Implement each row as an independent branch/PR. Do not combine rows merely to reduce review count.

| PR | Tasks | Deliverable | Depends on | Suggested branch |
|---|---:|---|---|---|
| P1 | 1 | Independently tested, typed, built, packed plugin API with a stronger host/package sync contract | desktop move; stable host plugin API | `refactor/plugin-api-contract` |
| P2 | 2 | Shared manifest fixtures with explicit per-layer schema, Rust, TypeScript/runtime, and template expectations | frontend modularization Task 40 final plugin paths; Rust/Tauri modularization Task 8 plugin split; P1 only if fixtures import plugin API types | `test/plugin-manifest-contract` |
| P3 | 3 | Independently tested, typed, smoked, and packed create-plugin package | P2 | `test/create-plugin-package` |
| P4a | 4 | Workspace-aware version synchronization and release version tests | frontend modularization Task 40 final `apps/desktop/src/app/config/` path | `chore/workspace-versioning` |
| P4b | 5 | Workspace CI and safe npm package publication gates | P1, P3 | `ci/package-publication` |
| P4c | 6 | Tauri release and dry-run project paths, caches, and path filters | P4a; desktop move | `ci/desktop-release-paths` |
| P4d | 7 | Snap, AUR, and WinGet static/local validation | P4c | `ci/store-validation` |
| P5 | 8 | Compatibility-shim removal, final architecture guard ratchet, and living docs | P1-P4d plus frontend/backend public path migrations | `refactor/remove-migration-shims` |

P1, P2, and P4a may be developed in parallel only in isolated working copies after their external prerequisites above are final, and each branch must remain independently green. Merge one PR at a time and rebase the next branch onto the newly integrated predecessor; never merge shared-root branches concurrently. The serialized integration order is **frontend Task 40 and backend Task 8 → P1 → P2 → P3 → P4a → P4b → P4c → P4d → P5**. P1 creates the reusable registry preflight helper needed for published declaration capture; P4b wires that same tested helper into publication. After every rebase, rerun that PR's narrow checks and its complete independently green gate before merging it; arbitrary merge/rebase order is unsupported. P3 follows P2 so scaffold tests consume the approved fixture contract, P4a waits for the final frontend `app/config` path, P4b follows both package gates, P4c follows version/path stabilization, P4d follows canonical release artifact naming, and P5 is last.

## Planned File Ownership

- `packages/plugin-api/src/*`, emitted `packages/plugin-api/dist/index.d.ts`, and published package declarations: read-only contract evidence in this structural task; no desktop-private imports or declaration rewrites.
- `packages/plugin-api/tests/*`: package-local runtime, type, sync, and canonical staged-tarball contracts.
- `packages/plugin-api/scripts/stage-package.ts`: creates exactly one canonical `.tmp/package/nexora-plugin-api-<pluginPackageVersion>.tgz` from fresh `.tmp/build`, records its SHA256, and is the only pack implementation used by checks or publication.
- `packages/plugin-api/scripts/check-sync.ts`: compares normalized final host barrel plus explicit `PluginSlotProvider.tsx` host-version input against package contracts and a checked-in, reasoned drift baseline; it never rewrites declarations or updates that baseline.
- `plugins/manifest.schema.json`: JSON-level acceptance contract for external manifest files, not the universal Rust/frontend/template contract.
- `plugins/fixtures/manifests/*`: shared neutral manifest inputs consumed by per-layer characterization tests; filenames do not classify a fixture globally as valid or invalid.
- `plugins/` documentation owns shared fixture and schema authoring guidance, not every manifest-facing runtime contract.
- `apps/desktop/src/features/plugins/contracts.ts`: desktop TypeScript projection contract for manifests delivered by Rust.
- `apps/desktop/src/features/plugins/lib/pluginModuleLoader.ts`: utility-level owner of pre-load slot validation; it warns and rejects an unknown slot before invoking its supplied module loader.
- `apps/desktop/src/features/plugins/state/PluginSlotProvider.tsx`: provider-level owner of contribution filtering after module execution and explicit owner of the host API version assignment; it silently omits unknown contributions after execution and continues supported contributions.
- `apps/desktop/src-tauri/src/drivers/driver_trait.rs`, `apps/desktop/src-tauri/src/plugins/manager.rs`, and `apps/desktop/src-tauri/src/plugins/commands.rs`: current Serde contract and conversion; both callers must use one extracted pure `ConfigManifest -> PluginManifest` production conversion whose behavior remains unchanged.
- `packages/create-plugin/tests/*` and `packages/create-plugin/scripts/smoke.ts`: package-local unit/scaffold/smoke verification.
- `scripts/sync-version.js`: root-only app version orchestrator with paths anchored to the repository, not the shell working directory.
- `tests/repository/*`: static contracts for workspace scripts, workflows, release paths, publish gates, packaging metadata, and removed compatibility paths.
- `.github/workflows/*`: orchestration only; package and repository commands hold reusable validation logic.
- `architecture/policy.json`, `docs/architecture/repository-structure.md`, `AGENTS.md`, `.rules/*`: the machine and human record of current enforced state.

---

### Task 1: Make `@nexora/plugin-api` independently verifiable and strengthen contract synchronization

**Files:**
- Create: `packages/plugin-api/vitest.config.ts`
- Create: `packages/plugin-api/tests/host.test.ts`
- Create: `packages/plugin-api/tests/hooks.test.ts`
- Create: `packages/plugin-api/tests/slots.test.tsx`
- Create: `packages/plugin-api/tests/exports.test.ts`
- Create: `packages/plugin-api/tests/sync.test.ts`
- Create: `packages/plugin-api/tests/pack.test.ts`
- Create: `packages/plugin-api/tests/type-contract.test-d.ts`
- Create: `packages/plugin-api/scripts/stage-package.ts`
- Create: `packages/plugin-api/tsconfig.contract.json`
- Modify: `packages/plugin-api/package.json`
- Modify: `packages/plugin-api/tsconfig.json`
- Modify: `packages/plugin-api/scripts/check-sync.ts`
- Create: `packages/plugin-api/contracts/public-contract-baseline.json`
- Create: `scripts/npm-registry-preflight.mjs`
- Create: `tests/repository/npmRegistryPreflight.test.ts`
- Read only: `packages/plugin-api/src/index.ts`, `packages/plugin-api/src/types.ts`, `packages/plugin-api/src/hooks.ts`, `packages/plugin-api/src/host.ts`, `packages/plugin-api/src/slots.ts`, `packages/plugin-api/src/version.ts`, the pre-task `packages/plugin-api/dist/index.d.ts`, and the declaration artifact downloaded for the exact published version when one exists
- Modify: root `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `architecture/policy.json`
- Modify: `.rules/testing.md`
- Modify: `.rules/typescript.md`

**Interfaces:**
- Consumes: final desktop host barrel `apps/desktop/src/features/plugins/pluginApi.ts`; desktop host declarations reachable from that barrel; explicit host-version owner input `apps/desktop/src/features/plugins/state/PluginSlotProvider.tsx` because `__NEXORA_API_VERSION__` assignment is not reachable from the barrel; existing globals `globalThis.__NEXORA_API__?: NexoraHostApi` and `globalThis.__NEXORA_API_VERSION__?: string`.
- Produces: package scripts `test`, `typecheck`, `build`, `check:sync`, `pack:stage`, `pack:check`, and `check`; canonical package artifact `.tmp/package/nexora-plugin-api-<pluginPackageVersion>.tgz` plus `.sha256`; root scripts `test:plugin-api`, `typecheck:plugin-api`, `pack:plugin-api`; unchanged public exports `usePluginQuery`, `usePluginConnection`, `usePluginToast`, `usePluginSetting`, `usePluginTranslation`, `usePluginModal`, `usePluginTheme`, `openUrl`, `getHost`, `assertHostCompat`, `API_VERSION`, `MIN_HOST_VERSION`, `defineSlot`, and the existing exported types.
- Produces: normalized contract snapshots and `SyncComparison = { newDrift: ContractDrift[]; changedDrift: ContractDrift[]; resolvedDrift: ContractDrift[]; staleAllowlistEntries: string[]; versionMismatches: string[] }`; the host extraction receives both the barrel and explicit provider-version owner; pure functions `extractPublicContract(entryPath: string, versionOwnerPath?: string): PublicContract`, `comparePublicContracts(host: PublicContract, pkg: PublicContract, baseline: ContractBaseline): SyncComparison`, and `formatSyncFailure(result: SyncComparison): string`. `ContractBaseline` stores checked-in expected normalized differences and a narrow allowlist whose every entry has `reason`, `owner`, and `removeWhen`. Version extraction exposes exact fields `pluginPackageVersion`, `pluginApiVersion`, and `hostApiVersion`; the desktop application release version is not an input.

- [ ] **Step 1: Establish the P1 baseline and impact record**

Before any clean or build, hash and normalize the live checked-in `packages/plugin-api/dist/index.d.ts` directly, then copy it byte-for-byte to a temporary read-only path outside `dist` for later comparison. Write only its normalized contract and source hash to `packages/plugin-api/contracts/public-contract-baseline.json`; do not check in another declaration copy. `tsup` uses `clean: true`, so building first would destroy the emitted evidence this task must compare. Build only into `.tmp/build` and create only the canonical `.tmp/package` tarball so these checks never rewrite the checked-in declaration evidence. Create the tested reusable canonical-registry preflight helper specified in Task 5 now because P1 needs it for published-baseline capture; Task 5 only wires the same helper into publication. If that helper structurally confirms the exact public-registry version absent, the published comparison is `not applicable`, while every ambiguous/authentication/network/registry result stops baseline capture.

Then run:

```bash
git status --short --branch
git log --oneline -10
pnpm --filter @nexora/plugin-api check:sync
pnpm --filter @nexora/plugin-api pack --dry-run
```

Expected: current export-name sync check passes; the non-JSON dry-run package listing names only `dist`, `README.md`, `LICENSE`, and `package.json` entries; source, live pre-build emitted, and any exact-version published declarations are available as immutable baseline inputs. pnpm 10.30.3's `pack --dry-run --json` emits empty file-entry objects and must not be used as package-content evidence. Defer `pnpm --filter @nexora/plugin-api build` until tests and baseline capture are complete. Run GitNexus upstream impact for `getHost`, `assertHostCompat`, every exported hook, `defineSlot`, and any host symbol that may be touched; record callers/processes and stop on HIGH/CRITICAL risk.

- [ ] **Step 2: Write failing package runtime tests**

Create package-local tests that assert current behavior exactly:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertHostCompat, getHost } from "../src/host";
import type { NexoraHostApi } from "../src/types";

const HOST_ERROR =
  "[@nexora/plugin-api] Host API not found. This bundle is designed to run inside Nexora — the host injects window.__NEXORA_API__ at load time. If you are testing locally, run the component inside Nexora as described in the plugin guide.";

afterEach(() => {
  delete (globalThis as typeof globalThis & { __NEXORA_API__?: NexoraHostApi }).__NEXORA_API__;
  delete (globalThis as typeof globalThis & { __NEXORA_API_VERSION__?: string }).__NEXORA_API_VERSION__;
  vi.restoreAllMocks();
});

describe("getHost", () => {
  it("returns the exact injected host object", () => {
    const host = { usePluginQuery: vi.fn() } as unknown as NexoraHostApi;
    (globalThis as typeof globalThis & { __NEXORA_API__?: NexoraHostApi }).__NEXORA_API__ = host;
    expect(getHost()).toBe(host);
  });

  it("preserves the missing-host error", () => {
    expect(() => getHost()).toThrowError(HOST_ERROR);
  });
});

describe("assertHostCompat", () => {
  it.each(["0.1.0", "0.1.1", "1.0.0"])("accepts host %s", (version) => {
    (globalThis as typeof globalThis & { __NEXORA_API_VERSION__?: string }).__NEXORA_API_VERSION__ = version;
    expect(() => assertHostCompat("0.1.0")).not.toThrow();
  });

  it("preserves the older-host error", () => {
    (globalThis as typeof globalThis & { __NEXORA_API_VERSION__?: string }).__NEXORA_API_VERSION__ = "0.0.9";
    expect(() => assertHostCompat("0.1.0")).toThrowError(
      "[@nexora/plugin-api] Host version 0.0.9 is older than required 0.1.0. Please update Nexora.",
    );
  });
});
```

In `hooks.test.ts`, inject a complete mock `NexoraHostApi`, invoke every wrapper, and assert the exact function arguments and returned object/promise identity. In `slots.test.tsx`, assert `defineSlot("data-grid.toolbar.actions", Component)` returns exactly `{ __slot: "data-grid.toolbar.actions", component: Component }`. In `exports.test.ts`, import `* as api` and assert `Object.keys(api).sort()` equals the current runtime export list.

- [ ] **Step 3: Write failing type and package-content tests**

In `type-contract.test-d.ts`, encode representative existing contracts without adding a type-test dependency:

```ts
import type { ComponentType } from "react";
import {
  defineSlot,
  type NexoraHostApi,
  type TypedSlotProps,
  type UIExtensionDeclaration,
} from "../src";

const component: ComponentType<TypedSlotProps<"data-grid.context-menu.items">> = () => null;
const slot = defineSlot("data-grid.context-menu.items", component);
const declaration: UIExtensionDeclaration = {
  slot: slot.__slot,
  module: "ui/dist/index.js",
  order: 10,
  driver: "example",
};
const host: NexoraHostApi = {} as NexoraHostApi;
void declaration;
void host;
```

Add `pack.test.ts` as a read-only consumer of `.tmp/package/nexora-plugin-api-<pluginPackageVersion>.tgz` and its `.sha256`: verify the digest, list the existing tarball with `tar -tzf`, extract it, verify the digest again, and assert this exact normalized set. The test must not run any pack/build/prepack command, create a second tarball, or clean/rewrite the checked-in `dist/index.d.ts`:

```ts
expect(entries.sort()).toEqual([
  "package/LICENSE",
  "package/README.md",
  "package/dist/index.d.ts",
  "package/dist/index.js",
  "package/package.json",
]);
```

It must also extract `package/package.json` and assert `main`, `types`, `exports`, `files`, `sideEffects`, `peerDependencies.react`, and `publishConfig.access` are unchanged.

- [ ] **Step 4: Add scripts and run tests to confirm the independent gates fail**

Add these scripts before implementation:

```json
{
  "scripts": {
    "test": "vitest run --exclude tests/pack.test.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.contract.json",
    "build": "tsup --out-dir .tmp/build",
    "check:sync": "tsx scripts/check-sync.ts",
    "pack:stage": "tsx scripts/stage-package.ts",
    "pack:check": "vitest run tests/pack.test.ts",
    "check": "pnpm run check:sync && pnpm run test && pnpm run typecheck && pnpm run build && pnpm run pack:stage && pnpm run pack:check",
    "clean": "rm -rf .tmp",
    "prepublishOnly": "pnpm run check"
  }
}
```

Configure `vitest.config.ts` with Node environment and `include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]`. Keep the production `tsconfig.json` `rootDir: "src"`. Add a real `tsconfig.contract.json` with `noEmit: true`, strict bundler resolution, the required React/DOM libs, and only the `.test-d.ts` compile contract; positive assignments and `@ts-expect-error` diagnostics must be accepted by `tsc`. Vitest transpilation is not type-contract evidence. Split ordinary tests from artifact creation and inspection: `pack:stage` deletes only `.tmp/package`, requires fresh `.tmp/build/index.js` and `.tmp/build/index.d.ts`, copies package metadata plus that build into a temporary pack root, runs one lifecycle-suppressed low-level pack, atomically moves the result to `.tmp/package/nexora-plugin-api-<pluginPackageVersion>.tgz`, and writes its SHA256 beside it. `pack:check` is read-only: it requires that exact tarball and checksum, verifies the hash before and after extraction, and never invokes build, pack, or `prepack`. Neither step reads or mutates checked-in `dist/index.d.ts`; publication later uploads this same tarball path/hash rather than repacking.

Run:

```bash
pnpm --filter @nexora/plugin-api test
pnpm --filter @nexora/plugin-api typecheck
pnpm --filter @nexora/plugin-api pack:check
```

Expected: runtime/type tests initially expose unconfigured package testing or declaration drift; `pack:check` fails until `build` and `pack:stage` have created the canonical tarball/checksum. The stage helper, not `pack:check`, owns the sole lifecycle-suppressed/low-level pack operation, so inspection cannot recurse or silently repack. Add stale-output tests that remove or backdate `.tmp/build`, seed a conflicting checked-in `dist`, and mutate the staged tarball after hashing; all must fail rather than falling back to `dist` or creating another artifact. Do not weaken assertions to make the current implementation pass.

- [ ] **Step 5: Replace export-name-only sync with normalized semantic comparison against a reasoned baseline**

Refactor `check-sync.ts` into exported pure parsing/comparison functions plus a read-only CLI guard. The parser must collect:

```ts
export type PublicSymbolKind = "value" | "type";

export interface PublicSymbol {
  name: string;
  kind: PublicSymbolKind;
  declaration: string;
}

export interface PublicContract {
  symbols: Map<string, PublicSymbol>;
  pluginPackageVersion: string | null;
  pluginApiVersion: string | null;
  hostApiVersion: string | null;
}

export interface ContractBaselineEntry {
  key: string;
  host: PublicSymbol | null;
  package: PublicSymbol | null;
  reason: string;
  owner: string;
  removeWhen: string;
}
```

Use TypeScript's compiler API from the package's existing `typescript` dependency to resolve re-exports and normalize call signatures, interfaces, type aliases, overloads, and constant literal types. Build `packages/plugin-api/contracts/public-contract-baseline.json` once from the observed contracts, review each difference, and retain only entries with a concrete reason, owner, and removal condition. Named package-only exports such as `getHost`, `assertHostCompat`, `API_VERSION`, `MIN_HOST_VERSION`, and typed-slot helpers/types belong in the same reasoned baseline/allowlist rather than an unreviewed hardcoded exception.

The check compares current normalized host and package source with the reasoned baseline's immutable normalized emitted/published contract records captured before build. Build output produced during the check is never an input. It must fail, without writing files, on:

- a new host/package difference absent from the baseline;
- a changed normalized declaration for a baselined difference;
- a previously baselined difference that is now resolved but whose entry remains;
- an allowlist entry that no longer matches a current symbol/difference;
- value/type kind, overload, parameter, return, property optionality, or literal-union drift;
- source/emitted/published declaration drift for the same package version;
- mismatch among `pluginPackageVersion`, `pluginApiVersion`, and `hostApiVersion` under the currently approved package compatibility relation, or between a downloaded declaration's registry version and `pluginPackageVersion`; root `package.json` and `apps/desktop/package.json` application versions are never parsed or compared by this check.

Add focused tests for unchanged baselined drift and every failure category (`new`, `changed`, `resolved`, `stale allowlist`, and `version`). Add `tests/repository/npmRegistryPreflight.test.ts` now with the exact absence/presence and fatal-case matrix specified in Task 5 so baseline capture and publication share one tested classifier, and include that repository suite in the P1 gate below. Include temporary-copy tests that mutate one declaration in the captured checked-in emitted contract; independently vary `pluginPackageVersion`, `pluginApiVersion`, and `hostApiVersion`; and set unrelated root/desktop app versions to arbitrary semvers. The first four mutations must fail as applicable, while app-version changes must not affect comparison. Failure output names the baseline key, symbol, exact version field, and normalized expected/actual declarations; exit `1` on any category and `0` only when the observed normalized contract and three plugin-version values exactly match the checked-in baseline. The CLI must never rewrite source/emitted/published declarations, run a declaration build, or create/update the baseline. Host API version comparison receives `apps/desktop/src/features/plugins/state/PluginSlotProvider.tsx` as an explicit parser input rather than assuming the assignment is exported through `apps/desktop/src/features/plugins/pluginApi.ts`.

- [ ] **Step 6: Verify and document drift without changing declarations**

Treat all `@nexora/plugin-api` source, emitted, and published declarations as read-only. For each observed difference, either match an existing reasoned baseline entry or add a reviewed baseline/allowlist entry containing the exact normalized contracts, reason, owner, and removal condition. Do not align package declarations to host internals, add/remove exports, change versions, regenerate `dist/index.d.ts`, silently ignore symbols, or auto-accept updated snapshots. Any declaration correction is a separately versioned API task outside this structural plan.

- [ ] **Step 7: Add root package orchestration and publication-safe lifecycle ordering**

Add root aliases while retaining existing names:

```json
{
  "scripts": {
    "test:plugin-api": "pnpm --filter @nexora/plugin-api test",
    "typecheck:plugin-api": "pnpm --filter @nexora/plugin-api typecheck",
    "build:plugin-api": "pnpm --filter @nexora/plugin-api build",
    "check:plugin-api": "pnpm --filter @nexora/plugin-api check:sync",
    "pack:plugin-api": "pnpm --filter @nexora/plugin-api pack:stage && pnpm --filter @nexora/plugin-api pack:check"
  }
}
```

Run:

```bash
pnpm test tests/repository/npmRegistryPreflight.test.ts -- --run
pnpm --filter @nexora/plugin-api check
pnpm test:plugin-api
pnpm typecheck:plugin-api
pnpm build:plugin-api
pnpm check:plugin-api
pnpm pack:plugin-api
```

Expected: every command exits `0`; the canonical-registry preflight classifier is green in P1; package tests do not require `apps/desktop` test configuration; `check:sync` always runs before any clean/build and still uses the pre-build emitted evidence; `pack:plugin-api` validates the one canonical `.tmp/package` tarball and SHA256 produced from `.tmp/build`; packed files remain the five expected entries; no public export, declaration, baseline, or behavior changes.

- [ ] **Step 8: Update living package-contract documentation**

Document that `packages/plugin-api/` owns package-local tests/typecheck/build/stage/pack inspection; normalized desktop/package source/emitted/published declarations are checked read-only against a reasoned baseline; intentional package-only/host-only differences are explicit; `pluginPackageVersion`, `pluginApiVersion`, and `hostApiVersion` are separate while app versions are excluded; stale, resolved, changed, new, and version drift all fail without baseline mutation; root aliases remain supported. Update `AGENTS.md` required checks to include `pnpm test:plugin-api`, `pnpm typecheck:plugin-api`, and `pnpm pack:plugin-api` when package/public-host contracts change.

- [ ] **Step 9: Review P1 and optionally commit**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: only P1 files changed. If a commit was explicitly requested, run GitNexus `detect_changes({ scope: "all" })`, inspect `git diff`, then:

```bash
git add packages/plugin-api scripts/npm-registry-preflight.mjs tests/repository/npmRegistryPreflight.test.ts package.json pnpm-lock.yaml docs/architecture/repository-structure.md AGENTS.md architecture/policy.json .rules/testing.md .rules/typescript.md
git commit -m "test: harden plugin api package contract"
```

---

### Task 2: Establish shared plugin manifest compatibility fixtures without changing behavior

**Files:**
- Create: `plugins/fixtures/manifests/minimal-driver.json`
- Create: `plugins/fixtures/manifests/full-driver.json`
- Create: `plugins/fixtures/manifests/ui-only.json`
- Create: `plugins/fixtures/manifests/aliases.json`
- Create: `plugins/fixtures/manifests/unknown-capability.json`
- Create: `plugins/fixtures/manifests/unknown-slot.json`
- Create: `tests/repository/manifest-fixtures.ts`
- Create: `tests/repository/pluginManifestSchema.test.ts`
- Create: `apps/desktop/tests/features/plugins/pluginManifestContract.test-d.ts`
- Create: `apps/desktop/tsconfig.plugin-contract.json`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/tests/features/plugins/lib/pluginModuleLoader.test.ts`
- Modify: `apps/desktop/tests/features/plugins/state/PluginSlotProvider.test.tsx`
- Retain as test-module aggregator and add `mod manifest;`: `apps/desktop/src-tauri/src/plugins/tests.rs`
- Create: `apps/desktop/src-tauri/src/plugins/tests/manifest.rs`
- Modify only to extract and route both existing callers through one behavior-identical pure conversion: `apps/desktop/src-tauri/src/plugins/manager.rs`, `apps/desktop/src-tauri/src/plugins/commands.rs`
- Read only in this structural task: `plugins/manifest.schema.json`
- Read only in this structural task: `apps/desktop/src/features/plugins/contracts.ts`
- Read only in this structural task: `apps/desktop/src/features/plugins/lib/pluginModuleLoader.ts`
- Read only in this structural task: `apps/desktop/src/features/plugins/state/PluginSlotProvider.tsx`
- Read only in this structural task: `packages/create-plugin/templates/rust-driver/manifest.json.tmpl`
- Create: `docs/architecture/baselines/plugin-manifest-compatibility.md`
- Modify: `.agents/skills/nexora-plugin-driver/references/manifest-checklist.md`
- Modify: `plugins/PLUGIN_GUIDE.md`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `architecture/policy.json`
- Modify: root `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `AGENTS.md`
- Modify: `.rules/testing.md`
- Modify: `.rules/typescript.md`
- Modify: `.rules/rust.md`

**Interfaces:**
- Consumes: JSON Schema `plugins/manifest.schema.json`; Rust `ConfigManifest`, `DriverCapabilities`, `PluginManifest`, `PluginSettingDefinition`, `UIExtensionEntry`; TypeScript `PluginManifest`, `DriverCapabilities`, `PluginSettingDefinition`, `UIExtensionManifestEntry`; create-plugin manifest template.
- Produces: versioned neutral fixture paths under `plugins/fixtures/manifests/`; root command `pnpm test:plugin-contract`; repository helper `loadManifestFixture(name: ManifestFixtureName): unknown`; no new runtime manifest API.
- Produces a per-layer expectation matrix. `accept`, `reject`, `project`, `skip`, and `not applicable` describe only the named layer; no row gives a fixture a global validity label:

| Fixture | JSON Schema expectation | Rust deserialization/defaulting | Rust -> frontend projection | TypeScript structural/runtime expectation | Create-plugin output |
|---|---|---|---|---|---|
| `minimal-driver.json` | reject root `$schema` with `additionalProperties` | record parse result and exact defaults | record exact projected fields | record assignability of projected shape | render current template, including root `$schema`, and compare normalized identity fields |
| `full-driver.json` | reject every applicable unsupported root and `/capabilities` property with separate `additionalProperties` diagnostics | record parse result, preserved fields, defaults, and ignored unknowns | record the exact frontend-visible subset | record assignability and runtime handling of projected fields | not applicable |
| `ui-only.json` | report missing root `executable` and `data_types`, plus unsupported root `ui_extensions` when present | record current `executable: None` behavior and defaults | record manifest-only projection | record current projected-shape handling | not applicable |
| `aliases.json` | accept schema spellings `connectionString` and `connectionStringExample`; report Rust-only aliases as schema errors | record each Serde alias/default result | record canonical projected property names | record structural handling of projected canonical fields | not applicable |
| `unknown-capability.json` | reject the unknown key at `/capabilities` with `additionalProperties` | record whether Serde ignores the unknown capability while preserving known/defaulted fields | record that unknown input is absent from the projection | record only the actual projected shape | not applicable |
| `unknown-slot.json` | reject root `ui_extensions` with `additionalProperties`; slot-name schema validation is not applicable | record string deserialization unchanged | record slot string unchanged | utility contract: reject and warn before invoking `moduleLoader`; provider contract: read/execute grouped modules, then silently omit unknown contributions and continue supported contributions | not applicable |

- [ ] **Step 1: Inventory and freeze the existing manifest acceptance matrix**

Read and compare the exact current files listed above. Build a field table in the PR notes with JSON Schema required/default/alias rules, Rust Serde defaults/aliases, TypeScript optionality, and template output for every core field, capability, setting, data type, and UI extension. Include currently observed divergences such as schema-required `executable` versus Rust UI-only support, schema capabilities versus Rust/TS capabilities, camelCase aliases, and schema slot coverage. Classify each divergence as:

```text
A: runtime-compatible and schema should describe it
B: intentionally layer-specific and must be documented
C: behavioral/API decision requiring a separate future design
```

This structural task freezes and documents A, B, and C exactly as observed. It must not resolve any divergence. Any schema/type/template correction—even one believed to describe existing runtime behavior—requires a separate behavior-approved contract-alignment design after this modularization program.

- [ ] **Step 2: Add shared neutral JSON fixture inputs**

Populate fixtures with concrete current values. `minimal-driver.json` mirrors the generated rust-driver template after placeholder replacement for a network plugin, including its root `$schema`; template equivalence is its own matrix column rather than proof of validity elsewhere. The current schema has root `additionalProperties: false` and declares neither `$schema` nor `ui_extensions`; freeze that divergence. `full-driver.json` exercises every observed property/capability, one setting of each represented type, two data types, and `ui_extensions` entries with/without `order` and `driver`; it intentionally exposes every applicable root and `/capabilities` additional-property diagnostic. `ui-only.json` omits `executable` and `data_types` and retains `ui_extensions` when needed to record all three schema failures. `aliases.json` isolates schema-supported `connectionString` and `connectionStringExample` from Rust-only aliases so every spelling's result is explicit. `unknown-capability.json` and `unknown-slot.json` each isolate one unknown value without unrelated malformed data. For `unknown-slot`, the schema only rejects unsupported root `ui_extensions`; it cannot validate the slot name. Do not use `valid`, `invalid`, `accepted`, or `rejected` in fixture names or global fixture groupings.

- [ ] **Step 3: Write the JSON Schema column of the expectation matrix**

Create `tests/repository/manifest-fixtures.ts` with `export type ManifestFixtureName = "minimal-driver" | "full-driver" | "ui-only" | "aliases" | "unknown-capability" | "unknown-slot"` and `export function loadManifestFixture(name: ManifestFixtureName): unknown`, resolving from the repository root. Add a repository test using pinned AJV draft-07 with `{ strict: false, allErrors: true }`; `strict: false` only selects compatibility with the existing schema and must not disable validation keywords. Normalize every AJV error into `{ keyword, instancePath, property }`, where `property` comes from offending-property `params` such as `additionalProperty` or `missingProperty`, and assert arrays rather than one first error:

```ts
type SchemaDiagnostic = {
  keyword: string;
  instancePath: string;
  property: string;
};

type SchemaExpectation =
  | { accepted: true; errors: [] }
  | { accepted: false; errors: SchemaDiagnostic[] };

const schemaExpectations = {
  "minimal-driver": {
    accepted: false,
    errors: [{ keyword: "additionalProperties", instancePath: "", property: "$schema" }],
  },
  "full-driver": {
    accepted: false,
    errors: fullDriverUnsupportedRootProperties.map((property) => ({
      keyword: "additionalProperties",
      instancePath: "",
      property,
    })).concat(fullDriverUnsupportedCapabilities.map((property) => ({
      keyword: "additionalProperties",
      instancePath: "/capabilities",
      property,
    }))),
  },
  "ui-only": {
    accepted: false,
    errors: [
      { keyword: "required", instancePath: "", property: "executable" },
      { keyword: "required", instancePath: "", property: "data_types" },
      { keyword: "additionalProperties", instancePath: "", property: "ui_extensions" },
    ],
  },
  "aliases": aliasesFixtureExpectation,
  "unknown-capability": {
    accepted: false,
    errors: [{ keyword: "additionalProperties", instancePath: "/capabilities", property: "unknown_capability" }],
  },
  "unknown-slot": {
    accepted: false,
    errors: [{ keyword: "additionalProperties", instancePath: "", property: "ui_extensions" }],
  },
} satisfies Record<ManifestFixtureName, SchemaExpectation>;
```

Define `fullDriverUnsupportedRootProperties`, `fullDriverUnsupportedCapabilities`, and `aliasesFixtureExpectation` from the concrete fixture keys established in Step 2; none may be an empty or inferred-at-runtime expected list. Name the isolated unknown capability `unknown_capability` as shown, or update both fixture and expected literal together before review. `full-driver` must assert all applicable root and `/capabilities` diagnostics, not a representative subset. `aliases` must use named subcases beside the fixture-level table so `connectionString`, `connectionStringExample`, and every Rust-only alias are independently proven. For every rejected case, assert `normalizeAjvErrors(validate.errors)` exactly equals the expected array after deterministic sorting; never accept one matching diagnostic while dropping others.

Step 1 verifies these exact booleans and diagnostics against the frozen fixture contents before the test is committed. If fixture construction reveals an additional earlier diagnostic, make the fixture isolate the named property without changing its intended data, then record every remaining diagnostic in the compatibility baseline; never modify another layer to make this schema column green.

Run:

```bash
pnpm test tests/repository/pluginManifestSchema.test.ts -- --run
```

Expected: PASS while explicitly recording current schema rejections, including the exact JSON pointer and keyword in `docs/architecture/baselines/plugin-manifest-compatibility.md`.

- [ ] **Step 4: Write the Rust deserialization/defaulting and projection columns**

Retain `apps/desktop/src-tauri/src/plugins/tests.rs` as the canonical sibling test-module aggregator and add `mod manifest;`; do not replace or flatten the aggregator and do not put tests inline in production modules. Put the new manifest fixture/deserialization/projection tests in `apps/desktop/src-tauri/src/plugins/tests/manifest.rs`. Load every neutral fixture with explicit literals such as `include_str!("../../../../../../plugins/fixtures/manifests/minimal-driver.json")`; confirm and use the exact relative prefix from the new nested `tests/manifest.rs` location for every named fixture. Use an explicit fixture-to-expectation table for parse success/failure; for successful parses assert:

- `minimal-driver` defaults and field preservation;
- every `full-driver` capability, setting type/default/options, data type, and UI extension field that Rust currently retains, plus any unknown fields it currently ignores;
- `ui-only` yielding `executable == None` and current defaults;
- each snake_case/camelCase alias result and default value independently of schema acceptance;
- `unknown-capability` preserving known/defaulted capabilities while retaining or ignoring the unknown key exactly as Serde does today;
- `unknown-slot` preserving the slot string during deserialization;
- one production pure `project_plugin_manifest(config: ConfigManifest) -> PluginManifest` conversion preserving exactly the frontend-visible subset without starting a plugin process, including canonicalized aliases and omitted wire-only fields.

Extract that conversion in `apps/desktop/src-tauri/src/plugins/manager.rs`, route both `load_plugin_from_dir` and `get_plugin_manifest` through it, and test the production function from `apps/desktop/src-tauri/src/plugins/tests/manifest.rs`, loaded through the retained `plugins/tests.rs` aggregator. Do not duplicate the projection struct literal in tests or either caller. Verify the nested fixture prefix with the compiler rather than reusing the aggregator's old relative depth.

Run:

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests -- --nocapture
```

Expected: PASS with current accepted and rejected Rust shapes asserted exactly; no JSON-RPC subprocess is launched.

- [ ] **Step 5: Write the TypeScript structural and frontend-runtime columns**

In `apps/desktop/tests/features/plugins/pluginManifestContract.test-d.ts`, distinguish raw config fixtures from Rust-projected frontend manifests. Use `satisfies PluginManifest` only for exact currently assignable projected forms; use `@ts-expect-error` at each non-assignable expression, and define a test-local `ConfigManifestFixture` for wire-only inputs rather than weakening `PluginManifest` or coercing with `as`. Create `apps/desktop/tsconfig.plugin-contract.json` as a strict `noEmit` compiler project that includes this file and the final `apps/desktop/src/features/plugins/contracts.ts`. Add the exact desktop package script `"typecheck:plugin-contract": "tsc --noEmit -p tsconfig.plugin-contract.json"` to `apps/desktop/package.json`; neither a root-only alias nor an approximate command satisfies this gate. Vitest transpilation alone is insufficient and no runtime test may stand in for compiler diagnostics.

Characterize both intentionally different frontend contracts without changing either implementation. In `apps/desktop/tests/features/plugins/lib/pluginModuleLoader.test.ts`, assert `loadUIExtensionModule` validates an unknown slot before invoking `moduleLoader`, calls `console.warn` once with the exact existing `[PluginSlot] ... declares unknown slot ... Skipping.` text, returns `null`, and leaves the loader uncalled; also retain the mixed valid/invalid batch result. In `apps/desktop/tests/features/plugins/state/PluginSlotProvider.test.tsx`, cover the provider's separate complete mixed-slot workflow: a manifest contains one unknown-slot entry and one supported entry in separately observable modules; assert both files are read and both module bodies execute before contribution filtering, no unknown-slot warning is emitted, the supported contribution remains visible, and only the unknown contribution is omitted. The utility's warn-before-load contract must not be used to rewrite the provider's execute-then-silent-filter contract, or vice versa.

Run:

```bash
pnpm --filter @nexora/desktop typecheck:plugin-contract
pnpm --filter @nexora/desktop test tests/features/plugins/lib/pluginModuleLoader.test.ts tests/features/plugins/state/PluginSlotProvider.test.tsx -- --run
pnpm --filter @nexora/desktop typecheck
```

Expected: PASS with compiler-proven positive assignments and expected diagnostics, the utility's exact warn-before-load/no-loader-call behavior, and the provider's execute-then-silent-omit/continue behavior. Do not coerce fixtures with `as PluginManifest`, suppress the utility warning, or add a provider unknown-slot warning.

- [ ] **Step 6: Write the create-plugin template characterization assertion**

Render `manifest.json.tmpl` using the existing `scaffold()` path into a temporary directory, normalize only generated identity values, and compare the resulting object to `minimal-driver.json`, including the root `$schema`. Separately record the generated object's JSON Schema rejection for root `$schema`, Rust parse/default/projection result, and TypeScript projected-shape result in the expectation matrix. Do not require generated manifests to become schema-valid, do not add a generated `ui_extensions` link for `--with-ui`, and do not change the template or another layer to force convergence. Keep this assertion in the repository contract test for P2; Task 3 will add package-local scaffold coverage.

Run:

```bash
pnpm test tests/repository/pluginManifestSchema.test.ts -- --run
```

Expected: PASS while asserting the template's exact current fields/defaults and recording every mismatch against schema, Rust, or TypeScript in the compatibility baseline.

- [ ] **Step 7: Publish the compatibility matrix without correcting contracts**

Write `docs/architecture/baselines/plugin-manifest-compatibility.md` with one row per fixture and field/alias/default, and separate columns for JSON Schema, Rust deserialization/defaulting, Rust-to-frontend projection, TypeScript structural handling, frontend runtime handling, and create-plugin output when applicable. State the invariant that no fixture is globally valid/invalid and that a green matrix means each layer still matches its own recorded contract, not that layers agree. Give every divergence an owner (`future plugin-contract alignment`), reason, and removal phase (`separate behavior-approved design`). Add architecture-policy checks that the fixtures and baseline exist. Do not edit the schema, Rust manifest model, TypeScript manifest types/runtime loader, or template in this task.

- [ ] **Step 8: Add the root contract command and verify every layer**

Add:

```json
{
  "scripts": {
    "test:plugin-contract": "pnpm test tests/repository/pluginManifestSchema.test.ts -- --run && pnpm --filter @nexora/desktop typecheck:plugin-contract && pnpm --filter @nexora/desktop test tests/features/plugins/lib/pluginModuleLoader.test.ts tests/features/plugins/state/PluginSlotProvider.test.tsx -- --run && cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml plugins::tests"
  }
}
```

Run:

```bash
pnpm test:plugin-contract
pnpm --filter @nexora/desktop typecheck
pnpm lint
```

Expected: every independent layer test is green because each neutral fixture reproduces that layer's documented acceptance, rejection, defaulting, projection, or skip result; the utility warns before load while the provider executes then silently filters; no cross-layer convergence, schema/runtime behavior, template output, or public shape change occurs. Update `AGENTS.md` and `.rules/testing.md`, `.rules/typescript.md`, and `.rules/rust.md` in this same step to list the new desktop compiler script, frontend utility/provider test paths, retained Rust aggregator plus `plugins/tests/manifest.rs`, exact root suite command, independent P2 gate, and mandatory staging paths.

- [ ] **Step 9: Update manifest-facing living documentation**

Update the plugin guide and manifest checklist from the per-layer matrix. Link to `plugins/manifest.schema.json` and `plugins/fixtures/manifests/`; distinguish schema-required driver fields from Rust UI-only support; list aliases/defaults as layer-specific compatibility behavior, not preferred authoring style. Document `plugins/` as owner of shared fixtures, schema, and their authoring docs—not Rust Serde/defaulting, frontend projection/runtime handling, package declarations, or generated-template behavior. Remove duplicated stale field/method names rather than claiming a universal source of truth.

- [ ] **Step 10: Review P2 and optionally commit**

Run `git diff --check`, narrow tests above, GitNexus change detection, and inspect changed flows. If explicitly requested:

```bash
git add plugins/fixtures apps/desktop/package.json apps/desktop/tests/features/plugins/pluginManifestContract.test-d.ts apps/desktop/tsconfig.plugin-contract.json apps/desktop/tests/features/plugins/lib/pluginModuleLoader.test.ts apps/desktop/tests/features/plugins/state/PluginSlotProvider.test.tsx apps/desktop/src-tauri/src/plugins/manager.rs apps/desktop/src-tauri/src/plugins/commands.rs apps/desktop/src-tauri/src/plugins/tests.rs apps/desktop/src-tauri/src/plugins/tests/manifest.rs tests/repository/manifest-fixtures.ts tests/repository/pluginManifestSchema.test.ts package.json pnpm-lock.yaml architecture/policy.json docs/architecture/baselines/plugin-manifest-compatibility.md docs/architecture/repository-structure.md plugins/PLUGIN_GUIDE.md .agents/skills/nexora-plugin-driver/references/manifest-checklist.md AGENTS.md .rules/testing.md .rules/typescript.md .rules/rust.md
git commit -m "test: define plugin manifest compatibility fixtures"
```

---

### Task 3: Make `@nexora/create-plugin` independently testable, smokeable, and packable

**Files:**
- Create: `packages/create-plugin/tests/scaffold.test.ts`
- Create: `packages/create-plugin/tests/cli.test.ts`
- Create: `packages/create-plugin/tests/pack.test.ts`
- Create: `packages/create-plugin/scripts/stage-package.ts`
- Modify: `packages/create-plugin/tests/validate.test.ts`
- Modify: `packages/create-plugin/tests/substitute.test.ts`
- Modify: `packages/create-plugin/scripts/smoke.ts`
- Modify: `packages/create-plugin/src/cli.ts`
- Modify only if testability requires preserving behavior through injection: `packages/create-plugin/src/scaffold.ts`, `packages/create-plugin/src/print.ts`
- Modify: `packages/create-plugin/package.json`
- Modify: `packages/create-plugin/tsconfig.json`
- Create: `packages/create-plugin/tsconfig.test.json`
- Modify: `packages/create-plugin/vitest.config.ts`
- Modify: `packages/create-plugin/README.md`
- Modify: root `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `architecture/policy.json`
- Modify: `.rules/testing.md`
- Modify: `.rules/typescript.md`

**Interfaces:**
- Consumes: Task 2 fixtures/schema; existing `ScaffoldOptions`, `scaffold(opts: ScaffoldOptions): void`, CLI flags, template tree, `PLUGIN_API_VERSION`, `MIN_NEXORA_VERSION` behavior.
- Produces: exported testable `runCli(argv: string[], io?: CliIo, dependencies?: CliDependencies): number` with `CliIo = { stdout(text: string): void; stderr(text: string): void }`, while the bin entry still calls it and exits identically; package scripts `test`, `typecheck`, `build`, `smoke`, `pack:stage`, `pack:check`, `check`; canonical artifact `.tmp/package/nexora-create-plugin-<packageVersion>.tgz` plus `.sha256`; root scripts `test:create-plugin`, `typecheck:create-plugin`, `pack:create-plugin`.
- Produces: smoke modes `--skip-cargo` for fast CI/static packaging validation and default full Cargo validation; neither is part of the published CLI.

- [ ] **Step 1: Establish P3 baseline and impact record**

Run:

```bash
pnpm --filter @nexora/create-plugin test
pnpm --filter @nexora/create-plugin build
pnpm --filter @nexora/create-plugin smoke
pnpm --filter @nexora/create-plugin pack --dry-run
```

Expected: current unit/build/smoke pass from the package; record the current packed file set from the non-JSON dry-run because pnpm 10.30.3 JSON dry-run file entries are empty. Run upstream impact for `scaffold`, `buildVars` if modified, validation functions, substitution functions, and CLI entry behavior.

- [ ] **Step 2: Add failing scaffold matrix tests**

For `network`, `file`, `folder`, and `api`, scaffold into a fresh temp directory with `gitInit: false`. Assert:

- exact expected file tree for Rust-only and `withUi: true` variants;
- no `.tmpl` suffix remains;
- no unresolved uppercase `${VAR}` remains, while `${context.tableName}` and GitHub `${{ ... }}` syntax survive;
- `manifest.json` parses, preserves root `$schema`, records Task 2's expected root `additionalProperties` schema rejection rather than requiring schema validity, and has the exact capability/default tuple for each `DbType`;
- `Cargo.toml`, binary name, `justfile`, and UI package dependency are consistent; `withUi: true` generates the existing UI files but does not add a manifest `ui_extensions` module link;
- non-empty target directory remains rejected with the current error;
- missing template remains rejected with the current error.

Run:

```bash
pnpm --filter @nexora/create-plugin test -- tests/scaffold.test.ts
```

Expected: FAIL until package tests can consume schema/fixtures and any untested branches are exposed.

- [ ] **Step 3: Extract a behavior-preserving testable CLI boundary and write CLI tests**

Before changing `src/cli.ts`, add tests for `--help`, `--version`, missing name, invalid `--db-type`, invalid `--quote`, valid `--with-ui --no-git --dir`, and existing exit codes/output channels. Then extract:

```ts
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface CliDependencies {
  scaffold(options: ScaffoldOptions): void;
  cliVersion: string;
  packageVersion: string;
  pluginApiVersion: string;
  minNexoraVersion: string;
}

export function runCli(
  argv: string[],
  io: CliIo = defaultCliIo,
  dependencies: CliDependencies = defaultCliDependencies,
): number;
```

Keep a small entry guard that invokes `runCli(process.argv.slice(2))` and sets `process.exitCode`/exits exactly as before. Route existing print functions through `CliIo` without changing text or color behavior for the default implementation. Define the coherent compatibility contract atomically: `--version` reads a dedicated source constant `CLI_VERSION = "0.1.0"` (in the current CLI version owner, or a focused `src/version.ts` if extraction is needed), while `packageVersion`, `pluginApiVersion`, and `minNexoraVersion` remain independently named dependencies for package metadata/template substitution. `--version` must never derive from package metadata. Tests must prove direct `runCli(["--version"])` and the extracted canonical tarball both print exactly `0.1.0`, changing only `packageVersion` does not alter output, and changing injected `cliVersion` updates output atomically without reading a stale duplicate. Preserve existing `PLUGIN_API_VERSION` and `MIN_NEXORA_VERSION` sources without introducing a runtime workspace dependency or filesystem assumption.

Run:

```bash
pnpm --filter @nexora/create-plugin test -- tests/cli.test.ts
```

Expected: PASS with byte-for-byte existing user-facing text and exit codes; `--version` remains `0.1.0`.

- [ ] **Step 4: Strengthen the smoke script around generated projects**

Refactor `scripts/smoke.ts` into small functions:

```ts
export interface SmokeOptions {
  skipCargo: boolean;
  keepTemp: boolean;
}

export function runSmoke(options: SmokeOptions): void;
```

Keep default behavior running `cargo check --quiet`. Cover all four database kinds; run UI checks for one network and one non-network case. For UI output run `pnpm install --ignore-workspace --frozen-lockfile=false` and `pnpm run build` only in full smoke when network access is explicitly available; default CI should instead validate its package JSON, TypeScript source, Vite config, and expected package API version without an unpinned install. Always clean temporary directories in `finally`, unless `--keep-temp` is explicitly passed to the smoke script.

- [ ] **Step 5: Add package tarball tests**

Build only into `.tmp/build`. `scripts/stage-package.ts` deletes only `.tmp/package`, requires fresh staged CLI output, copies only publication inputs into a temporary pack root, runs `pnpm pack --config.ignore-scripts=true` exactly once, atomically places the result at `.tmp/package/nexora-create-plugin-<packageVersion>.tgz`, and writes its SHA256. `pack:check` takes that exact tarball/checksum as read-only input, verifies the hash before and after extraction, never invokes build/pack/prepack, and asserts:

- `package/dist/cli.js` exists and starts with `#!/usr/bin/env node`;
- all rust-driver and ui-extension template files are included;
- source/tests/scripts/node_modules are excluded;
- extracted `package.json` retains `bin.nexora-create-plugin = "./dist/cli.js"`, `engines.node = ">=18.17.0"`, public access, and expected files;
- execute the extracted tarball's `dist/cli.js --version` and scaffold one `--no-git` project from extracted templates.

Run:

```bash
pnpm --filter @nexora/create-plugin pack:check
```

Expected: FAIL until lifecycle/build/stage ordering creates the canonical artifact and checksum; PASS only by inspecting that existing path, with no tarball creation inside the test.

- [ ] **Step 6: Add independent typecheck/build/test/smoke/pack scripts**

Create the listed `tsconfig.test.json` so tests and scripts are typechecked independently from the production `rootDir: "src"`. Package scripts become:

```json
{
  "scripts": {
    "test": "vitest run --exclude tests/pack.test.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "build": "tsup --out-dir .tmp/build",
    "smoke": "tsx scripts/smoke.ts",
    "smoke:static": "tsx scripts/smoke.ts --skip-cargo",
    "pack:stage": "tsx scripts/stage-package.ts",
    "pack:check": "vitest run tests/pack.test.ts",
    "check": "pnpm run test && pnpm run typecheck && pnpm run build && pnpm run smoke && pnpm run pack:stage && pnpm run pack:check",
    "prepublishOnly": "pnpm run check"
  }
}
```

Add `tsconfig.test.json` explicitly with `extends: "./tsconfig.json"`, `noEmit: true`, `rootDir: "."`, `types: ["node", "vitest/globals"]`, `include: ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts", "vitest.config.ts", "tsup.config.ts"]`, and `exclude: ["dist", ".tmp", "node_modules", "templates"]`. Keep non-pack tests separate from `pack:check`; only `pack:stage` performs a lifecycle-suppressed pack, and `pack:check` is pure artifact inspection. Seed stale `dist`, omit/backdate `.tmp/build`, mutate the tarball after checksum creation, and assert each case fails rather than falling back or repacking.

Add root aliases:

```json
{
  "scripts": {
    "test:create-plugin": "pnpm --filter @nexora/create-plugin test",
    "typecheck:create-plugin": "pnpm --filter @nexora/create-plugin typecheck",
    "build:create-plugin": "pnpm --filter @nexora/create-plugin build",
    "smoke:create-plugin": "pnpm --filter @nexora/create-plugin smoke",
    "pack:create-plugin": "pnpm --filter @nexora/create-plugin pack:stage && pnpm --filter @nexora/create-plugin pack:check"
  }
}
```

- [ ] **Step 7: Verify P3 independently**

Run:

```bash
pnpm --filter @nexora/create-plugin test
pnpm --filter @nexora/create-plugin typecheck
pnpm --filter @nexora/create-plugin build
pnpm --filter @nexora/create-plugin smoke
pnpm --filter @nexora/create-plugin pack:stage
pnpm --filter @nexora/create-plugin pack:check
pnpm test:create-plugin
pnpm typecheck:create-plugin
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm pack:create-plugin
```

Expected: all exit `0`; every generated Rust project passes `cargo check`; extracted canonical packed CLI scaffolds successfully; direct and tarball `--version` remain `0.1.0` from the single `cliVersion` source independent of package/API/host versions; `--with-ui` still generates UI files without adding manifest `ui_extensions`; all other public CLI and generated behavior remains unchanged.

- [ ] **Step 8: Update package ownership docs and optionally commit**

Document independent package gates, canonical `.tmp/build` → one `.tmp/package/*.tgz` artifact flow, and the distinction between static and Cargo smoke. Update `AGENTS.md` required package checks. After diff review and GitNexus change detection, commit only if explicitly requested:

```bash
git add packages/create-plugin package.json pnpm-lock.yaml docs/architecture/repository-structure.md AGENTS.md architecture/policy.json .rules/testing.md .rules/typescript.md
git commit -m "test: make create plugin independently verifiable"
```

---

### Task 4: Make application version synchronization workspace-aware and cwd-independent

**Files:**
- Create: `tests/repository/versionSync.test.ts`
- Create: `scripts/version-sync.js`
- Modify: `scripts/sync-version.js`
- Modify: root `package.json`
- Modify through the real sync command only when correcting existing drift: `apps/desktop/package.json`
- Modify through the real sync command only when correcting existing drift; tests use temp copies: `apps/desktop/src/app/config/version.ts`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/Cargo.lock`, root `README.md`, root `CHANGELOG.md`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `architecture/policy.json`
- Modify: `.rules/general.md`

**Interfaces:**
- Consumes: root release version from root `package.json`, which remains the application release version source; desktop paths under `apps/desktop/`. Plugin package/API/host versions are unrelated and must never be synchronized by this task.
- Produces: `syncVersions(options?: SyncVersionOptions): SyncVersionResult` where `SyncVersionOptions = { repoRoot?: string; version?: string; check?: boolean }` and `SyncVersionResult = { version: string; changedFiles: string[]; mismatches: string[] }`; focused pure `parseRootNexoraLock(text: string): { version: string; start: number; end: number }` and `updateRootNexoraLock(text: string, version: string): string`; CLI flags `--check`, `--version <semver>`, `--repo-root <path>` for repository tooling only. Without `--version`, synchronize mirrors from root `package.json`; with `--version`, atomically update the root source and every mirror in one rollback-capable transaction.
- Preserves: npm/pnpm lifecycle `version` behavior, changelog generation, README release URL/file-name rewrites, Cargo lock synchronization, and public application version values.

- [ ] **Step 1: Write failing temp-repository version tests**

Create a temporary fixture repository containing only root `package.json`, `README.md`, and desktop version files. Import the pure sync function and assert:

- invocation from a nested/unrelated cwd still resolves from `import.meta.url` or explicit `repoRoot`;
- `--version 1.2.3` atomically updates source `package.json` first in memory and commits it together with mandatory mirror `apps/desktop/package.json`, `tauri.conf.json`, the root `[package]` version in Cargo.toml only, only the root workspace package entry `[[package]] name = "nexora"` in Cargo.lock through the focused parser/updater, `APP_VERSION`, README download tag, and exact `Nexora_1.2.3_` file names; any parse, validation, or write failure restores every original file;
- unrelated dependency versions, workspace package versions, checksums/sources, and non-root or duplicate-name Cargo.lock package entries remain byte-for-byte unchanged; missing or ambiguous root `nexora` entries reject atomically without writes;
- a second run is idempotent with `changedFiles: []`, and `changedFiles` exactly lists every written target in deterministic repository-relative order;
- `--check` parses and compares both Cargo.toml and Cargo.lock, reports mismatches, performs no writes, and never invokes Cargo;
- write mode updates all text files atomically, then runs `cargo metadata --manifest-path apps/desktop/src-tauri/Cargo.toml --offline --locked --no-deps --format-version 1` only as validation; if metadata fails, restore every original file and exit non-zero;
- invalid/non-semver `--version`, `--check --version` together, or a missing value exits non-zero without writes; tests explicitly prove the CLI contract and root-source rollback.

Run:

```bash
pnpm test tests/repository/versionSync.test.ts -- --run
```

Expected: FAIL because current script is cwd-relative, not importable, and still points to root desktop paths.

- [ ] **Step 2: Extract the pure workspace-aware synchronizer**

Create `scripts/version-sync.js` for the importable pure functions and keep `scripts/sync-version.js` as a thin CLI adapter that parses flags, rejects `--check --version`, calls `syncVersions`, prints the current messages, and sets the exit code. A supplied `--version` is the only mode allowed to change root `package.json`; ordinary synchronization reads it, and check mode is always read-only. Use `node:fs`, `node:path`, and `node:url`; remove comments that merely narrate numbered statements while preserving necessary release-contract documentation. Resolve defaults from:

```js
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(SCRIPT_DIR, "..");
```

Use exact desktop targets:

```js
const targets = {
  rootPackage: "package.json",
  desktopPackage: "apps/desktop/package.json",
  tauri: "apps/desktop/src-tauri/tauri.conf.json",
  cargo: "apps/desktop/src-tauri/Cargo.toml",
  cargoLock: "apps/desktop/src-tauri/Cargo.lock",
  appVersion: "apps/desktop/src/app/config/version.ts",
  readme: "README.md",
};
```

`desktopPackage` is a mandatory application-version mirror. In `--check`, parse Cargo.toml and Cargo.lock directly and compare the root `nexora` package versions without spawning Cargo or writing. In write mode, use the focused parser to identify the root workspace `nexora` lock entry from exact package name plus root workspace identity, replace only its `version` value while preserving all other bytes, write all intended mirrors as one rollback-capable transaction, and then run offline locked metadata validation. Do not use `cargo update --locked`—that combination cannot update a lockfile—and do not use Cargo at all in check mode. Tests exercise the pure parser/updater on temporary text and inject the metadata runner only to prove invocation, rollback, and arguments. Never regex-replace the entire lockfile or run unrestricted `cargo check`.

- [ ] **Step 3: Repair the root lifecycle script and staged paths**

Keep the root `version` lifecycle entry point but replace every old path with `apps/desktop/...`. Ensure the `git add` list includes only generated release-version files and does not stage unrelated work:

```json
"version": "node scripts/sync-version.js && conventional-changelog -p angular -i CHANGELOG.md -s && git add README.md CHANGELOG.md apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src/app/config/version.ts"
```

Keep `apps/desktop/package.json` in both synchronization and staging; it is a mandatory mirror.

- [ ] **Step 4: Verify check mode against the real repository without writing**

Run:

```bash
node scripts/sync-version.js --check
pnpm test tests/repository/versionSync.test.ts -- --run
```

Expected: check mode exits `0` when all version files match current root version; tests pass and leave `git status` unchanged. If current files are inconsistent before this task, fix only path/version synchronization in this PR and document the exact mismatch.

- [ ] **Step 5: Update release docs and optionally commit**

Document the app version source, synchronized targets, cwd-independent invocation, and `--check` gate. If explicitly requested after change detection:

```bash
git add scripts/version-sync.js scripts/sync-version.js tests/repository/versionSync.test.ts package.json apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src/app/config/version.ts README.md CHANGELOG.md docs/architecture/repository-structure.md AGENTS.md architecture/policy.json .rules/general.md
git commit -m "chore: make version sync workspace aware"
```

---

### Task 5: Split workspace CI gates and make npm publication verify exact package artifacts

**Files:**
- Create: `tests/repository/packageWorkflows.test.ts`
- Modify: `scripts/npm-registry-preflight.mjs`
- Modify: `tests/repository/npmRegistryPreflight.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/npm-publish.yml`
- Modify: root `package.json`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `architecture/policy.json`
- Modify: `.rules/testing.md`

**Interfaces:**
- Consumes: Task 1 package gates, Task 3 package gates, desktop root aliases created by the move, existing `ENABLE_STORE_PUBLISH` guard and npm credentials/provenance strategy.
- Produces: CI jobs `repository`, `desktop`, `plugin-api`, `create-plugin`, `rust`; npm publish workflow that runs package-local `check`, inspects the canonical artifacts those checks created, and publishes only those explicitly selected public-package tarball paths.
- Preserves: root command names, package names/versions, registry, `publishConfig.access`, manual publish trigger unless a separate release policy already approved tag publication.

- [ ] **Step 1: Write failing workflow contract tests**

Parse workflow text/YAML in `tests/repository/packageWorkflows.test.ts` and assert:

- CI has distinct package jobs, each installs once and runs that package's `test`, `typecheck`, `build`, and pack/sync/smoke gates;
- desktop commands execute through root aliases or `pnpm --filter @nexora/desktop`, never a removed root app script implementation;
- Rust cache workspace is `apps/desktop/src-tauri`;
- npm publish runs each package's canonical `check` suite, then consumes the two already-created canonical `.tmp/package/*.tgz` paths and `.sha256` files, verifies those same hashes/content, runs the tested registry preflight for both package/version pairs, and publishes those exact paths without copying, rebuilding, or repacking package directories;
- no command uses `npm`/`yarn`, `src-tauri`, or root `src/` as an app path;
- `ENABLE_STORE_PUBLISH == 'true'`, least-privilege permissions, `registry-url`, and secret/OIDC mechanism remain explicit.

Run:

```bash
pnpm test tests/repository/packageWorkflows.test.ts -- --run
```

Expected: FAIL on monolithic frontend job, missing package tests/typechecks/pack checks, and stale Rust path.

- [ ] **Step 2: Split CI into independently diagnosable jobs**

Use a consistent setup in each Node job: checkout, pnpm 10.30.3, Node 24.x with pnpm cache, frozen install. Configure:

```text
repository: pnpm check:architecture; pnpm test:repository -- --run; pnpm test tests/repository/npmRegistryPreflight.test.ts -- --run
 desktop: pnpm test:desktop -- --run; pnpm typecheck; pnpm lint; pnpm build
 plugin-api: pnpm --filter @nexora/plugin-api check
create-plugin: pnpm --filter @nexora/create-plugin check
rust: pnpm test:rust
```

If full create-plugin Cargo smoke is too expensive in the package job, keep `pnpm smoke:create-plugin` as its own job and never replace it with only `smoke:static`. Use `cache-dependency-path: pnpm-lock.yaml`; use `Swatinem/rust-cache` `workspaces: apps/desktop/src-tauri`.

- [ ] **Step 3: Harden npm publication without changing package APIs**

In `.github/workflows/npm-publish.yml`:

1. install frozen dependencies;
2. run `pnpm --filter @nexora/plugin-api check`;
3. run `pnpm --filter @nexora/create-plugin check`;
4. take the canonical tarball paths and `.sha256` files created by those checks—`packages/plugin-api/.tmp/package/nexora-plugin-api-<pluginPackageVersion>.tgz` and `packages/create-plugin/.tmp/package/nexora-create-plugin-<packageVersion>.tgz`—as immutable workflow inputs; do not run another pack command or copy them to a differently named artifact;
5. run `sha256sum --check` on each sidecar, record the digest in step outputs, list each exact `.tgz` with `tar -tzf`, validate extracted metadata/content, then re-hash and assert the digest is unchanged;
6. run `node scripts/npm-registry-preflight.mjs --package "$PACKAGE_NAME@$PACKAGE_VERSION"` for both packages and complete both checks before publication;
7. immediately before each publish, re-hash the same path and compare it with the validated step output, then run `pnpm publish "$TARBALL" --provenance --access public --no-git-checks`; never pass package directories or filters that repack;
8. retain `NODE_AUTH_TOKEN` only on publish steps if OIDC is not enabled and document why; never expose it to build, test, tarball validation, or preflight.

Reuse and, only if workflow integration needs it, extend P1's `scripts/npm-registry-preflight.mjs`; do not create a second classifier. The dependency-free helper has an injectable process runner and returns `{ status: "absent" | "present"; packageName: string; version: string }`. It must force `https://registry.npmjs.org/`, create/use an empty temporary npm config, remove token/auth environment variables, request machine-readable exact package/version metadata, apply a timeout, and accept absence only when the structured response unambiguously identifies the canonical public registry and the exact requested package/version as absent. A matching version means `present` and fails publication. Ambiguous generic E404, E401, E403, E429, malformed/missing fields, timeout, DNS/TLS/proxy errors, registry mismatch, and every other failure are fatal.

In `tests/repository/npmRegistryPreflight.test.ts`, inject responses for exact absence, exact presence, ambiguous E404, E401/E403/E429, malformed JSON, timeout, DNS, TLS, proxy, and wrong-registry output. Assert only exact public-registry absence returns `absent`, no token/auth environment reaches the runner, and temporary npm config cleanup runs. The workflow contract test must prove both preflights finish before either publish step and that each publish consumes the same `.tgz` path whose hash/content was validated. Keep publication manual and guarded by `ENABLE_STORE_PUBLISH` unless the approved release policy says otherwise.

- [ ] **Step 4: Add a no-publish local verification entry point**

Add root script:

```json
"check:packages": "pnpm --filter @nexora/plugin-api check && pnpm --filter @nexora/create-plugin check"
```

Run:

```bash
pnpm check:packages
pnpm test tests/repository/packageWorkflows.test.ts tests/repository/npmRegistryPreflight.test.ts -- --run
```

Expected: all pass; tests inject registry responses and publish nothing; canonical package checks create one tarball/hash per package, and local inspection uses the exact immutable paths and digests publication would consume.

- [ ] **Step 5: Validate workflow syntax and optionally commit**

Run the workflow contract tests plus the repository workflow linter command documented by the foundation plan; if the foundation records no workflow linter, the contract tests and commands below are the complete local syntax/static gate:

```bash
git diff --check
pnpm test tests/repository/packageWorkflows.test.ts tests/repository/npmRegistryPreflight.test.ts -- --run
pnpm check:packages
```

Expected: PASS. If explicitly requested after GitNexus change detection:

```bash
git add .github/workflows/ci.yml .github/workflows/npm-publish.yml scripts/npm-registry-preflight.mjs tests/repository/packageWorkflows.test.ts tests/repository/npmRegistryPreflight.test.ts package.json AGENTS.md docs/architecture/repository-structure.md architecture/policy.json .rules/testing.md
git commit -m "ci: verify workspace packages independently"
```

---

### Task 6: Repair Tauri release and dry-run paths, caches, and change filters

**Files:**
- Modify: `tests/repository/releaseWorkflow.test.ts`
- Modify: `tests/repository/releaseDryRunWorkflow.test.ts`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/release-dry-run.yml`
- Modify only if root aliases do not already support the action: root `package.json`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `architecture/policy.json`
- Modify: `.rules/testing.md`

**Interfaces:**
- Consumes: Tauri action input `projectPath: apps/desktop`; desktop `tauriScript` selected by the move; desktop app paths and version sync from Task 4.
- Produces: release and dry-run actions that build from `apps/desktop`, cache `apps/desktop/src-tauri`, and trigger on all files capable of changing a native artifact.
- Preserves: tag/manual release behavior, draft creation/publish sequence, matrix bundles (universal DMG, amd64 DEB, NSIS), updater signing, release asset naming, updater JSON behavior, and workflow-artifact naming.

- [ ] **Step 1: Write failing release workflow contracts**

Assert both workflows contain:

```yaml
with:
  projectPath: apps/desktop
```

for `tauri-apps/tauri-action`, and Cargo cache:

```yaml
with:
  workspaces: apps/desktop/src-tauri
```

Assert dry-run `paths` includes at least:

```text
.github/workflows/release.yml
.github/workflows/release-dry-run.yml
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
apps/desktop/package.json
apps/desktop/src/**
apps/desktop/public/**
apps/desktop/src-tauri/**
apps/desktop/vite.config.*
apps/desktop/tsconfig*.json
scripts/sync-version.js
scripts/version-sync.js
CHANGELOG.md
roadmap.json
apps/desktop/index.html
apps/desktop/postcss.config.*
```

Assert neither workflow contains stale root `src/version.ts` or `src-tauri/` entries.

Run:

```bash
pnpm test tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts -- --run
```

Expected: FAIL on missing `projectPath`, stale cache workspace, and stale path filters.

- [ ] **Step 2: Configure the release action for the nested desktop project**

For every Tauri action use:

```yaml
with:
  projectPath: apps/desktop
  tauriScript: pnpm tauri
  args: ${{ matrix.args }}
```

Retain `releaseId` in release and workflow artifact inputs in dry-run. Confirm whether the post-move desktop package owns `@tauri-apps/cli`; if it remains root-owned, use an explicit root script that runs `pnpm --filter @nexora/desktop tauri` and set `tauriScript` accordingly. Do not rely on the action installing a global CLI.

- [ ] **Step 3: Repair caches and path filters**

Set Node cache dependency path to root `pnpm-lock.yaml` when needed. Set Rust cache workspace to `apps/desktop/src-tauri`. Replace every moved source/config/version path in dry-run filters. The tested minimum is the complete list in Step 1, including both version scripts, `CHANGELOG.md`, `roadmap.json`, `apps/desktop/index.html`, and `apps/desktop/postcss.config.*`; include package/plugin inputs only if they are part of the desktop build graph. Keep filters broad enough that any Tauri/frontend/build/config/release-metadata input change triggers all three dry-run platforms.

- [ ] **Step 4: Preserve artifact and updater contracts in tests**

Add assertions that release still has:

```text
macOS: --target universal-apple-darwin --bundles dmg
Linux: --bundles deb
Windows: --bundles nsis
```

Dry-run must add `--config {"bundle":{"createUpdaterArtifacts":false}}`, while release must not disable updater artifacts. Release must preserve signing env names and upload to the existing `releaseId`; dry-run must preserve `uploadWorkflowArtifacts: true` and artifact pattern. Assert exact release artifact casing `Nexora_<version>_amd64.deb` and `Nexora_<version>_x64-setup.exe`; lowercase `snap/nexora.deb` exists only as the intentionally renamed local Snap input.

- [ ] **Step 5: Run static validation and document the remote dry-run gate**

Run:

```bash
pnpm test tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts -- --run
pnpm test:repository -- --run
```

Expected: PASS with the canonical repository-owned release suites `tests/repository/releaseWorkflow.test.ts` and `tests/repository/releaseDryRunWorkflow.test.ts`, exact-cased release assets `Nexora_<version>_amd64.deb` and `Nexora_<version>_x64-setup.exe`, and no duplicate/legacy suite names. A local machine cannot faithfully execute macOS/Windows hosted-runner packaging, so PR completion requires the `Release dry run` workflow to complete successfully on macOS, Ubuntu, and Windows before merge. If the user explicitly asks to create/update the PR, run the full local release gate first, trigger/observe the workflow with `gh`, and do not report completion while any matrix leg fails.

- [ ] **Step 6: Optionally commit P4c**

After diff review and change detection, only when requested:

```bash
git add .github/workflows/release.yml .github/workflows/release-dry-run.yml tests/repository/releaseWorkflow.test.ts tests/repository/releaseDryRunWorkflow.test.ts package.json docs/architecture/repository-structure.md AGENTS.md architecture/policy.json .rules/testing.md
git commit -m "ci: target nested desktop release project"
```

---

### Task 7: Add local/static validation for Snap, AUR, and WinGet publication

**Files:**
- Create: `scripts/validate-distribution.mjs`
- Create: `tests/repository/distributionPackaging.test.ts`
- Modify: root `package.json`
- Modify: `.github/workflows/snap.yml`
- Modify: `.github/workflows/aur.yml`
- Modify: `.github/workflows/winget.yml`
- Modify only to correct proven metadata/path defects: `snap/snapcraft.yaml`, `aur/PKGBUILD`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `architecture/policy.json`
- Modify: `.rules/testing.md`

**Interfaces:**
- Consumes: release artifact names from Task 6, `snap/snapcraft.yaml`, `aur/PKGBUILD`, WinGet identifier `Nexora.Nexora`, store-publish guard, release/manual workflow inputs.
- Produces: root command `pnpm validate:distribution`; CLI `node scripts/validate-distribution.mjs [--version 1.2.3] [--deb-name Nexora_1.2.3_amd64.deb] [--windows-name Nexora_1.2.3_x64-setup.exe]`; no store submission.
- Preserves: store identifiers, secrets, publication guard, stable channels, AUR package name, Snap name, and release asset semantics.

- [ ] **Step 1: Write failing static package/workflow tests**

Add tests that assert:

- Snap workflow writes the downloaded DEB to the filename referenced by `parts.nexora.source` (`snap/nexora.deb` in both places), updates a valid quoted semver, builds from `path: snap`, and only publishes behind `ENABLE_STORE_PUBLISH`;
- AUR workflow derives version deterministically for its actual trigger, references exact release DEB `Nexora_<version>_amd64.deb`, writes `pkgver` and SHA256 into `aur/PKGBUILD`, and does not use `force_push: true` without a documented necessity;
- `PKGBUILD` has `pkgname=nexora-bin`, `arch=('x86_64')`, an SPDX-compatible Apache license declaration, release URL source (not an unresolvable bare local name), and matching checksum array;
- WinGet workflow targets a published release or accepts an explicit `release-tag` for manual dispatch, keeps `Nexora.Nexora`, and its installer regex matches the actual NSIS asset name from Task 6;
- all store workflows keep secrets only on publish steps and have least-privilege permissions.

Run:

```bash
pnpm test tests/repository/distributionPackaging.test.ts -- --run
```

Expected: FAIL on AUR local-only source/metadata issues and WinGet dispatch ambiguity; the Snap assertion should pass for the current `curl ... -o snap/nexora.deb`, `path: snap`, and package-relative `source: nexora.deb` tuple, and will protect that working relationship during cleanup.

- [ ] **Step 2: Implement dependency-free distribution validation**

Create `scripts/validate-distribution.mjs` using Node built-ins. Export:

```js
export function validateDistribution(options = {}) {
  return { errors: [], warnings: [] };
}
```

Validate YAML/PKGBUILD through focused line/key parsing rather than building a general parser. Checks must include file existence, Snap source filename consistency, package names/identifiers, release asset regex matches against representative names, semver substitution, AUR source URL/version/checksum placeholders, action guard presence, and stale root desktop paths. Exit `1` with one line per error; exit `0` and print a concise success summary otherwise.

- [ ] **Step 3: Correct only proven Snap/AUR/WinGet contract defects**

Keep the currently consistent Snap tuple that downloads exact release asset `Nexora_<version>_amd64.deb` but intentionally renames it with `curl ... -o snap/nexora.deb`, action `path: snap`, and package-relative `source: nexora.deb`; change it only if the test proves a real defect. For AUR, make `source` a versioned URL for exact-cased `Nexora_<version>_amd64.deb` while preserving the downloaded DEB package contents and `package()` behavior; set `license=('Apache-2.0')` if current AUR tooling accepts it. Remove force push unless required by the action/AUR history and documented. For WinGet manual dispatch, add a required `release-tag` input and pass it to the action, or restore a `release: types: [released]` trigger; choose the policy already approved for store publication, not a new release policy.

- [ ] **Step 4: Add non-publishing validation steps to workflows/CI**

Add `pnpm validate:distribution` to CI/repository checks for metadata changes. Store workflows may run the same command before any credential-bearing step. Do not invoke `canonical/action-publish`, AUR deploy, or WinGet submission in validation jobs.

- [ ] **Step 5: Run local validation and available native validators**

Run:

```bash
pnpm validate:distribution
pnpm test tests/repository/distributionPackaging.test.ts -- --run
```

Expected: PASS. If available in the execution environment, additionally run:

```bash
snapcraft expand-extensions snap/snapcraft.yaml
bash -n aur/PKGBUILD
```

Expected: Snapcraft accepts metadata/extension expansion; shell syntax check exits `0`. If Snapcraft or Arch tooling is unavailable, record that exact tool absence and rely on repository tests plus the guarded workflow dry run; do not claim an actual store publish was validated.

- [ ] **Step 6: Document artifact-to-store data flow and optionally commit**

Document: Tauri release creates DEB/NSIS; Snap consumes the amd64 DEB; AUR wraps the same DEB with checksum; WinGet consumes the published NSIS; validation never publishes. If explicitly requested after change detection:

```bash
git add scripts/validate-distribution.mjs tests/repository/distributionPackaging.test.ts package.json .github/workflows/snap.yml .github/workflows/aur.yml .github/workflows/winget.yml snap/snapcraft.yaml aur/PKGBUILD docs/architecture/repository-structure.md AGENTS.md architecture/policy.json .rules/testing.md
git commit -m "ci: validate distribution package contracts"
```

---

### Task 8: Remove migration compatibility shims, tighten final guards, and finish living documentation without deleting active contract baselines

**Files:**
- Modify: `tests/repository/workspaceLayout.test.ts`
- Modify: `tests/repository/rootCommands.test.ts`
- Create or modify: `tests/repository/noLegacyDesktopPaths.test.ts`
- Modify: `architecture/policy.json`
- Modify: `scripts/check-architecture.mjs`
- Delete only after zero-consumer proof: root desktop compatibility files/directories left by the move, crate-private (`pub(crate)`/private) temporary aliases or re-exports explicitly recorded as migration shims, and resolved migration/file-size baseline entries; externally public compatibility facades remain preserved contracts even with zero local consumers, and the plugin API contract baseline and manifest per-layer compatibility baseline are active structural contracts and are not cleanup candidates
- Modify: root `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/architecture/repository-structure.md`
- Modify: `AGENTS.md`
- Modify: `.rules/general.md`
- Modify: `.rules/testing.md`
- Modify: `.rules/typescript.md`
- Modify: `.rules/rust.md`
- Modify only when stale path checks require it: `.github/workflows/*.yml`, `scripts/*`, `plugins/*.md`, `packages/*/README.md`

**Interfaces:**
- Consumes: all P1-P4 deliverables, final target layout, temporary exception table and compatibility-shim inventory from earlier plans.
- Produces: hard architecture rules with no old desktop roots, no temporary package/path aliases, package-owned checks, root orchestration only, and docs that describe current enforced state.
- Preserves: supported root contributor command names (`dev`, `build`, `test`, `typecheck`, `lint`, `test:rust`, `tauri`, package checks) as orchestration commands and every externally public compatibility facade; removes only path shims and crate-private API shims explicitly marked temporary and proven unused.

- [ ] **Step 1: Inventory every compatibility layer and prove zero consumers**

From `docs/architecture/repository-structure.md` and `architecture/policy.json`, enumerate each temporary alias, re-export, old path, migration allowlist, and file-size baseline. Exclude `packages/plugin-api/contracts/public-contract-baseline.json`, its reasoned package-only/host-only entries, and `docs/architecture/baselines/plugin-manifest-compatibility.md`: they remain required until a separately approved contract change updates them through review. For every actual cleanup candidate, run content search and GitNexus upstream impact. Record:

```text
shim/path | reason introduced | current consumers | replacement | removal proof
```

Classify every symbol facade by visibility before considering removal. Zero repository consumers is sufficient only for private or `pub(crate)` migration shims; any `pub` Rust item reachable from the crate's external API, exported TypeScript/package symbol, documented plugin alias, or other externally public compatibility facade remains even when local search reports zero consumers. Do not delete a root command that is the supported contributor interface; rewrite it as workspace orchestration. Do not remove public package exports or plugin manifest aliases under the label of cleanup.

- [ ] **Step 2: Write failing no-legacy-path and final-policy tests**

Tests must recursively scan tracked repository text while excluding `.git`, `.gitnexus`, generated output, plans/spec historical documents, and fixture files intentionally containing old paths. Fail on active references to:

```text
/src-tauri
src-tauri/
/src/version.ts
src/pluginApi.ts
root Vite/Vitest/desktop tsconfig paths
apps/desktop/src/version.ts
apps/desktop/src/pluginApi.ts
apps/desktop/src/types/plugins.ts
apps/desktop/src/utils/pluginModuleLoader.ts
apps/desktop/src/contexts/PluginSlotProvider.tsx
root app asset/config paths
```

Allow `apps/desktop/src-tauri` and historical plan prose. Assert workspace includes `apps/*` and `packages/*`; root package is private/orchestration-only; package public entry points are package-owned; root `dev`, `build`, `typecheck`, `lint`, `test:rust`, and `tauri` delegate appropriately, while root `test` remains multi-project Vitest orchestration rather than delegating solely to `@nexora/desktop`; repository CI runs `pnpm test:repository -- --run` and desktop CI runs `pnpm test:desktop -- --run`; temporary exception lists are empty or contain only approved non-migration exceptions with owners/reasons.

Run:

```bash
pnpm test tests/repository/noLegacyDesktopPaths.test.ts tests/repository/workspaceLayout.test.ts tests/repository/rootCommands.test.ts -- --run
pnpm check:architecture
```

Expected: FAIL and list every remaining active compatibility reference.

- [ ] **Step 3: Remove one proven shim category at a time**

Use `git rm` for obsolete compatibility files and focused edits for crate-private aliases. After each category (root app config, root source alias, crate-private backend shim, workflow path, script path, docs path), rerun the exact failing test. Never combine removal with public API redesign, and never infer external unuse from zero local consumers. If a consumer remains, migrate that consumer in the PR that owns it and rerun impact before deletion; if a facade is externally public, preserve it and record it in the compatibility inventory regardless of local consumer count.

- [ ] **Step 4: Tighten architecture policy and remove only resolved migration/file-size baselines**

Update policy to enforce:

- desktop-private code only under `apps/desktop/`;
- repository tests under `tests/repository/` cannot import desktop-private implementation;
- `packages/plugin-api` cannot import `apps/desktop` or `packages/create-plugin`;
- `packages/create-plugin` may consume published plugin contract metadata/fixtures only through approved test/dev paths, never desktop internals;
- root scripts are repository orchestration and cannot own app behavior;
- root desktop command aliases must use explicit workspace filters/directories and must not invoke the same root script recursively; root `test` must preserve multi-project Vitest orchestration, with separate `test:repository` and `test:desktop` entry points;
- old desktop roots are forbidden;
- package tests stay under their package;
- resolved migration/file-size baseline and allowlist entries are deleted rather than set to permissive values; active semantic-sync and per-layer manifest compatibility baselines remain checked in and may change only through their reasoned review process.

Update `scripts/check-architecture.mjs` error text to name the violated boundary and replacement path.

- [ ] **Step 5: Make living docs describe only current enforced state**

Update the canonical architecture doc, concise `AGENTS.md`, and focused rules. Remove completed migration instructions and temporary aliases. Retain a short decision record for preserved public contracts and root command orchestration. Update README development/build commands only to supported root aliases; links to package/plugin docs remain valid. Ensure `.gitignore` tracks canonical docs/architecture/fixtures and does not accidentally hide them.

- [ ] **Step 6: Run the complete package/tooling verification gate**

Run narrow checks first:

```bash
pnpm test:repository -- --run
pnpm test tests/repository/npmRegistryPreflight.test.ts -- --run
pnpm check:architecture
pnpm test:plugin-contract
pnpm --filter @nexora/plugin-api check
pnpm --filter @nexora/create-plugin check
pnpm validate:distribution
node scripts/sync-version.js --check
```

Expected: PASS; no legacy path findings; packed artifacts unchanged; every manifest-facing layer matches its own matrix column; generated plugins compile; distribution metadata validates.

Then run the full CI-equivalent gate required by `AGENTS.md`:

```bash
pnpm test -- --run
pnpm test:repository -- --run
pnpm test:desktop -- --run
pnpm --filter @nexora/desktop typecheck:plugin-contract
pnpm typecheck
pnpm lint
pnpm test:plugin-api
pnpm typecheck:plugin-api
pnpm build:plugin-api
pnpm check:plugin-api
pnpm pack:plugin-api
pnpm test:create-plugin
pnpm typecheck:create-plugin
pnpm build:create-plugin
pnpm smoke:create-plugin
pnpm pack:create-plugin
pnpm build
pnpm test:rust
```

Expected: every command exits `0`. These are the canonical final local suites: repository plus registry preflight; desktop plus the exact plugin-contract compiler gate; plugin contract across schema/utility/provider/Rust; both package checks against canonical staged artifacts; distribution; version check; and Rust. Do not substitute similarly named legacy suites, lowercase release artifacts, or an untested registry probe. Fix failures and rerun the failed command, then rerun the full affected set. Do not report completion with failures.

- [ ] **Step 7: Run release/distribution remote gates before any requested PR update**

If the user explicitly requests push or PR creation/update, run the full local gate, then ensure `Release dry run` succeeds on macOS, Linux, and Windows. Run store workflow validation jobs without publish secrets/actions. Do not tag, release, publish npm packages, submit Snap/AUR/WinGet, or enable store publication as part of this structural plan.

- [ ] **Step 8: Review final changed-flow scope and optionally commit**

Run GitNexus change detection against `main`. Expected: package contract tests, workspace tooling, CI/release, packaging, guards, and docs are affected; application runtime, SQL, driver semantics, plugin RPC, and UI processes are not behaviorally changed.

Then:

```bash
git diff --check
git status --short
git diff --stat
git diff --name-status main...HEAD
```

Expected: only planned cleanup files, with deletes limited to proven shims. If explicitly requested:

```bash
git add -A architecture scripts tests/repository package.json pnpm-workspace.yaml .gitignore README.md docs/architecture AGENTS.md .rules .github packages plugins apps/desktop
git commit -m "refactor: finalize workspace tooling boundaries"
```

## Completion Criteria

- `@nexora/plugin-api` independently runs runtime tests, type contracts, read-only normalized host/source/emitted/published semantic sync against a checked-in reasoned baseline, fresh `.tmp/build`, one canonical `.tmp/package` tarball plus SHA256, and read-only exact-artifact validation without desktop test configuration; sync separates plugin package/API/host versions, excludes app versions, fails on new, changed, resolved, stale-allowlist, and version drift, and never rewrites declarations or its baseline.
- Shared neutral manifest fixtures characterize separate JSON Schema, Rust Serde/default/alias, production Rust projection, compiler-proven TypeScript structural, utility warn-before-load, provider execute-then-silent-filter, and generated-template contracts; no fixture is globally valid/invalid, no layer is altered to satisfy another, and both intentionally different frontend contracts remain exact.
- `@nexora/create-plugin` independently runs unit/CLI/scaffold tests, typecheck, fresh staged build, full Cargo smoke, one canonical tarball/hash, and non-recursive read-only packed-CLI smoke while keeping `--version` at `0.1.0` from one dedicated source independent of package/API/host versions, preserving `--with-ui` without a manifest link, and preserving every other CLI/template/public behavior.
- Version synchronization is anchored to repository/workspace paths, treats root `package.json` as source and `apps/desktop/package.json` as mandatory mirror, atomically updates the source plus mirrors for `--version`, parses Cargo files with no Cargo process in check mode, uses a focused root-`nexora` lock parser/updater followed only by offline locked metadata validation in write mode, rolls back failures, and is idempotent.
- CI diagnoses repository, desktop, Rust, plugin-api, and create-plugin failures independently while preserving root multi-project test orchestration; the repository/P1 gates run the canonical registry-preflight suite, and npm publication preflights both exact public-registry versions and publishes the exact canonical `.tmp/package` tarball paths only after unchanged SHA256 verification, without stale `dist` fallback or repacking.
- Tauri release and dry-run workflows use `projectPath: apps/desktop`, correct CLI/caches, comprehensive moved-file path filters, and preserve existing bundle/updater/release semantics.
- Snap, AUR, and WinGet metadata/workflows have non-publishing local/static validation tied to actual release artifact names.
- Temporary migration aliases, re-exports, old desktop paths, migration allowlists, and resolved migration/file-size baselines are removed only after zero-consumer proof and only when private or crate-private; externally public compatibility facades remain until separate versioned removal work. Active reasoned plugin API drift and per-layer manifest compatibility baselines remain enforced, and supported root orchestration commands remain.
- `docs/architecture/repository-structure.md`, `AGENTS.md`, focused `.rules/`, architecture policy/checker, package docs, plugin docs, scripts, workflows, and packaging all describe the same current enforced structure.
- All narrow, package, repository, full CI-equivalent, and applicable release dry-run gates pass before any requested push/PR action.
