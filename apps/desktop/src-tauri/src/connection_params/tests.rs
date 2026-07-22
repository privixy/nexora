use super::apply_database_override;
use crate::models::{ConnectionParams, DatabaseSelection};
use crate::pool_manager::build_connection_key;

fn params() -> ConnectionParams {
    ConnectionParams {
        driver: "postgres".to_string(),
        database: DatabaseSelection::Multiple(vec!["app".to_string(), "analytics".to_string()]),
        connection_id: Some("connection-1".to_string()),
        ..Default::default()
    }
}

#[test]
fn applies_database_override_without_changing_original_params() {
    let original = params();
    let overridden = apply_database_override(original.clone(), Some("analytics"));

    assert_eq!(overridden.database.primary(), "analytics");
    assert!(matches!(&original.database, DatabaseSelection::Multiple(_)));
}

#[test]
fn preserves_resolved_database_when_override_is_omitted() {
    let original = params();
    let resolved = apply_database_override(original.clone(), None);

    assert_eq!(resolved.database.as_vec(), original.database.as_vec());
}

#[test]
fn database_overrides_use_isolated_saved_connection_pool_keys() {
    let app = apply_database_override(params(), Some("app"));
    let analytics = apply_database_override(params(), Some("analytics"));

    assert_ne!(
        build_connection_key(&app, app.connection_id.as_deref()),
        build_connection_key(&analytics, analytics.connection_id.as_deref())
    );
}
