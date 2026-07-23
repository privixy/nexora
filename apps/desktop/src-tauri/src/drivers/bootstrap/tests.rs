#[test]
fn deferred_provider_contract_is_declared() {
    let source = include_str!("../bootstrap.rs");
    assert!(source.contains("FnOnce()"));
    assert!(source.contains("MysqlDriver::new()"));
    assert!(source.contains("PostgresDriver::new()"));
    assert!(source.contains("SqliteDriver::new()"));
    assert!(source.contains("load_plugins_with_configs"));
}
