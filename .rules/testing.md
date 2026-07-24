# Testing Conventions

This document defines the testing conventions and directory structure for the Nexora project. See `docs/architecture/repository-structure.md` for a description of the current repository structure.

## Directory Structure

### Source Files
Keep testable logic with its owning `app`, `features`, `shared`, or `platform` module. Move a utility into `apps/desktop/src/shared/` only when it is genuinely reusable across feature boundaries; feature-specific helpers remain with their feature. Use simple, descriptive names without an unnecessary "Utils" suffix.

**Correct:**
- `apps/desktop/src/features/data-grid/lib/dataGrid.ts`
- `apps/desktop/src/features/connections/lib/tableContext.ts`
- `apps/desktop/src/shared/lib/sql.ts`

**Incorrect:**
- ~~`apps/desktop/src/shared/lib/dataGridUtils.ts`~~ when only data-grid uses it
- ~~`apps/desktop/src/features/data-grid/lib/dataGridUtils.ts`~~ when `dataGrid.ts` is sufficiently descriptive

### Test Files
Desktop TypeScript tests must be placed in `apps/desktop/tests/` and mirror their source or contract owner. Desktop-wide contracts belong in `apps/desktop/tests/repository/`; root `tests/repository/` owns non-desktop workspace, package, release, and workflow contracts and may not import desktop-private modules. Package tests live under `packages/<package>/tests/`. Desktop Rust unit tests are module-local; use sibling `tests.rs` or `tests/` modules loaded by private `#[cfg(test)] mod tests;` declarations rather than peer `*_tests.rs` or non-trivial inline suites. Crate integration tests live under `apps/desktop/src-tauri/tests/`; preserve compile/public-contract, behavior, and database integration coverage. Create-plugin generated Rust test layouts are package-owned and verified from the packed templates. Do not reintroduce desktop tests or configuration at root, and do not introduce new legacy exceptions.

Default: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`

Explicit external integration run: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_integration -- --ignored`

Required services: MySQL on `127.0.0.1:33060` and PostgreSQL on `127.0.0.1:54320` with the existing test credentials and database. An explicit run must fail with the required-service precondition when either service is absent; it must not succeed as a no-op.

```
project-root/
├── apps/desktop/
│   ├── src/
│   │   ├── utils/
│   │   ├── dataGrid.ts
│   │   ├── contextMenu.ts
│   │   └── sqlGenerator.ts
│   └── themes/
│       ├── colorUtils.ts
│       └── themeRegistry.ts
├── apps/desktop/tests/
│   ├── setup.ts              # Test setup file
│   ├── utils/
│   │   ├── dataGrid.test.ts
│   │   ├── contextMenu.test.ts
│   │   └── sqlGenerator.test.ts
│   └── themes/
│       ├── colorUtils.test.ts
│       └── themeRegistry.test.ts
```

## Import Conventions

### In Source Files
Use standard relative or absolute imports:

```typescript
// From a component
import { formatCellValue } from "../../utils/dataGrid";

// From another util
import { hexToRgb } from "./colorUtils";

// Using path alias
import { splitQueries } from "@/utils/sql";
```

### In Test Files
Always use relative imports from `apps/desktop/tests/` to `apps/desktop/src/`:

```typescript
// Correct - from apps/desktop/tests/utils/dataGrid.test.ts
import { formatCellValue } from "../../src/utils/dataGrid";

// Correct - from apps/desktop/tests/themes/colorUtils.test.ts
import { hexToRgb } from "../../src/themes/colorUtils";

// Incorrect - relative to same directory (would fail after move)
~~import { formatCellValue } from "./dataGrid";~~
```

## Test File Naming

Test files must follow the pattern: `[filename].test.ts`

- `dataGrid.ts` → `dataGrid.test.ts`
- `sqlGenerator.ts` → `sqlGenerator.test.ts`

## What Belongs in `apps/desktop/src/utils/`

Extract pure, testable logic from components into `apps/desktop/src/utils/`:

1. **Data transformation functions** - formatters, parsers, converters
2. **Calculation functions** - positioning, sorting, filtering logic
3. **Validation functions** - input validation, sanitization
4. **SQL generators** - query builders, schema generators

### Example Extraction

**Before (in component):**
```typescript
// In DataGrid.tsx
const formatCellValue = (value: unknown): string => {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};
```

**After (extracted):**
```typescript
// In src/utils/dataGrid.ts
export function formatCellValue(value: unknown, nullLabel = "NULL"): string {
  if (value === null || value === undefined) return nullLabel;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// In DataGrid.tsx
import { formatCellValue } from "../../utils/dataGrid";
```

## Test Organization

Organize tests using `describe` blocks that mirror the structure of the module:

```typescript
describe('dataGrid', () => {
  describe('formatCellValue', () => {
    it('should format null values', () => { ... });
    it('should format boolean values', () => { ... });
  });
  
  describe('getColumnSortState', () => {
    it('should detect ASC sort', () => { ... });
    it('should detect DESC sort', () => { ... });
  });
});
```

## Coverage Requirements

Aim for comprehensive coverage of extracted utilities:
- All exported functions must have tests
- Edge cases must be covered (null, undefined, empty strings, boundary values)
- Error conditions should be tested where applicable
- Multiple database drivers should be tested for SQL generators

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run specific test file
pnpm test apps/desktop/tests/utils/dataGrid.test.ts

# Run with coverage
pnpm test --coverage
```

## Configuration

Root `vitest.config.ts` is the repository-owned aggregator with named `repository` and `desktop` projects. The repository project discovers only `tests/repository/**/*.test.ts` in Node. `apps/desktop/vitest.config.ts` owns the desktop project, React plugin, alias, JSDOM environment, `apps/desktop/tests/setup.ts`, desktop-only discovery, and coverage of `apps/desktop/src`.

Use these commands from the repository root:

```bash
pnpm test --run
pnpm test:repository --run
pnpm test:desktop --run
pnpm test:coverage
pnpm lint
pnpm exec vitest run --project repository tests/repository/<file>.test.ts
pnpm exec vitest run --project desktop apps/desktop/tests/<file>.test.tsx
```

## Workflow Contracts

Root `tests/repository/` owns CI and release workflow contracts. Workflow commands remain rooted at the repository, Rust caches use `apps/desktop/src-tauri`, Tauri actions use `projectPath: apps/desktop`, and release dry-run triggers cover moved desktop version, build, configuration, and icon paths. Validate workflow YAML through the checksum-verified actionlint v1.7.7 launcher with `pnpm lint:workflows`. Package contracts run through `pnpm check:packages`; plugin manifest layers run through `pnpm test:plugin-contract`; release-store metadata runs through `pnpm validate:distribution`. Package artifact checks inspect canonical `.tmp/package` tarballs and SHA256 sidecars without repacking. Stage scripts reject missing or stale/backdated `.tmp/build`, never fall back to checked-in `dist`, and package checks fail on hash mutation. Plugin API checks compare source, declarations emitted into `.tmp/build`, and canonical packed/public contract evidence against a non-null reasoned drift baseline. Create-plugin smoke covers network/file/folder/api, `--skip-cargo`, `--keep-temp`, non-network UI rejection, static/full UI validation, stable-toolchain `cargo check`, and `finally` cleanup.
