#[test]
fn record_commands_forward_exact_context_and_driver_arguments() {
    let source = include_str!("../../infrastructure/command_services/records.rs");
    assert_eq!(source.matches("connection_id: &connection_id").count(), 3);
    assert_eq!(source.matches("database: database.as_deref()").count(), 3);
    assert_eq!(source.matches("schema: schema.as_deref()").count(), 3);
    assert_eq!(source.matches("table: Some(table.as_str())").count(), 3);
    assert!(source.contains(".delete_record(&resolved.params, &table, &pk_map, schema.as_deref())"));
    assert!(source.contains(
        "&col_name,\n            new_val,\n            schema.as_deref(),\n            max_blob_size,"
    ));
    assert!(source.contains("&resolved.params,\n            &table,\n            data,\n            schema.as_deref(),\n            max_blob_size,"));
}

#[test]
fn record_commands_resolve_once_and_propagate_errors() {
    let source = include_str!("../../infrastructure/command_services/records.rs");
    assert_eq!(
        source
            .matches("TauriConnectionContextResolver::new(app)")
            .count(),
        3
    );
    assert_eq!(source.matches(".await?;").count(), 3);
}
