use super::*;
use crate::connection_import::types::ImportedConnection;
use crate::models::{ConnectionParams, DatabaseSelection};

fn conn(
    name: &str,
    host: &str,
    port: u16,
    db: &str,
    user: &str,
    driver: &str,
) -> ImportedConnection {
    ImportedConnection {
        name: name.to_string(),
        host: host.to_string(),
        port,
        database: db.to_string(),
        username: user.to_string(),
        driver_label: driver.to_string(),
        ssh: None,
        ssl: None,
        group_name: None,
    }
}

fn saved(id: &str, name: &str, host: &str, port: u16, db: &str, user: &str) -> SavedConnection {
    SavedConnection {
        id: id.to_string(),
        name: name.to_string(),
        params: ConnectionParams {
            driver: "postgres".to_string(),
            host: Some(host.to_string()),
            port: Some(port),
            username: Some(user.to_string()),
            database: DatabaseSelection::Single(db.to_string()),
            ..Default::default()
        },
        group_id: None,
        sort_order: None,
        detect_json_in_text_columns: None,
        appearance: None,
    }
}

fn envelope(conns: Vec<ImportedConnection>) -> ImportEnvelope {
    ImportEnvelope {
        source_name: "Test".to_string(),
        connections: conns,
        ..Default::default()
    }
}

#[test]
fn marks_duplicates() {
    let env = envelope(vec![conn("A", "Host", 5432, "DB", "User", "PostgreSQL")]);
    let existing = vec![saved("x", "Existing", "host", 5432, "db", "user")];
    let preview = analyze(&env, &existing, &["postgres".into()], &|_| true);
    assert!(matches!(
        preview.items[0].status,
        ImportItemStatus::Duplicate { .. }
    ));
}

#[test]
fn warns_on_uninstalled_driver() {
    let env = envelope(vec![conn("A", "h", 27017, "db", "u", "MongoDB")]);
    let preview = analyze(&env, &[], &["postgres".into()], &|_| true);
    match &preview.items[0].status {
        ImportItemStatus::Warnings { warnings } => {
            assert!(warnings.iter().any(|w| w.contains("not installed")));
        }
        other => panic!("expected warnings, got {:?}", other),
    }
    assert_eq!(preview.items[0].driver_id, "mongodb");
    assert!(!preview.items[0].driver_installed);
}

#[test]
fn ready_when_known_and_unique() {
    let env = envelope(vec![conn("A", "h", 5432, "db", "u", "PostgreSQL")]);
    let preview = analyze(&env, &[], &["postgres".into()], &|_| true);
    assert!(matches!(preview.items[0].status, ImportItemStatus::Ready));
}

#[test]
fn duplicate_status_serializes_camel_case_fields() {
    // The frontend reads `existingId` / `existingName`; a snake_case leak
    // here surfaces as `Duplicate of ""` in the UI (see analyzer note).
    let env = envelope(vec![conn("A", "Host", 5432, "DB", "User", "PostgreSQL")]);
    let existing = vec![saved("x", "Existing Name", "host", 5432, "db", "user")];
    let preview = analyze(&env, &existing, &["postgres".into()], &|_| true);
    let json = serde_json::to_value(&preview.items[0].status).unwrap();
    assert_eq!(json["kind"], "duplicate");
    assert_eq!(json["existingId"], "x");
    assert_eq!(json["existingName"], "Existing Name");
    assert!(json.get("existing_name").is_none());
}
