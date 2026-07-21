# TypeScript Rules
1. **Repository Structure:** Follow `docs/architecture/repository-structure.md` for current TypeScript source/test ownership. Desktop source and app-local frontend configuration live under `apps/desktop/`; tests remain at root until desktop migration Task 4.
2. **Root Lint Ownership:** Root owns `eslint.config.js`, `pnpm lint`, and exact runtime packages `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, and `typescript-eslint`.
3. **No Explicit Any:** NEVER use `any`. Define proper interfaces/types or use `unknown` with type guards. If a type is external and unknown, define a local interface that matches the expected structure.
4. **Legacy Exceptions:** Do not introduce new colocated TypeScript tests, deep-import exceptions, oversized files, or other legacy structure exceptions.
