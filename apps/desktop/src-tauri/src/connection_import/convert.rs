//! Turns an analyzed [`ImportEnvelope`] plus the user's per-item resolutions
//! into a Nexora `ExportPayload`, which is merged through the existing
//! import path (`apply_export_payload`). SSH details become separate
//! `SshConnection` records linked by `ssh_connection_id`; groups are matched to
//! existing groups by name or created fresh.

use serde::Deserialize;

use super::driver_map;
use super::types::{ImportEnvelope, ImportedConnection, ImportedCredentials};
use crate::models::{
    ConnectionGroup, ConnectionParams, DatabaseSelection, ExportPayload, SavedConnection,
    SshConnection,
};

/// One item's disposition, chosen by the user in the preview UI.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResolution {
    pub index: usize,
    /// "import" (new), "replace" (overwrite an existing connection), or "skip".
    pub action: String,
    #[serde(default)]
    pub replace_existing_id: Option<String>,
    /// Target group for a newly-imported connection. `Some(id)` assigns to that
    /// existing group; `Some("")` means "no group"; `None` (absent) falls back
    /// to the source app's folder. Ignored for `replace`.
    #[serde(default)]
    pub group_id: Option<String>,
    /// Name of a group to create (or reuse by name) for a newly-imported
    /// connection. Takes precedence over `group_id`. Ignored for `replace`.
    #[serde(default)]
    pub new_group_name: Option<String>,
    /// Existing group id under which `new_group_name` should be created. When
    /// absent (or empty) the new group is created at the top level.
    #[serde(default)]
    pub new_group_parent_id: Option<String>,
}

/// Build the payload from the envelope and resolutions. `existing_groups` lets
/// imported connections join a group with a matching name instead of duplicating
/// it. New ids (connections, groups, SSH records) are freshly generated.
pub fn build_payload(
    envelope: &ImportEnvelope,
    resolutions: &[ImportResolution],
    registered_ids: &[String],
    existing_groups: &[ConnectionGroup],
) -> ExportPayload {
    let mut payload = ExportPayload {
        version: 1,
        groups: Vec::new(),
        connections: Vec::new(),
        ssh_connections: Vec::new(),
        k8s_connections: Vec::new(),
    };

    // Resolve group name -> group id, reusing an existing group when the name
    // matches (case-insensitive); otherwise mint a new group once.
    let mut group_ids: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for res in resolutions {
        if res.action == "skip" {
            continue;
        }
        let conn = match envelope.connections.get(res.index) {
            Some(c) => c,
            None => continue,
        };
        let creds = envelope.credentials_by_index.get(&res.index);

        // Group assignment. For newly-imported connections the user can override
        // the source-app folder: create a group on the fly (`new_group_name`),
        // pick an existing one (`group_id`), or explicitly choose none
        // (`group_id == ""`). `replace` keeps the source-folder behavior.
        let source_group = |group_ids: &mut std::collections::HashMap<String, String>,
                            payload: &mut ExportPayload| {
            conn.group_name
                .as_ref()
                .map(|name| resolve_group(name, None, existing_groups, group_ids, payload))
        };
        let group_id = if res.action == "replace" {
            source_group(&mut group_ids, &mut payload)
        } else if let Some(name) = res
            .new_group_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            // The new group can be nested under an existing group.
            let parent = res
                .new_group_parent_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty());
            Some(resolve_group(
                name,
                parent,
                existing_groups,
                &mut group_ids,
                &mut payload,
            ))
        } else if let Some(gid) = &res.group_id {
            // `Some("")` is an explicit "no group"; a real id assigns to it.
            (!gid.is_empty()).then(|| gid.clone())
        } else {
            source_group(&mut group_ids, &mut payload)
        };

        let conn_id = match res.action.as_str() {
            "replace" => res.replace_existing_id.clone().unwrap_or_else(new_id),
            _ => new_id(),
        };

        let (saved, ssh) = build_connection(conn, creds, registered_ids, &conn_id, group_id);
        if let Some(ssh) = ssh {
            payload.ssh_connections.push(ssh);
        }
        payload.connections.push(saved);
    }

    payload
}

pub(crate) fn resolve_group(
    name: &str,
    parent_id: Option<&str>,
    existing_groups: &[ConnectionGroup],
    group_ids: &mut std::collections::HashMap<String, String>,
    payload: &mut ExportPayload,
) -> String {
    // Cache/dedup are scoped to the parent so a subgroup never collides with a
    // same-named group under a different parent.
    let name_key = name.trim().to_ascii_lowercase();
    let cache_key = format!("{}\u{0}{name_key}", parent_id.unwrap_or(""));
    if let Some(id) = group_ids.get(&cache_key) {
        return id.clone();
    }
    // Reuse an existing group with the same name under the same parent.
    if let Some(existing) = existing_groups.iter().find(|g| {
        g.name.trim().to_ascii_lowercase() == name_key && g.parent_id.as_deref() == parent_id
    }) {
        group_ids.insert(cache_key, existing.id.clone());
        return existing.id.clone();
    }
    // Otherwise create a new group and include it in the payload.
    let id = new_id();
    payload.groups.push(ConnectionGroup {
        id: id.clone(),
        name: name.to_string(),
        parent_id: parent_id.map(str::to_string),
        collapsed: false,
        sort_order: 0,
    });
    group_ids.insert(cache_key, id.clone());
    id
}

fn build_connection(
    conn: &ImportedConnection,
    creds: Option<&ImportedCredentials>,
    registered_ids: &[String],
    conn_id: &str,
    group_id: Option<String>,
) -> (SavedConnection, Option<SshConnection>) {
    let (driver, _installed) = driver_map::map_driver_label(&conn.driver_label, registered_ids);

    let mut params = ConnectionParams {
        driver,
        host: (!conn.host.is_empty()).then(|| conn.host.clone()),
        port: (conn.port != 0).then_some(conn.port),
        username: (!conn.username.is_empty()).then(|| conn.username.clone()),
        password: creds.and_then(|c| c.password.clone()),
        database: DatabaseSelection::Single(conn.database.clone()),
        ..Default::default()
    };

    if let Some(ssl) = &conn.ssl {
        params.ssl_mode = Some(ssl.mode.clone());
        params.ssl_ca = ssl.ca_certificate_path.clone();
        params.ssl_cert = ssl.client_certificate_path.clone();
        params.ssl_key = ssl.client_key_path.clone();
    }

    let ssh_record = conn.ssh.as_ref().map(|ssh| {
        let ssh_id = new_id();
        params.ssh_enabled = Some(true);
        params.ssh_connection_id = Some(ssh_id.clone());
        params.ssh_password = creds.and_then(|c| c.ssh_password.clone());
        params.ssh_key_passphrase = creds.and_then(|c| c.ssh_key_passphrase.clone());

        let has_ssh_secret = creds
            .map(|c| c.ssh_password.is_some() || c.ssh_key_passphrase.is_some())
            .unwrap_or(false);

        SshConnection {
            id: ssh_id,
            name: ssh.host.clone(),
            host: ssh.host.clone(),
            port: ssh.port.unwrap_or(22),
            user: ssh.username.clone(),
            auth_type: Some(ssh.auth_type.clone()),
            password: creds.and_then(|c| c.ssh_password.clone()),
            key_file: ssh.private_key_path.clone(),
            key_passphrase: creds.and_then(|c| c.ssh_key_passphrase.clone()),
            allow_passphrase_prompt: None,
            save_in_keychain: Some(has_ssh_secret),
        }
    });

    // Persist any recovered secrets to the keychain on apply.
    let has_secret = creds.map(|c| !c.is_empty()).unwrap_or(false);
    params.save_in_keychain = Some(has_secret);

    let saved = SavedConnection {
        id: conn_id.to_string(),
        name: conn.name.clone(),
        params,
        group_id,
        sort_order: None,
        detect_json_in_text_columns: None,
        appearance: None,
    };
    (saved, ssh_record)
}

pub(crate) fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests;
