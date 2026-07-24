#[test]
fn server_time_owner_preserves_driver_branch_and_execute_arguments() {
    let source = include_str!("../../server_time_compat.rs");
    assert!(source.contains("\"sqlite\" => \"SELECT datetime('now', 'localtime')\""));
    assert!(source.contains("_ => \"SELECT NOW()\""));
    assert!(source.contains(".execute_query(&params, query, Some(1), 1, None)"));
}

#[test]
fn server_time_owner_preserves_result_conversion_and_error() {
    let source = include_str!("../../server_time_compat.rs");
    assert!(source.contains("serde_json::Value::String(string) => string.clone()"));
    assert!(source.contains("other => other.to_string()"));
    assert!(source.contains("No timestamp returned from server"));
    assert!(source.contains(".await?;"));
}

#[test]
fn lifecycle_commands_preserve_success_and_error_contracts() {
    let source = include_str!("../connection_lifecycle.rs");
    assert!(source.contains("Ok(\"Connection successful!\".to_string())"));
    assert!(source.contains("Database file not found: {}"));
    assert!(source.contains("driver_for(&resolved_params.driver).await?"));
}
