# TypeScript Rules
1. **Repository Structure:** Follow `docs/architecture/repository-structure.md` for current TypeScript source/test ownership. Root `src/` and `tests/` remain the enforced paths until the desktop migration lands.
2. **No Explicit Any:** NEVER use `any`. Define proper interfaces/types or use `unknown` with type guards. If a type is external and unknown, define a local interface that matches the expected structure.
3. **Legacy Exceptions:** Do not introduce new colocated TypeScript tests, deep-import exceptions, oversized files, or other legacy structure exceptions.
