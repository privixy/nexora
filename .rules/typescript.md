# TypeScript Rules
1. **Repository Structure:** Follow `docs/architecture/repository-structure.md` for current TypeScript source/test ownership. Desktop source, assets, tests, dependencies, scripts, and app-local configuration live under `apps/desktop/` and must not be reintroduced at root; root `tests/repository/` contains repository contracts only.
2. **Root Lint Ownership:** Root owns `eslint.config.js`, `pnpm lint`, and exact runtime packages `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, and `typescript-eslint`.
3. **No Explicit Any:** NEVER use `any`. Define proper interfaces/types or use `unknown` with type guards. If a type is external and unknown, define a local interface that matches the expected structure.
4. **Legacy Exceptions:** Do not introduce new colocated TypeScript tests, deep-import exceptions, oversized files, or other legacy structure exceptions.
