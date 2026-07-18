use super::driver_trait::DriverCapabilities;

#[test]
fn multiple_databases_serializes_explicitly() {
    let capabilities = DriverCapabilities {
        multiple_databases: true,
        ..Default::default()
    };

    let value = serde_json::to_value(capabilities).expect("serialize capabilities");

    assert_eq!(
        value.get("multiple_databases"),
        Some(&serde_json::json!(true))
    );
}

#[test]
fn legacy_plugin_capabilities_default_multiple_databases_to_false() {
    let capabilities: DriverCapabilities = serde_json::from_value(serde_json::json!({
        "schemas": true,
        "views": true,
        "routines": false,
        "file_based": false
    }))
    .expect("deserialize legacy capabilities");

    assert!(!capabilities.multiple_databases);
}

#[test]
fn legacy_plugin_capabilities_default_sidebar_ddl_to_false() {
    let capabilities: DriverCapabilities = serde_json::from_value(serde_json::json!({
        "schemas": true,
        "views": true,
        "routines": false,
        "file_based": false
    }))
    .expect("deserialize legacy capabilities");

    assert!(!capabilities.create_database);
    assert!(!capabilities.drop_database);
    assert!(!capabilities.rename_database);
    assert!(!capabilities.create_schema);
    assert!(!capabilities.truncate_table);
}

#[test]
fn sidebar_ddl_capabilities_accept_camel_case_aliases() {
    let capabilities: DriverCapabilities = serde_json::from_value(serde_json::json!({
        "schemas": true,
        "views": true,
        "routines": false,
        "file_based": false,
        "createDatabase": true,
        "dropDatabase": true,
        "renameDatabase": true,
        "createSchema": true,
        "truncateTable": true
    }))
    .expect("deserialize aliased capabilities");

    assert!(capabilities.create_database);
    assert!(capabilities.drop_database);
    assert!(capabilities.rename_database);
    assert!(capabilities.create_schema);
    assert!(capabilities.truncate_table);
}
