use super::*;
use crate::models::{ConnectionParams, DatabaseSelection, ExportPayload, SavedConnection};

fn conn_with_password(password: Option<&str>, save_in_keychain: bool) -> SavedConnection {
    SavedConnection {
        id: "c1".into(),
        name: "Prod".into(),
        params: ConnectionParams {
            driver: "postgres".into(),
            host: Some("h".into()),
            port: Some(5432),
            username: Some("user".into()),
            database: DatabaseSelection::Single("app".into()),
            password: password.map(str::to_string),
            save_in_keychain: Some(save_in_keychain),
            ..Default::default()
        },
        group_id: None,
        sort_order: None,
        detect_json_in_text_columns: None,
        appearance: None,
    }
}

fn payload(connection: SavedConnection) -> ExportPayload {
    ExportPayload {
        version: 1,
        groups: Vec::new(),
        connections: vec![connection],
        ssh_connections: Vec::new(),
        k8s_connections: Vec::new(),
    }
}

#[test]
fn preview_does_not_treat_keychain_flag_as_imported_password() {
    let p = payload(conn_with_password(None, true));
    let preview = preview(&p, &[], &["postgres".into()]);

    assert!(!preview.items[0].has_password);
}

#[test]
fn preview_marks_real_imported_password() {
    let p = payload(conn_with_password(Some("secret"), true));
    let preview = preview(&p, &[], &["postgres".into()]);

    assert!(preview.items[0].has_password);
}
