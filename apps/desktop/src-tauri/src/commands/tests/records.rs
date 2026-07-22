#[test]
fn record_commands_forward_exact_driver_arguments() {
    let source = include_str!("../records.rs");
    assert!(source.contains("drv.delete_record(&params, &table, &pk_map, schema.as_deref())"));
    assert!(source.contains("&col_name,\n        new_val,\n        schema.as_deref(),\n        max_blob_size,"));
    assert!(source.contains("drv.insert_record(&params, &table, data, schema.as_deref(), max_blob_size)"));
}

#[test]
fn record_commands_apply_database_override_before_driver_calls() {
    let source = include_str!("../records.rs");
    assert_eq!(
        source
            .matches("params.database = crate::models::DatabaseSelection::Single(db);")
            .count(),
        3
    );
    assert_eq!(source.matches("resolve_connection_params_with_id").count(), 3);
}

#[test]
fn record_commands_propagate_resolution_and_driver_errors() {
    let source = include_str!("../records.rs");
    assert_eq!(source.matches("find_connection_by_id(&app, &connection_id)?").count(), 3);
    assert!(source.contains(".await\n}"));
}
