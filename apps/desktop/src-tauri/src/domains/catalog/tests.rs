#[test]
fn catalog_service_is_tauri_independent_and_owns_driver_delegation() {
    let source = include_str!("mod.rs");
    assert!(!source.contains("tauri"));
    assert!(source.contains("get_schemas(&resolved.params)"));
    assert!(source.contains(".create_database(&resolved.params, database)"));
    assert!(source.contains(".truncate_table(&resolved.params, table, schema)"));
}
