use super::resolution::{resolve_connection_params, resolve_connection_params_with_id};
use crate::models::{ConnectionParams, DatabaseSelection};

fn params() -> ConnectionParams {
    ConnectionParams {
        driver: "mysql".into(),
        host: Some("localhost".into()),
        port: Some(3306),
        database: DatabaseSelection::Single("database".into()),
        ..Default::default()
    }
}

#[test]
fn resolution_preserves_plain_parameters() {
    let original = params();
    let resolved = resolve_connection_params(&original).unwrap();
    assert_eq!(resolved.host, original.host);
    assert_eq!(resolved.port, original.port);
    assert_eq!(resolved.database.primary(), "database");
}

#[test]
fn resolution_sets_stable_connection_identity() {
    let resolved = resolve_connection_params_with_id(&params(), "conn-1").unwrap();
    assert_eq!(resolved.connection_id.as_deref(), Some("conn-1"));
}

#[test]
fn resolution_rejects_simultaneous_tunnels() {
    let mut params = params();
    params.ssh_enabled = Some(true);
    params.k8s_enabled = Some(true);
    assert_eq!(
        resolve_connection_params(&params).unwrap_err(),
        "Kubernetes and SSH tunnel cannot both be enabled for the same connection"
    );
}
