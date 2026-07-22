use crate::commands::{resolve_connection_params, resolve_connection_params_with_id};
use crate::models::{ConnectionParams, DatabaseSelection};

fn params() -> ConnectionParams {
    ConnectionParams {
        driver: "mysql".into(),
        host: Some("db.example.com".into()),
        port: Some(3306),
        database: DatabaseSelection::Single("original".into()),
        ..Default::default()
    }
}

#[test]
fn resolution_preserves_explicit_context_without_tunnels() {
    let original = params();
    let resolved = resolve_connection_params(&original).unwrap();
    assert_eq!(resolved.host, original.host);
    assert_eq!(resolved.port, original.port);
    assert_eq!(resolved.database.primary(), "original");
    assert_eq!(resolved.connection_id, None);
}

#[test]
fn resolution_with_id_preserves_database_and_sets_pool_identity() {
    let resolved = resolve_connection_params_with_id(&params(), "conn-1").unwrap();
    assert_eq!(resolved.database.primary(), "original");
    assert_eq!(resolved.connection_id.as_deref(), Some("conn-1"));
}
