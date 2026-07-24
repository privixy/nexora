#[test]
fn catalog_service_is_tauri_independent_and_owns_every_catalog_workflow() {
    let source = include_str!("mod.rs");
    assert!(!source.contains("tauri"));
    for workflow in [
        "get_schemas",
        "get_available_databases",
        "create_database",
        "drop_database",
        "rename_database",
        "create_schema",
        "truncate_table",
        "drop_table",
        "get_tables",
        "get_columns",
        "get_foreign_keys",
        "get_indexes",
        "get_schema_snapshot",
        "get_ai_schema_context",
    ] {
        assert!(
            source.contains(&format!("pub async fn {workflow}")),
            "CatalogService must own {workflow}"
        );
    }
    assert!(source.contains(".resolve(DatabaseContext"));
    for field in [
        "database,",
        "schema,",
        "table: Some(table)",
        "table: Some(table_name)",
    ] {
        assert!(
            source.contains(field),
            "CatalogService must forward {field}"
        );
    }
    assert!(source.contains("format_for_prompt"));
}
