use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime};
#[cfg(test)]
use urlencoding::encode;
use uuid::Uuid;

use crate::credential_cache;
use crate::infrastructure::connections::{get_config_path, get_ssh_config_path};
use crate::keychain_utils;
use crate::models::{
    BatchStatementResult, ConnectionGroup, ConnectionParams, ConnectionsFile, ExportPayload,
    K8sConnection, SavedConnection, SshConnection,
};
use crate::persistence;

// Constants
/// Resolve the driver from the registry or return a descriptive error.
pub(crate) async fn driver_for(
    id: &str,
) -> Result<std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>, String> {
    crate::drivers::registry::get_driver(id)
        .await
        .ok_or_else(|| format!("Unsupported driver: {}", id))
}

use crate::infrastructure::cancellation::AbortHandleMap;

#[cfg(test)]
const DEFAULT_MYSQL_PORT: u16 = 3306;
#[cfg(test)]
const DEFAULT_POSTGRES_PORT: u16 = 5432;

/// Tracks abort handles for in-flight queries keyed by connection id. A
/// slot can hold multiple handles when the UI fires several queries (or
/// an EXPLAIN alongside a query) against the same connection concurrently
/// — `cancel_query` must abort all of them, not just the most recent.
pub struct QueryCancellationState {
    pub handles: Arc<Mutex<AbortHandleMap>>,
}

impl Default for QueryCancellationState {
    fn default() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// --- Persistence Helpers ---

/// Check if a string option is empty or contains only whitespace.
#[inline]
#[cfg(test)]
pub(crate) fn is_empty_or_whitespace(s: &Option<String>) -> bool {
    s.as_ref().map(|p| p.trim().is_empty()).unwrap_or(true)
}

/// Merge a list of incoming groups into an existing list, preserving hierarchy
/// and repairing any `parent_id` that points to a group id not present in the
/// union (i.e. neither in the existing list nor in the incoming batch).
///
/// Behaviour:
/// - Existing groups with the same id are overwritten by the incoming one
///   (so renames / re-ordering / new parent_id from the JSON win).
/// - Missing parents are demoted to root (`parent_id = None`) rather than
///   being rejected, so a partially-malformed JSON still imports successfully
///   and the user keeps most of their tree.
/// - The merge is idempotent: running it twice on the same input is a no-op.
pub(crate) fn merge_groups(existing: &mut Vec<ConnectionGroup>, incoming: Vec<ConnectionGroup>) {
    for new_group in incoming {
        if let Some(existing_group) = existing.iter_mut().find(|g| g.id == new_group.id) {
            *existing_group = new_group;
        } else {
            existing.push(new_group);
        }
    }

    // Build the set of every group id we now have (post-merge) so we can
    // detect parent_ids that no longer point anywhere. Collected into an
    // owned set to release the immutable borrow before we mutate existing.
    let known_ids: std::collections::HashSet<String> =
        existing.iter().map(|g| g.id.clone()).collect();
    for g in existing.iter_mut() {
        if let Some(parent) = g.parent_id.as_deref() {
            if !known_ids.contains(parent) {
                g.parent_id = None;
            }
        }
    }
}

/// Write the connections file and invalidate the in-memory connection cache so
/// the next `find_connection_by_id` call re-reads fresh data from disk.
pub(crate) fn save_connections_and_invalidate<R: Runtime>(
    app: &AppHandle<R>,
    path: &std::path::Path,
    file: &crate::models::ConnectionsFile,
) -> Result<(), String> {
    persistence::save_connections_file(path, file)?;
    app.state::<std::sync::Arc<crate::connection_cache::ConnectionCache>>()
        .invalidate();
    Ok(())
}

// --- Commands ---

/// Pure, testable core of `set_connection_appearance`.
/// Mutates `file` in place; does not touch disk or Tauri state.
pub(crate) fn set_appearance_impl(
    file: &mut ConnectionsFile,
    id: &str,
    appearance: Option<crate::models::ConnectionAppearance>,
) -> Result<(), String> {
    let conn = file
        .connections
        .iter_mut()
        .find(|c| c.id == id)
        .ok_or("Connection not found")?;
    conn.appearance = appearance;
    Ok(())
}

// ==================== SSH Connection Management ====================

/// Migrates old embedded SSH connections to separate SSH connection entries
pub(crate) async fn migrate_ssh_connections<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let conn_path = get_config_path(app)?;
    if !conn_path.exists() {
        return Ok(()); // Nothing to migrate
    }

    // Load connections using persistence (handles both old and new formats)
    let mut conn_file = persistence::load_connections_file(&conn_path)?;
    let connections = &conn_file.connections;

    // Check if any connections have old embedded SSH params
    let needs_migration = connections
        .iter()
        .any(|c| c.params.ssh_enabled.unwrap_or(false) && c.params.ssh_connection_id.is_none());

    if !needs_migration {
        return Ok(()); // No migration needed
    }

    println!("[Migration] Starting SSH connections migration...");

    let ssh_path = get_ssh_config_path(app)?;
    let mut ssh_connections: Vec<SshConnection> = if ssh_path.exists() {
        let ssh_content = fs::read_to_string(&ssh_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&ssh_content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let mut migrated_connections = Vec::new();
    let mut ssh_connection_map: HashMap<String, String> = HashMap::new(); // (ssh_key -> ssh_id)

    for mut conn in conn_file.connections.clone() {
        if conn.params.ssh_enabled.unwrap_or(false) && conn.params.ssh_connection_id.is_none() {
            // Extract SSH params
            if let (Some(host), Some(user)) = (&conn.params.ssh_host, &conn.params.ssh_user) {
                let port = conn.params.ssh_port.unwrap_or(22);
                let key_file = conn.params.ssh_key_file.clone().unwrap_or_default();

                // Create unique key for this SSH config
                let ssh_key = format!("{}:{}:{}:{}", host, port, user, key_file);

                // Check if we already created an SSH connection for this config
                let ssh_id = if let Some(existing_id) = ssh_connection_map.get(&ssh_key) {
                    existing_id.clone()
                } else {
                    // Create new SSH connection
                    let new_ssh_id = Uuid::new_v4().to_string();
                    let ssh_name = format!("{}@{}", user, host);

                    // Migrate credentials from connection keychain to SSH keychain
                    if conn.params.save_in_keychain.unwrap_or(false) {
                        if let Ok(ssh_pwd) = keychain_utils::get_ssh_password(&conn.id, &conn.name)
                        {
                            if !ssh_pwd.trim().is_empty() {
                                keychain_utils::set_ssh_password(&new_ssh_id, &ssh_pwd).ok();
                            }
                        }
                        if let Ok(ssh_pass) =
                            keychain_utils::get_ssh_key_passphrase(&conn.id, &conn.name)
                        {
                            if !ssh_pass.trim().is_empty() {
                                keychain_utils::set_ssh_key_passphrase(&new_ssh_id, &ssh_pass).ok();
                            }
                        }
                    }

                    let new_ssh_conn = SshConnection {
                        id: new_ssh_id.clone(),
                        name: ssh_name,
                        host: host.clone(),
                        port,
                        user: user.clone(),
                        auth_type: Some(if !key_file.is_empty() {
                            "ssh_key".to_string()
                        } else {
                            "password".to_string()
                        }),
                        password: None,
                        key_file: if key_file.is_empty() {
                            None
                        } else {
                            Some(key_file.clone())
                        },
                        key_passphrase: None,
                        allow_passphrase_prompt: None,
                        save_in_keychain: conn.params.save_in_keychain,
                    };

                    ssh_connections.push(new_ssh_conn);
                    ssh_connection_map.insert(ssh_key, new_ssh_id.clone());
                    new_ssh_id
                };

                // Update connection to reference the SSH connection
                conn.params.ssh_connection_id = Some(ssh_id);
                // Clear old embedded SSH params
                conn.params.ssh_host = None;
                conn.params.ssh_port = None;
                conn.params.ssh_user = None;
                conn.params.ssh_password = None;
                conn.params.ssh_key_file = None;
                conn.params.ssh_key_passphrase = None;
            }
        }

        migrated_connections.push(conn);
    }

    // Save migrated SSH connections
    let ssh_json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(ssh_path, ssh_json).map_err(|e| e.to_string())?;

    // Save migrated connections using new format (preserving groups)
    conn_file.connections = migrated_connections;
    save_connections_and_invalidate(app, &conn_path, &conn_file)?;

    println!(
        "[Migration] Successfully migrated {} SSH connections",
        ssh_connections.len()
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// Kubernetes Connections
// ---------------------------------------------------------------------------

/// Load K8s connections synchronously from the config file.
pub(crate) fn load_k8s_connections_sync<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Vec<K8sConnection>, String> {
    let path = get_k8s_config_path(app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&content).unwrap_or_default())
}

/// Get the path to the k8s_connections.json file.
pub(crate) fn get_k8s_config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("k8s_connections.json"))
}

pub(crate) fn cancel_query_impl(
    state: &QueryCancellationState,
    connection_id: &str,
) -> Result<(), String> {
    let entries = crate::infrastructure::cancellation::abort_slot(&state.handles, connection_id);
    if entries.is_empty() {
        return Err("No running query found".into());
    }
    for handle in entries {
        handle.abort();
    }
    Ok(())
}

/// Payload for the `batch-statement-complete` event, emitted once per
/// statement the instant it finishes so the frontend can mark that result tab
/// done in real time instead of waiting for the whole batch. `batch_id` lets a
/// listener ignore events from other concurrent runs; `index` maps back to the
/// statement's slot. Borrows the result so no clone of the (potentially large)
/// row set is needed.
#[derive(serde::Serialize, Clone)]
pub(crate) struct BatchStatementEvent<'a> {
    pub(crate) batch_id: &'a str,
    pub(crate) index: usize,
    pub(crate) statement: &'a BatchStatementResult,
}

// --- Explain Query Plan ---

// --- Count Query ---

// --- Window Title Management ---

/// Builds a connection URL for a database driver.
#[cfg(test)]
pub async fn build_connection_url(params: &ConnectionParams) -> Result<String, String> {
    let user = encode(params.username.as_deref().unwrap_or_default());
    let raw_pass = params.password.as_deref().unwrap_or_default();
    let credentials = if raw_pass.is_empty() {
        user.into_owned()
    } else {
        format!("{}:{}", user, encode(raw_pass))
    };
    let host = params.host.as_deref().unwrap_or("localhost");

    match params.driver.as_str() {
        "sqlite" => Ok(format!("sqlite://{}", params.database)),
        "postgres" => Ok(format!(
            "postgres://{}@{}:{}/{}",
            credentials,
            host,
            params.port.unwrap_or(DEFAULT_POSTGRES_PORT),
            params.database
        )),
        "mysql" => Ok(format!(
            "mysql://{}@{}:{}/{}",
            credentials,
            host,
            params.port.unwrap_or(DEFAULT_MYSQL_PORT),
            params.database
        )),
        _ => Err("Unsupported driver".into()),
    }
}

pub(crate) fn resolve_test_connection_password(
    params: &ConnectionParams,
    saved_conn: Option<&SavedConnection>,
    get_keychain_password: impl Fn(&str) -> Result<String, String>,
) -> Option<String> {
    if let Some(pwd) = &params.password {
        return Some(pwd.clone());
    }

    let saved = saved_conn?;

    if saved.params.save_in_keychain.unwrap_or(false) {
        if let Ok(pwd) = get_keychain_password(&saved.id) {
            if !pwd.trim().is_empty() {
                return Some(pwd);
            }
        }
    }

    match &saved.params.password {
        Some(pwd) if !pwd.trim().is_empty() => Some(pwd.clone()),
        _ => None,
    }
}

/// Resolves SSH credential (password or passphrase) for testing
/// 1. Credential from request params (if provided, even if empty)
/// 2. Credential from keychain (if save_in_keychain is enabled)
/// 3. Credential from saved connection (as fallback)
pub(crate) fn resolve_ssh_test_credential(
    request_credential: Option<&str>,
    connection_id: Option<&str>,
    get_ssh_connection: impl Fn(&str) -> Option<SshConnection>,
    get_keychain_credential: impl Fn(&str) -> Result<String, String>,
    extract_saved_credential: impl Fn(&SshConnection) -> Option<String>,
) -> Option<String> {
    // Priority 1: Credential from request
    // If credential field is present in request, use it even if empty
    // Empty string means "use empty credential", not "fallback to keychain"
    if let Some(cred) = request_credential {
        return Some(cred.to_string());
    }

    // If no connection_id, we can't look up saved credentials
    let conn_id = connection_id?;
    let saved = get_ssh_connection(conn_id)?;

    // Priority 2: Credential from keychain
    if saved.save_in_keychain.unwrap_or(false) {
        if let Ok(cred) = get_keychain_credential(conn_id) {
            if !cred.trim().is_empty() {
                return Some(cred);
            }
        }
    }

    // Priority 3: Credential from saved connection
    extract_saved_credential(&saved)
}

/// Helper for backward compatibility - resolves SSH password
pub(crate) fn resolve_ssh_test_password(
    request_password: Option<&str>,
    connection_id: Option<&str>,
    get_ssh_connection: impl Fn(&str) -> Option<SshConnection>,
    get_keychain_password: impl Fn(&str) -> Result<String, String>,
) -> Option<String> {
    resolve_ssh_test_credential(
        request_password,
        connection_id,
        get_ssh_connection,
        get_keychain_password,
        |conn| {
            conn.password
                .as_ref()
                .filter(|p| !p.trim().is_empty())
                .cloned()
        },
    )
}

// ==================== View Management Commands ====================

// --- Type Registry ---

// --- DDL generation commands ---

// ==================== Connection Groups Management ====================

/// Splits a `/`-separated group path into trimmed, non-empty segments.
/// Returns an error if the result is empty.
pub(crate) fn parse_group_path(path: &str) -> Result<Vec<String>, String> {
    let segments: Vec<String> = path
        .split('/')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if segments.is_empty() {
        return Err("Group path cannot be empty".to_string());
    }
    Ok(segments)
}

/// Finds an existing group by case-insensitive name match within a parent's
/// children, or `None` if no such group exists.
pub(crate) fn find_child_group<'a>(
    groups: &'a [ConnectionGroup],
    name: &str,
    parent_id: &Option<String>,
) -> Option<&'a ConnectionGroup> {
    let name_lower = name.to_lowercase();
    groups
        .iter()
        .find(|g| g.name.to_lowercase() == name_lower && g.parent_id == *parent_id)
}

/// Reject re-parenting that would create a cycle: `target` must not be a
/// descendant of `group_id`. Walks up from `target` looking for `group_id`.
/// Bounded by `groups.len()` to fail-safe against pre-existing data cycles.
pub(crate) fn reject_if_would_create_cycle(
    groups: &[ConnectionGroup],
    group_id: &str,
    new_parent_id: Option<&str>,
) -> Result<(), String> {
    let Some(target) = new_parent_id else {
        return Ok(());
    };
    let mut current = Some(target.to_string());
    let mut visited = std::collections::HashSet::new();
    let max_steps = groups.len() + 1;
    for _ in 0..max_steps {
        match current {
            Some(node) if node == group_id => {
                return Err(
                    "Cannot move a group into one of its own descendants (would create a cycle)"
                        .to_string(),
                );
            }
            Some(node) => {
                if !visited.insert(node.clone()) {
                    return Err(
                        "Connection-group tree contains a pre-existing cycle; refusing to modify it"
                            .to_string(),
                    );
                }
                current = groups
                    .iter()
                    .find(|g| g.id == node)
                    .and_then(|g| g.parent_id.clone());
            }
            None => return Ok(()),
        }
    }
    Err(
        "Connection-group tree is deeper than the number of groups; refusing to modify it"
            .to_string(),
    )
}

/// Merge an `ExportPayload` into the user's stored connections, groups, SSH and
/// K8s records, moving any inline secrets into the keychain. Shared by the JSON
/// import command above and the foreign-app import flow.
pub async fn apply_export_payload<R: Runtime>(
    app: AppHandle<R>,
    payload: ExportPayload,
) -> Result<(), String> {
    let conn_path = get_config_path(&app)?;
    let ssh_path = get_ssh_config_path(&app)?;

    let mut current_file = persistence::load_connections_file(&conn_path).unwrap_or_default();
    let mut current_ssh = if ssh_path.exists() {
        let content = fs::read_to_string(&ssh_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<SshConnection>>(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let cache = app
        .state::<std::sync::Arc<crate::credential_cache::CredentialCache>>()
        .inner()
        .clone();

    // Merge groups (preserves hierarchy; demotes orphaned parent_ids to root)
    merge_groups(&mut current_file.groups, payload.groups);

    // Merge connections and handle passwords
    for mut new_conn in payload.connections {
        // Handle passwords in keychain
        if new_conn.params.save_in_keychain.unwrap_or(false) {
            if let Some(pwd) = &new_conn.params.password {
                keychain_utils::set_db_password(&new_conn.id, pwd)?;
                credential_cache::set_db_password_cached(&cache, &new_conn.id, pwd);
            }
            if new_conn.params.ssh_enabled.unwrap_or(false) {
                if let Some(ssh_pwd) = &new_conn.params.ssh_password {
                    keychain_utils::set_ssh_password(&new_conn.id, ssh_pwd)?;
                    credential_cache::set_ssh_password_cached(&cache, &new_conn.id, ssh_pwd);
                }
                if let Some(ssh_passphrase) = &new_conn.params.ssh_key_passphrase {
                    keychain_utils::set_ssh_key_passphrase(&new_conn.id, ssh_passphrase)?;
                    credential_cache::set_ssh_key_passphrase_cached(
                        &cache,
                        &new_conn.id,
                        ssh_passphrase,
                    );
                }
            }
            // Clear passwords from struct before saving to disk
            new_conn.params.password = None;
            new_conn.params.ssh_password = None;
            new_conn.params.ssh_key_passphrase = None;
        }

        if let Some(existing) = current_file
            .connections
            .iter_mut()
            .find(|c| c.id == new_conn.id)
        {
            *existing = new_conn;
        } else {
            current_file.connections.push(new_conn);
        }
    }

    // Merge SSH connections and handle passwords
    for mut new_ssh in payload.ssh_connections {
        if new_ssh.save_in_keychain.unwrap_or(false) {
            if let Some(pwd) = &new_ssh.password {
                keychain_utils::set_ssh_password(&new_ssh.id, pwd)?;
                credential_cache::set_ssh_password_cached(&cache, &new_ssh.id, pwd);
            }
            if let Some(passphrase) = &new_ssh.key_passphrase {
                keychain_utils::set_ssh_key_passphrase(&new_ssh.id, passphrase)?;
                credential_cache::set_ssh_key_passphrase_cached(&cache, &new_ssh.id, passphrase);
            }
            // Clear passwords from struct before saving to disk
            new_ssh.password = None;
            new_ssh.key_passphrase = None;
        }

        if let Some(existing) = current_ssh.iter_mut().find(|s| s.id == new_ssh.id) {
            *existing = new_ssh;
        } else {
            current_ssh.push(new_ssh);
        }
    }

    // Save files
    save_connections_and_invalidate(&app, &conn_path, &current_file)?;
    let ssh_json = serde_json::to_string_pretty(&current_ssh).map_err(|e| e.to_string())?;
    fs::write(ssh_path, ssh_json).map_err(|e| e.to_string())?;

    // Merge K8s connections
    let k8s_path = get_k8s_config_path(&app)?;
    let mut current_k8s = load_k8s_connections_sync(&app)?;
    for new_k8s in payload.k8s_connections {
        if let Some(existing) = current_k8s.iter_mut().find(|k| k.id == new_k8s.id) {
            *existing = new_k8s;
        } else {
            current_k8s.push(new_k8s);
        }
    }
    let k8s_json = serde_json::to_string_pretty(&current_k8s).map_err(|e| e.to_string())?;
    fs::write(k8s_path, k8s_json).map_err(|e| e.to_string())?;

    Ok(())
}
