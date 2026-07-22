use super::*;
use crate::connection_import::types::{ImportedConnection, ImportedSsh};

fn base_conn() -> ImportedConnection {
    ImportedConnection {
        name: "Prod".to_string(),
        host: "db.example.com".to_string(),
        port: 5432,
        database: "app".to_string(),
        username: "postgres".to_string(),
        driver_label: "PostgreSQL".to_string(),
        ssh: None,
        ssl: None,
        group_name: Some("Work".to_string()),
    }
}

fn res(index: usize, action: &str) -> ImportResolution {
    ImportResolution {
        index,
        action: action.to_string(),
        replace_existing_id: None,
        group_id: None,
        new_group_name: None,
        new_group_parent_id: None,
    }
}

fn group(id: &str, name: &str) -> ConnectionGroup {
    ConnectionGroup {
        id: id.to_string(),
        name: name.to_string(),
        parent_id: None,
        collapsed: false,
        sort_order: 0,
    }
}

fn subgroup(id: &str, name: &str, parent_id: &str) -> ConnectionGroup {
    ConnectionGroup {
        parent_id: Some(parent_id.to_string()),
        ..group(id, name)
    }
}

#[test]
fn imports_connection_with_group() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let payload = build_payload(&env, &[res(0, "import")], &["postgres".into()], &[]);
    assert_eq!(payload.connections.len(), 1);
    assert_eq!(payload.groups.len(), 1);
    let c = &payload.connections[0];
    assert_eq!(c.params.driver, "postgres");
    assert_eq!(c.group_id.as_deref(), Some(payload.groups[0].id.as_str()));
    assert_eq!(c.params.save_in_keychain, Some(false));
}

#[test]
fn skip_omits_connection() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let payload = build_payload(&env, &[res(0, "skip")], &["postgres".into()], &[]);
    assert!(payload.connections.is_empty());
}

#[test]
fn ssh_becomes_linked_record() {
    let mut conn = base_conn();
    conn.ssh = Some(ImportedSsh {
        host: "bastion".into(),
        port: Some(2222),
        username: "deploy".into(),
        auth_type: "ssh_key".into(),
        private_key_path: Some("~/.ssh/id_rsa".into()),
    });
    let mut env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![conn],
        ..Default::default()
    };
    env.credentials_by_index.insert(
        0,
        ImportedCredentials {
            ssh_key_passphrase: Some("pp".into()),
            ..Default::default()
        },
    );
    let payload = build_payload(&env, &[res(0, "import")], &["postgres".into()], &[]);
    assert_eq!(payload.ssh_connections.len(), 1);
    let ssh = &payload.ssh_connections[0];
    let conn = &payload.connections[0];
    assert_eq!(
        conn.params.ssh_connection_id.as_deref(),
        Some(ssh.id.as_str())
    );
    assert_eq!(conn.params.ssh_enabled, Some(true));
    assert_eq!(ssh.port, 2222);
    assert_eq!(ssh.save_in_keychain, Some(true));
    assert_eq!(conn.params.save_in_keychain, Some(true));
}

#[test]
fn import_assigns_to_chosen_existing_group() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "import");
    r.group_id = Some("existing-group".into());
    let groups = [group("existing-group", "My Group")];
    let payload = build_payload(&env, &[r], &["postgres".into()], &groups);
    // No new group is minted; the connection joins the chosen one.
    assert!(payload.groups.is_empty());
    assert_eq!(
        payload.connections[0].group_id.as_deref(),
        Some("existing-group")
    );
}

#[test]
fn import_creates_new_group_on_the_fly() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "import");
    r.new_group_name = Some("Fresh Group".into());
    let payload = build_payload(&env, &[r], &["postgres".into()], &[]);
    assert_eq!(payload.groups.len(), 1);
    assert_eq!(payload.groups[0].name, "Fresh Group");
    assert_eq!(
        payload.connections[0].group_id.as_deref(),
        Some(payload.groups[0].id.as_str())
    );
}

#[test]
fn import_creates_new_group_under_parent() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "import");
    r.new_group_name = Some("Child".into());
    r.new_group_parent_id = Some("parent-id".into());
    let groups = [group("parent-id", "Parent")];
    let payload = build_payload(&env, &[r], &["postgres".into()], &groups);
    // A new nested group is minted; the parent stays untouched.
    assert_eq!(payload.groups.len(), 1);
    assert_eq!(payload.groups[0].name, "Child");
    assert_eq!(payload.groups[0].parent_id.as_deref(), Some("parent-id"));
    assert_eq!(
        payload.connections[0].group_id.as_deref(),
        Some(payload.groups[0].id.as_str())
    );
}

#[test]
fn import_new_group_under_parent_reuses_matching_subgroup() {
    // A same-named group under a *different* parent must not be reused.
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "import");
    r.new_group_name = Some("Child".into());
    r.new_group_parent_id = Some("parent-id".into());
    let groups = [
        group("parent-id", "Parent"),
        subgroup("child-id", "Child", "parent-id"),
        subgroup("other-child", "Child", "somewhere-else"),
    ];
    let payload = build_payload(&env, &[r], &["postgres".into()], &groups);
    // The existing subgroup under the requested parent is reused.
    assert!(payload.groups.is_empty());
    assert_eq!(payload.connections[0].group_id.as_deref(), Some("child-id"));
}

#[test]
fn import_new_group_name_reuses_matching_existing() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "import");
    r.new_group_name = Some("  my group ".into()); // case/space-insensitive match
    let groups = [group("g1", "My Group")];
    let payload = build_payload(&env, &[r], &["postgres".into()], &groups);
    assert!(payload.groups.is_empty());
    assert_eq!(payload.connections[0].group_id.as_deref(), Some("g1"));
}

#[test]
fn import_explicit_no_group_overrides_source_folder() {
    // base_conn has source folder "Work"; empty group_id clears it.
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "import");
    r.group_id = Some(String::new());
    let payload = build_payload(&env, &[r], &["postgres".into()], &[]);
    assert!(payload.groups.is_empty());
    assert_eq!(payload.connections[0].group_id, None);
}

#[test]
fn import_without_group_choice_falls_back_to_source_folder() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let payload = build_payload(&env, &[res(0, "import")], &["postgres".into()], &[]);
    assert_eq!(payload.groups.len(), 1);
    assert_eq!(payload.groups[0].name, "Work");
}

#[test]
fn replace_reuses_existing_id() {
    let env = ImportEnvelope {
        source_name: "X".into(),
        connections: vec![base_conn()],
        ..Default::default()
    };
    let mut r = res(0, "replace");
    r.replace_existing_id = Some("existing-123".into());
    let payload = build_payload(&env, &[r], &["postgres".into()], &[]);
    assert_eq!(payload.connections[0].id, "existing-123");
}
