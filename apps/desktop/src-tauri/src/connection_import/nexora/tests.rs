use super::*;
use crate::connection_import::convert::ImportResolution;
use crate::models::{
    ConnectionGroup, ConnectionParams, DatabaseSelection, ExportPayload, SavedConnection,
    SshConnection,
};

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
    payload_with(Vec::new(), vec![connection])
}

fn payload_with(groups: Vec<ConnectionGroup>, connections: Vec<SavedConnection>) -> ExportPayload {
    ExportPayload {
        version: 1,
        groups,
        connections,
        ssh_connections: Vec::new(),
        k8s_connections: Vec::new(),
    }
}

fn group(id: &str, name: &str, parent: Option<&str>) -> ConnectionGroup {
    ConnectionGroup {
        id: id.into(),
        name: name.into(),
        parent_id: parent.map(str::to_string),
        collapsed: false,
        sort_order: 0,
    }
}

fn conn(id: &str, name: &str, host: &str, db: &str, group_id: Option<&str>) -> SavedConnection {
    let mut connection = conn_with_password(None, false);
    connection.id = id.into();
    connection.name = name.into();
    connection.params.host = Some(host.into());
    connection.params.database = DatabaseSelection::Single(db.into());
    connection.group_id = group_id.map(str::to_string);
    connection.sort_order = Some(3);
    connection
}

fn resolution(index: usize, action: &str) -> ImportResolution {
    ImportResolution {
        index,
        action: action.into(),
        replace_existing_id: None,
        group_id: None,
        new_group_name: None,
        new_group_parent_id: None,
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

#[test]
fn preview_marks_duplicates_and_seeds_group_name() {
    let p = payload_with(
        vec![group("g1", "Work", None)],
        vec![conn("c1", "Prod", "db.example.com", "app", Some("g1"))],
    );
    let existing = vec![conn(
        "existing",
        "Existing Prod",
        "db.example.com",
        "app",
        None,
    )];
    let preview = preview(&p, &existing, &["postgres".into()]);
    assert_eq!(preview.source_name, "Nexora");
    assert_eq!(preview.items[0].group_name.as_deref(), Some("Work"));
    assert!(matches!(
        preview.items[0].status,
        ImportItemStatus::Duplicate { .. }
    ));
}

#[test]
fn preview_warns_on_uninstalled_driver() {
    let source = payload(conn("c1", "Prod", "h", "app", None));
    let preview = preview(&source, &[], &["mysql".into()]);
    assert!(matches!(
        preview.items[0].status,
        ImportItemStatus::Warnings { .. }
    ));
    assert!(!preview.items[0].driver_installed);
}

#[test]
fn apply_default_keeps_original_group_with_hierarchy() {
    let p = payload_with(
        vec![group("A", "A", None), group("A1", "A1", Some("A"))],
        vec![conn("c1", "Prod", "h", "app", Some("A1"))],
    );
    let out = apply(&p, &[resolution(0, "import")], &[]);
    assert_ne!(out.connections[0].id, "c1");
    assert_eq!(out.connections[0].group_id.as_deref(), Some("A1"));
    let ids: Vec<&str> = out.groups.iter().map(|group| group.id.as_str()).collect();
    assert!(ids.contains(&"A1") && ids.contains(&"A"));
}

#[test]
fn apply_new_group_name_overrides_source() {
    let p = payload_with(
        vec![group("A", "A", None)],
        vec![conn("c1", "Prod", "h", "app", Some("A"))],
    );
    let mut selected = resolution(0, "import");
    selected.new_group_name = Some("Imported".into());
    let out = apply(&p, &[selected], &[]);
    assert_eq!(out.groups.len(), 1);
    assert_eq!(out.groups[0].name, "Imported");
    assert_eq!(
        out.connections[0].group_id.as_deref(),
        Some(out.groups[0].id.as_str())
    );
}

#[test]
fn apply_existing_group_id_and_explicit_none() {
    let p = payload_with(
        vec![group("A", "A", None)],
        vec![
            conn("c1", "One", "h1", "app", Some("A")),
            conn("c2", "Two", "h2", "app", Some("A")),
        ],
    );
    let mut assign = resolution(0, "import");
    assign.group_id = Some("user-group".into());
    let mut clear = resolution(1, "import");
    clear.group_id = Some(String::new());
    let out = apply(&p, &[assign, clear], &[]);
    assert_eq!(out.connections[0].group_id.as_deref(), Some("user-group"));
    assert_eq!(out.connections[1].group_id, None);
    assert!(out.groups.is_empty());
}

#[test]
fn apply_skips_and_replaces() {
    let p = payload_with(
        Vec::new(),
        vec![
            conn("c1", "Keep", "h1", "app", None),
            conn("c2", "Drop", "h2", "app", None),
        ],
    );
    let mut replace = resolution(0, "replace");
    replace.replace_existing_id = Some("target-id".into());
    let out = apply(&p, &[replace, resolution(1, "skip")], &[]);
    assert_eq!(out.connections.len(), 1);
    assert_eq!(out.connections[0].id, "target-id");
}

#[test]
fn apply_remaps_linked_ssh_to_fresh_id() {
    let mut connection = conn("c1", "Prod", "h", "app", None);
    connection.params.ssh_enabled = Some(true);
    connection.params.ssh_connection_id = Some("ssh-old".into());
    let mut p = payload(connection);
    p.ssh_connections.push(SshConnection {
        id: "ssh-old".into(),
        name: "bastion".into(),
        host: "bastion".into(),
        port: 22,
        user: "deploy".into(),
        auth_type: Some("password".into()),
        password: None,
        key_file: None,
        key_passphrase: None,
        allow_passphrase_prompt: None,
        save_in_keychain: Some(false),
    });
    let out = apply(&p, &[resolution(0, "import")], &[]);
    let new_ssh_id = &out.ssh_connections[0].id;
    assert_ne!(new_ssh_id, "ssh-old");
    assert_eq!(
        out.connections[0].params.ssh_connection_id.as_ref(),
        Some(new_ssh_id)
    );
}
