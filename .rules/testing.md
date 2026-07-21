# Testing Conventions

This document defines the testing conventions and directory structure for the Nexora project. See `docs/architecture/repository-structure.md` for the canonical current and target repository structure.

## Directory Structure

### Source Files
All utility functions and testable logic must be placed in `apps/desktop/src/utils/` with simple, descriptive names **without the "Utils" suffix**.

**Correct:**
- `apps/desktop/src/utils/dataGrid.ts`
- `apps/desktop/src/utils/contextMenu.ts`
- `apps/desktop/src/utils/sqlGenerator.ts`
- `apps/desktop/src/utils/sql.ts`

**Incorrect:**
- ~~`apps/desktop/src/components/ui/dataGridUtils.ts`~~ (wrong location)
- ~~`apps/desktop/src/utils/dataGridUtils.ts`~~ (wrong naming - no Utils suffix)

### Test Files
Desktop TypeScript tests must be placed in `apps/desktop/tests/`, mirroring `apps/desktop/src/`. Root `tests/` must contain only `tests/repository/`, which owns non-desktop workspace and release contracts. Do not reintroduce desktop tests or configuration at root, and do not introduce new legacy exceptions.

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

Tests are configured in `apps/desktop/vitest.config.ts`:
- Desktop test files are discovered in `apps/desktop/tests/`
- Root repository contracts are discovered in `tests/repository/`
- Setup file: `apps/desktop/tests/setup.ts` (configured as `./tests/setup.ts` from the desktop package)
- Environment: `jsdom` for DOM-related tests

## Workflow Contracts

Root `tests/repository/` owns CI and release workflow contracts. Workflow commands remain rooted at the repository, Rust caches use `apps/desktop/src-tauri`, Tauri actions use `projectPath: apps/desktop`, and release dry-run triggers cover moved desktop version, build, configuration, and icon paths. Validate workflow YAML through the checksum-verified actionlint v1.7.7 launcher with `pnpm lint:workflows`.
