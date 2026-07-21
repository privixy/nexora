# React Rules
1. **Repository Structure:** Follow `docs/architecture/repository-structure.md` for current React source/test ownership. Desktop source, tests, and app-local frontend configuration live under `apps/desktop/`; root `tests/repository/` contains repository contracts only.
2. **Root Lint Ownership:** Root owns `eslint.config.js`, `pnpm lint`, and exact runtime packages `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, and `typescript-eslint`.
3. **Exhaustive Deps:** Always provide all dependencies to `useEffect`, `useMemo`, and `useCallback`. If a function is a dependency, ensure it is wrapped in `useCallback` or defined inside the hook.
4. **Sync State in Effects:** NEVER call `setState` synchronously inside `useEffect`. This triggers unnecessary cascading renders. Use `useMemo` for derived state or initialize state directly if possible.
5. **State Ownership:** Components may own presentation state only. Cross-component state must live in context, hooks, or shared utilities.
6. **Fast Refresh Compatibility:** Files exporting React components (especially Contexts) must NOT export other constants or helper functions. Move helpers to separate utility files.
7. **Library Safety:** Be aware of incompatible libraries with the React Compiler (e.g., `useReactTable`). Do not wrap their return values in `useMemo` if the library manages its own internal memoization or returns unstable function references.
8. **Legacy Exceptions:** Do not introduce new colocated frontend tests or other legacy structure exceptions.
