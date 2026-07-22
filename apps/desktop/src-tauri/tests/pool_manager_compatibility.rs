#![allow(unused_imports)]

use nexora_lib::pool_manager::{
    close_all_pools, close_pool, close_pool_with_id, get_mysql_pool, get_mysql_pool_for_database,
    get_mysql_pool_with_id, get_postgres_pool, get_postgres_pool_with_id, get_sqlite_pool,
    get_sqlite_pool_with_id, has_pool, has_pool_for_database,
};

#[test]
fn public_pool_manager_api_remains_available() {}

#[test]
fn target_pool_modules_exist() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let facade = std::fs::read_to_string(root.join("pool_manager.rs")).unwrap();
    assert!(facade.contains("pub use crate::infrastructure::pools::*;"));
    for file in [
        "key.rs",
        "registry.rs",
        "startup_script.rs",
        "tls.rs",
        "mysql.rs",
        "postgres.rs",
        "sqlite.rs",
    ] {
        let source = std::fs::read_to_string(root.join("infrastructure/pools").join(file)).unwrap();
        assert!(
            !source.trim().is_empty(),
            "{file} must own focused pool logic"
        );
    }
}
