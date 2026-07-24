# Frontend Rules

1. **No Driver Conditions:** NEVER add driver-specific conditionals (e.g., `driver === "duckdb"`, `activeDriver === "sqlite"`) in frontend code. Driver-specific logic belongs in the backend (Rust driver trait implementations or plugin code). The frontend must remain driver-agnostic.
2. **Layer Direction:** Code under `shared` and `platform` must not import features, and features must not import `app`. Cross-feature consumers use the exporting feature's public entry point; keep the feature graph acyclic.
3. **Tauri Boundary:** Direct Tauri imports belong under `apps/desktop/src/platform/tauri`; frontend features consume gateways or adapters instead.
4. **Ownership:** App composition, configuration, localization, and styles live under `app`; domain code lives under named `features`; reusable presentation, contracts, and utilities live under `shared`; Tauri transport lives under `platform/tauri`.
5. **Review Existing Debt:** Do not add frontend-built database SQL, driver-name branching, deep cross-feature imports, or new compatibility exceptions. Treat existing occurrences as migration debt rather than precedent.
