# Rust Rules

1. **Repository Structure:** Follow `docs/architecture/repository-structure.md` for current Rust source/test ownership. The Tauri crate lives under `apps/desktop/src-tauri/`, with production modules in `apps/desktop/src-tauri/src/**` and integration tests in `apps/desktop/src-tauri/tests/**`.
2. **Keep `mod.rs` focused:** In `apps/desktop/src-tauri/src/**/mod.rs`, keep public orchestration, exports, and trait implementations. Extract pure helpers, parsers, and driver-specific utilities into dedicated sibling modules.
3. **Preserve public APIs during refactors:** When moving public functions out of `mod.rs`, re-export them from the parent module with `pub use` so existing call sites keep the same paths.
4. **Prefer pure helper modules:** Move parsing, identifier escaping, SQL string helpers, and value-conversion logic into focused modules with small, testable functions.
5. **Separate Rust tests from implementation:** When a newly extracted module has non-trivial tests, place them in a sibling `tests.rs` file (or `tests/*.rs` when the module grows further) and load them with `#[cfg(test)] mod tests;`.
6. **Test extracted helpers directly:** Every extracted pure helper or parser should have unit tests covering nominal cases, edge cases, and unsupported inputs when relevant.
7. **Avoid behavioural refactors mixed with structural refactors:** When reorganizing Rust files, keep function signatures and runtime behaviour stable unless the task explicitly asks for behaviour changes.
8. **Legacy Exceptions:** Do not introduce new crate-level `*_tests.rs`, inline Rust test modules, or other legacy structure exceptions.
