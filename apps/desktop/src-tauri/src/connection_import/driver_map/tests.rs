use super::*;

#[test]
fn maps_builtin_labels() {
    assert_eq!(canonical_id("PostgreSQL"), "postgres");
    assert_eq!(canonical_id("MySQL"), "mysql");
    assert_eq!(canonical_id("MariaDB"), "mysql");
    assert_eq!(canonical_id("SQLite"), "sqlite");
}

#[test]
fn maps_plugin_labels_lowercased() {
    assert_eq!(canonical_id("MongoDB"), "mongodb");
    assert_eq!(canonical_id("SQL Server"), "mssql");
    assert_eq!(canonical_id("ClickHouse"), "clickhouse");
}

#[test]
fn installed_flag_reflects_registry() {
    let registered = vec!["postgres".to_string(), "mysql".to_string()];
    assert_eq!(
        map_driver_label("PostgreSQL", &registered),
        ("postgres".to_string(), true)
    );
    assert_eq!(
        map_driver_label("MongoDB", &registered),
        ("mongodb".to_string(), false)
    );
}

#[test]
fn default_ports() {
    assert_eq!(default_port("postgres"), 5432);
    assert_eq!(default_port("mysql"), 3306);
    assert_eq!(default_port("sqlite"), 0);
    assert_eq!(default_port("mssql"), 1433);
}
