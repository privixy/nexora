use urlencoding::encode;

#[test]
fn er_window_owner_preserves_url_title_label_and_dimensions() {
    let source = include_str!("../../domains/queries/mod.rs");
    assert!(source.contains("/schema-diagram?connectionId={}&connectionName={}&databaseName={}"));
    assert!(source.contains("format_window_title(Some(&format!"));
    assert!(source.contains("er-diagram:{}:{}:{}"));
    assert!(source.contains("c.is_ascii_alphanumeric() || c == '-' || c == '_'"));
    let adapter = include_str!("../windows.rs");
    assert!(adapter.contains(".inner_size(1200.0, 800.0)"));
    assert!(adapter.contains(".center()"));
}

#[test]
fn er_window_query_values_use_url_encoding() {
    assert_eq!(encode("conn id/one"), "conn%20id%2Fone");
    assert_eq!(encode("schema & table"), "schema%20%26%20table");
}

#[test]
fn er_window_owner_focuses_existing_window_and_maps_build_errors() {
    let source = include_str!("../windows.rs");
    assert!(source.contains("if let Some(existing) = app.get_webview_window(&label)"));
    assert!(source.contains("let _ = existing.set_focus();"));
    assert!(source.contains("Failed to create ER Diagram window: {}"));
}

#[test]
fn title_command_preserves_missing_window_and_set_title_errors() {
    let source = include_str!("../windows.rs");
    assert!(source.contains("ok_or(\"Failed to get main window\")?"));
    assert!(source.contains("Failed to set window title: {}"));
}
