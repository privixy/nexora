use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::task::AbortHandle;
use urlencoding::encode;
use uuid::Uuid;

use crate::connection_params::apply_database_override;
use crate::credential_cache;
use crate::keychain_utils;
use crate::models::{
    BatchStatementResult, ColumnDefinition, ConnectionGroup, ConnectionParams, ConnectionsFile,
    ExplainPlan, ExportPayload, ForeignKey, Index, K8sConnection, K8sConnectionInput, QueryResult,
    RoutineInfo, RoutineParameter, SavedConnection, SshConnection, SshConnectionInput,
    SshTestParams, TableColumn, TableInfo, TestConnectionRequest, TriggerInfo,
};
use crate::persistence;
use crate::ssh_tunnel::{get_tunnels, SshTunnel};
use crate::window_title::format_window_title;

// Constants
/// Resolve the driver from the registry or return a descriptive error.
pub(crate) async fn driver_for(
    id: &str,
) -> Result<std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>, String> {
    crate::drivers::registry::get_driver(id)
        .await
        .ok_or_else(|| format!("Unsupported driver: {}", id))
}

const DEFAULT_MYSQL_PORT: u16 = 3306;
const DEFAULT_POSTGRES_PORT: u16 = 5432;

/// Per-slot collection of abort handles for in-flight cancellable tasks.
/// Used by `QueryCancellationState`, `ExportCancellationState`, and
/// `DumpCancellationState`.
pub(crate) type AbortHandleMap = HashMap<String, Vec<Arc<AbortHandle>>>;

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

/// Push `handle` into the slot for `key`, first pruning any handles that
/// have already finished so the Vec does not grow unboundedly across many
/// sequential queries on the same connection.
pub(crate) fn register_abort_handle(
    handles: &Mutex<AbortHandleMap>,
    key: String,
    handle: Arc<AbortHandle>,
) {
    let mut guard = handles.lock().unwrap();
    let entry = guard.entry(key).or_default();
    entry.retain(|h| !h.is_finished());
    entry.push(handle);
}

/// Remove the specific handle (matched by Arc identity) that a completing
/// task registered, so it cannot fire on a future query that happens to
/// reuse the same slot.
pub(crate) fn unregister_abort_handle(
    handles: &Mutex<AbortHandleMap>,
    key: &str,
    handle: &Arc<AbortHandle>,
) {
    let mut guard = handles.lock().unwrap();
    if let Some(entry) = guard.get_mut(key) {
        entry.retain(|h| !Arc::ptr_eq(h, handle));
        if entry.is_empty() {
            guard.remove(key);
        }
    }
}

/// Trims trailing semicolons and normalises Unicode smart quotes that some
/// editors insert when the user pastes a query. Called on every query the
/// UI hands off to a driver.
pub(crate) fn sanitize_user_query(query: &str) -> String {
    query
        .trim()
        .trim_end_matches(';')
        .replace('\u{2018}', "'")
        .replace('\u{2019}', "'")
        .replace('\u{201C}', "\"")
        .replace('\u{201D}', "\"")
}

// --- Persistence Helpers ---

/// Load a single SSH connection by ID, fetching only its credentials from
/// keychain (via the in-memory cache). This is O(1) keychain calls versus the
/// O(N) behaviour of `get_ssh_connections`, which loads every saved SSH
/// connection and retrieves credentials for each one.
async fn get_ssh_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    ssh_id: &str,
) -> Result<SshConnection, String> {
    let path = get_ssh_config_path(app)?;
    if !path.exists() {
        return Err(format!("SSH connection with ID {} not found", ssh_id));
    }

    // File I/O off the Tokio executor thread
    let content = tokio::task::spawn_blocking({
        let path = path.clone();
        move || std::fs::read_to_string(path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut ssh = serde_json::from_str::<Vec<SshConnection>>(&content)
        .unwrap_or_default()
        .into_iter()
        .find(|s| s.id == ssh_id)
        .ok_or_else(|| format!("SSH connection with ID {} not found", ssh_id))?;

    // Backward compat: determine auth_type if absent (mirrors get_ssh_connections logic)
    if ssh.auth_type.is_none() {
        ssh.auth_type = Some(
            if ssh
                .key_file
                .as_ref()
                .map_or(false, |k| !k.trim().is_empty())
            {
                "ssh_key".to_string()
            } else {
                "password".to_string()
            },
        );
    }

    // Fetch credentials only for this connection, via the in-memory cache.
    // On a warm cache hit this is a HashMap lookup (nanoseconds); on a cold miss
    // it calls keychain once per credential and then caches the result.
    if ssh.save_in_keychain.unwrap_or(false) {
        // Clone the Arc out of the Tauri State so the closure owns it ('static bound)
        let cache = app
            .state::<std::sync::Arc<crate::credential_cache::CredentialCache>>()
            .inner()
            .clone();
        let id = ssh.id.clone();
        let (pwd_r, pass_r) = tokio::task::spawn_blocking(move || {
            let pwd = credential_cache::get_ssh_password_cached(&cache, &id);
            let pass = credential_cache::get_ssh_key_passphrase_cached(&cache, &id);
            (pwd, pass)
        })
        .await
        .map_err(|e| e.to_string())?;

        if let Ok(v) = pwd_r {
            if !v.trim().is_empty() {
                ssh.password = Some(v);
            }
        }
        if let Ok(v) = pass_r {
            if !v.trim().is_empty() {
                ssh.key_passphrase = Some(v);
            }
        }
    }

    Ok(ssh)
}

pub async fn expand_ssh_connection_params<R: Runtime>(
    app: &AppHandle<R>,
    params: &ConnectionParams,
) -> Result<ConnectionParams, String> {
    let mut expanded_params = params.clone();

    // If ssh_connection_id is set and SSH is enabled, load the SSH connection and merge it
    if params.ssh_enabled.unwrap_or(false) {
        if let Some(ssh_id) = &params.ssh_connection_id {
            // Use targeted lookup instead of loading all SSH connections:
            // this calls keychain only for this specific connection (O(1)),
            // and results are backed by the in-memory credential cache.
            let ssh_conn = get_ssh_connection_by_id(app, ssh_id).await?;

            // Populate legacy SSH fields from the SSH connection
            expanded_params.ssh_host = Some(ssh_conn.host.clone());
            expanded_params.ssh_port = Some(ssh_conn.port);
            expanded_params.ssh_user = Some(ssh_conn.user.clone());
            expanded_params.ssh_password = ssh_conn.password.clone();
            expanded_params.ssh_key_file = ssh_conn.key_file.clone();
            expanded_params.ssh_key_passphrase = ssh_conn.key_passphrase.clone();
            expanded_params.ssh_allow_passphrase_prompt = ssh_conn.allow_passphrase_prompt;
        }
    }

    Ok(expanded_params)
}

/// Check if a string option is empty or contains only whitespace.
#[inline]
#[cfg(test)]
pub(crate) fn is_empty_or_whitespace(s: &Option<String>) -> bool {
    s.as_ref().map(|p| p.trim().is_empty()).unwrap_or(true)
}

/// Build the SSH tunnel map key for caching tunnels.
#[inline]
fn build_tunnel_map_key(
    ssh_user: &str,
    ssh_host: &str,
    ssh_port: u16,
    remote_host: &str,
    remote_port: u16,
) -> String {
    crate::ssh_tunnel::build_tunnel_key(ssh_user, ssh_host, ssh_port, remote_host, remote_port)
}

/// Resolve K8s tunnel params synchronously (no saved-connection lookup; uses inline fields only).
pub(crate) fn resolve_k8s_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
    let context = params.k8s_context.as_deref().ok_or("Missing K8s context")?;
    let namespace = params
        .k8s_namespace
        .as_deref()
        .ok_or("Missing K8s namespace")?;
    let resource_type = params
        .k8s_resource_type
        .as_deref()
        .ok_or("Missing K8s resource type")?;
    let resource_name = params
        .k8s_resource_name
        .as_deref()
        .ok_or("Missing K8s resource name")?;
    let port = params.k8s_port.ok_or("Missing K8s port")?;

    let map_key =
        crate::k8s_tunnel::build_tunnel_key(context, namespace, resource_type, resource_name, port);

    // Check for existing tunnel
    {
        let tunnels = crate::k8s_tunnel::get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&map_key) {
            log::debug!("Reusing existing K8s tunnel on port {}", tunnel.local_port);
            let mut new_params = params.clone();
            new_params.k8s_enabled = Some(false);
            new_params.host = Some("127.0.0.1".to_string());
            new_params.port = Some(tunnel.local_port);
            return Ok(new_params);
        }
    }

    log::info!(
        "Creating new K8s tunnel for {}/{} in {}:{} (context: {})",
        resource_type,
        resource_name,
        namespace,
        port,
        context
    );

    let tunnel =
        crate::k8s_tunnel::K8sTunnel::new(context, namespace, resource_type, resource_name, port)
            .map_err(|e| {
            eprintln!("[Connection Error] K8s Tunnel setup failed: {}", e);
            e
        })?;

    let local_port = tunnel.local_port;
    log::info!("K8s tunnel created successfully on port {}", local_port);

    {
        let mut tunnels = crate::k8s_tunnel::get_tunnels().lock().unwrap();
        tunnels.insert(map_key, tunnel);
    }

    let mut new_params = params.clone();
    new_params.k8s_enabled = Some(false);
    new_params.host = Some("127.0.0.1".to_string());
    new_params.port = Some(local_port);
    Ok(new_params)
}

pub fn resolve_connection_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
    // K8s and SSH are mutually exclusive
    if params.k8s_enabled.unwrap_or(false) && params.ssh_enabled.unwrap_or(false) {
        return Err(
            "Kubernetes and SSH tunnel cannot both be enabled for the same connection".to_string(),
        );
    }

    // Handle K8s tunnel
    if params.k8s_enabled.unwrap_or(false) {
        return resolve_k8s_params(params);
    }

    // Handle SSH tunnel (existing logic)
    if !params.ssh_enabled.unwrap_or(false) {
        return Ok(params.clone());
    }

    let ssh_host = params.ssh_host.as_deref().ok_or("Missing SSH Host")?;
    let ssh_port = params.ssh_port.unwrap_or(22);
    let ssh_user = params.ssh_user.as_deref().ok_or("Missing SSH User")?;
    let remote_host = params.host.as_deref().unwrap_or("localhost");
    let remote_port = params.port.unwrap_or(DEFAULT_MYSQL_PORT);

    let map_key = build_tunnel_map_key(ssh_user, ssh_host, ssh_port, remote_host, remote_port);

    // Check for existing tunnel
    {
        let tunnels = get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&map_key) {
            log::debug!("Reusing existing SSH tunnel on port {}", tunnel.local_port);
            let mut new_params = params.clone();
            new_params.host = Some("127.0.0.1".to_string());
            new_params.port = Some(tunnel.local_port);
            return Ok(new_params);
        }
    }

    // Create new tunnel
    log::info!(
        "Creating new SSH tunnel for {}@{}:{}",
        ssh_user,
        ssh_host,
        ssh_port
    );
    let tunnel = SshTunnel::new(
        ssh_host,
        ssh_port,
        ssh_user,
        params.ssh_password.as_deref(),
        params.ssh_key_file.as_deref(),
        params.ssh_key_passphrase.as_deref(),
        params.ssh_allow_passphrase_prompt.unwrap_or(false),
        remote_host,
        remote_port,
    )
    .map_err(|e| {
        eprintln!("[Connection Error] SSH Tunnel setup failed: {}", e);
        e
    })?;

    let local_port = tunnel.local_port;
    log::info!("SSH tunnel created successfully on port {}", local_port);

    {
        let mut tunnels = get_tunnels().lock().unwrap();
        tunnels.insert(map_key, tunnel);
    }

    let mut new_params = params.clone();
    new_params.host = Some("127.0.0.1".to_string());
    new_params.port = Some(local_port);
    Ok(new_params)
}

/// Resolve connection params and set connection_id for stable pooling
pub fn resolve_connection_params_with_id(
    params: &ConnectionParams,
    connection_id: &str,
) -> Result<ConnectionParams, String> {
    let mut resolved = resolve_connection_params(params)?;
    resolved.connection_id = Some(connection_id.to_string());
    Ok(resolved)
}

pub fn get_config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(crate::paths::resolve_connections_path(&config_dir))
}

pub fn get_ssh_config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    Ok(config_dir.join("ssh_connections.json"))
}

pub fn find_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
) -> Result<SavedConnection, String> {
    let conn_cache = app.state::<std::sync::Arc<crate::connection_cache::ConnectionCache>>();

    let mut conn = match conn_cache.lookup(id) {
        crate::connection_cache::CacheLookup::Hit(c) => c,
        crate::connection_cache::CacheLookup::Miss => {
            return Err("Connection not found".to_string())
        }
        crate::connection_cache::CacheLookup::Cold => {
            let path = get_config_path(app)?;
            let conn_file = persistence::load_connections_file(&path).unwrap_or_default();
            conn_cache.populate(&conn_file.connections);
            conn_file
                .connections
                .into_iter()
                .find(|c| c.id == id)
                .ok_or_else(|| "Connection not found".to_string())?
        }
    };

    // Load passwords from keychain if needed, via the in-memory cache.
    // On a warm cache hit this is a HashMap lookup (nanoseconds); on a cold miss
    // it calls keychain once and caches the result for all subsequent reads.
    if conn.params.save_in_keychain.unwrap_or(false) {
        let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
        match credential_cache::get_db_password_cached(&cache, &conn.id) {
            Ok(pwd) => conn.params.password = Some(pwd),
            Err(e) => eprintln!(
                "[Keyring Error] Failed to get DB password for {}: {}",
                conn.id, e
            ),
        }
        if conn.params.ssh_enabled.unwrap_or(false) {
            if let Ok(ssh_pwd) = credential_cache::get_ssh_password_cached(&cache, &conn.id) {
                if !ssh_pwd.trim().is_empty() {
                    conn.params.ssh_password = Some(ssh_pwd);
                }
            }
            if let Ok(ssh_passphrase) =
                credential_cache::get_ssh_key_passphrase_cached(&cache, &conn.id)
            {
                if !ssh_passphrase.trim().is_empty() {
                    conn.params.ssh_key_passphrase = Some(ssh_passphrase);
                }
            }
        }
    }

    Ok(conn)
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

/// Expand K8s connection params by loading saved config and creating/reusing a tunnel.
pub async fn expand_k8s_connection_params<R: Runtime>(
    app: &AppHandle<R>,
    params: &ConnectionParams,
) -> Result<ConnectionParams, String> {
    if !params.k8s_enabled.unwrap_or(false) {
        return Ok(params.clone());
    }

    // Mutual exclusion: K8s and SSH cannot both be active
    if params.ssh_enabled.unwrap_or(false) {
        return Err(
            "Kubernetes and SSH tunnel cannot both be enabled for the same connection".to_string(),
        );
    }

    // Resolve K8s params from saved connection if using connection_id
    let (context, namespace, resource_type, resource_name, port) =
        if let Some(k8s_id) = &params.k8s_connection_id {
            let k8s_conn = get_k8s_connection_by_id(app, k8s_id).await?;
            (
                k8s_conn.context,
                k8s_conn.namespace,
                k8s_conn.resource_type,
                k8s_conn.resource_name,
                k8s_conn.port,
            )
        } else {
            let ctx = params
                .k8s_context
                .as_deref()
                .ok_or("Missing K8s context")?
                .to_string();
            let ns = params
                .k8s_namespace
                .as_deref()
                .ok_or("Missing K8s namespace")?
                .to_string();
            let rt = params
                .k8s_resource_type
                .as_deref()
                .ok_or("Missing K8s resource type")?
                .to_string();
            let rn = params
                .k8s_resource_name
                .as_deref()
                .ok_or("Missing K8s resource name")?
                .to_string();
            let p = params.k8s_port.ok_or("Missing K8s port")?;
            (ctx, ns, rt, rn, p)
        };

    let _remote_host = params.host.as_deref().unwrap_or("localhost");
    let _remote_port = params.port.unwrap_or(DEFAULT_MYSQL_PORT);

    let map_key = crate::k8s_tunnel::build_tunnel_key(
        &context,
        &namespace,
        &resource_type,
        &resource_name,
        port,
    );

    // Check for existing tunnel
    {
        let tunnels = crate::k8s_tunnel::get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&map_key) {
            log::debug!("Reusing existing K8s tunnel on port {}", tunnel.local_port);
            let mut new_params = params.clone();
            new_params.k8s_enabled = Some(false);
            new_params.host = Some("127.0.0.1".to_string());
            new_params.port = Some(tunnel.local_port);
            return Ok(new_params);
        }
    }

    // Create new tunnel
    log::info!(
        "Creating new K8s tunnel for {}/{} in {}:{} (context: {})",
        resource_type,
        resource_name,
        namespace,
        port,
        context
    );

    let tunnel = crate::k8s_tunnel::K8sTunnel::new(
        &context,
        &namespace,
        &resource_type,
        &resource_name,
        port,
    )
    .map_err(|e| {
        eprintln!("[Connection Error] K8s Tunnel setup failed: {}", e);
        e
    })?;

    let local_port = tunnel.local_port;
    log::info!("K8s tunnel created successfully on port {}", local_port);

    {
        let mut tunnels = crate::k8s_tunnel::get_tunnels().lock().unwrap();
        tunnels.insert(map_key, tunnel);
    }

    let mut new_params = params.clone();
    new_params.k8s_enabled = Some(false);
    new_params.host = Some("127.0.0.1".to_string());
    new_params.port = Some(local_port);
    Ok(new_params)
}

/// Load a K8s connection by ID from the config file.
async fn get_k8s_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    k8s_id: &str,
) -> Result<K8sConnection, String> {
    let path = get_k8s_config_path(app)?;
    if !path.exists() {
        return Err(format!("K8s connection with ID {} not found", k8s_id));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let connections: Vec<K8sConnection> = serde_json::from_str(&content).unwrap_or_default();
    connections
        .into_iter()
        .find(|c| c.id == k8s_id)
        .ok_or_else(|| format!("K8s connection with ID {} not found", k8s_id))
}

/// Fetches a BLOB column from the database and returns it as a data: URL for image preview.
/// Same query logic as save_blob_to_file but returns the data in-memory instead of writing to disk.

/// Detects the MIME type of base64-encoded binary data using magic-byte analysis
/// and returns the canonical blob wire format: "BLOB:<size>:<mime>:<base64>".
/// Called by the frontend after the user selects a file to upload.

/// Prepares a file for BLOB upload by returning only metadata and a file reference.
/// The actual file content is NOT transferred over IPC, avoiding massive string allocations.
/// The file content will be read directly from disk when needed (e.g., during INSERT/UPDATE).
/// Returns a special "BLOB_FILE_REF" format that includes file path, size, and MIME type.

/// Detects the MIME type from a small base64-encoded header (first ~8KB).
/// Returns only the MIME type string — the frontend constructs the wire format
/// locally, avoiding a full round-trip of the entire file over IPC.

/// Gets file statistics (size and MIME type) without reading the entire file.
/// Used after streaming upload to construct the final wire format.

/// Reads a file from disk and returns it as a base64-encoded data URL.
/// Used for image preview of BLOB_FILE_REF values without requiring frontend FS permissions.
/// Only available for image files; returns an error for non-image MIME types.

pub(crate) fn cancel_query_impl(
    state: &QueryCancellationState,
    connection_id: &str,
) -> Result<(), String> {
    let entries = {
        let mut handles = state.handles.lock().unwrap();
        handles.remove(connection_id).unwrap_or_default()
    };
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

/// Runs a sequence of statements that share a single physical database
/// connection. Use this — not multiple parallel `execute_query` calls —
/// whenever statements depend on connection-local session state
/// (`SET @var`, `LAST_INSERT_ID()` / `LASTVAL()`, `BEGIN`/`COMMIT`,
/// `TEMPORARY TABLE`, `PREPARE`/`EXECUTE`, `SET FOREIGN_KEY_CHECKS = 0`).
///
/// The whole batch shares one cancellation handle so `cancel_query`
/// aborts the entire batch atomically.
///
/// When `batch_id` is supplied, a `batch-statement-complete` event is emitted
/// after each statement so the UI updates result tabs progressively. The full
/// `Vec` is still returned at the end for final reconciliation / fallback.

// --- Explain Query Plan ---

// --- Count Query ---

// --- Window Title Management ---

/// Sets the window title with Wayland workaround
///
/// WORKAROUND: This is a temporary fix for tauri-apps/tauri#13749
/// On Wayland (Linux), the standard `window.setTitle()` API doesn't properly update
/// the window title in the window manager's title bar due to an upstream dependency issue.
/// This command directly manipulates the GTK HeaderBar to ensure the title is visible.
///
/// See: https://github.com/tauri-apps/tauri/issues/13749
///
/// This workaround should be removed once the upstream issue is resolved.

/// Builds a connection URL for a database driver.
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

/// Register a connection as active for health-check pinging.

/// Snapshot of connection ids currently open in the shared backend (across all
/// windows). Used by each window to render cross-window connection status.

/// Disconnect from a database connection by closing its connection pool

// --- Type Registry ---

/// Maps generic inferred types (emitted by the clipboard parser) to
/// driver-specific type names. Returns names in the same order as `kinds`.

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

/// Creates a nested group hierarchy from a `/`-separated path.
///
/// Each segment of `path` becomes one group. Existing segments are reused
/// (looked up case-insensitively among the children of the current parent);
/// missing segments are created in order. The final segment is returned.
/// The hierarchy is created atomically: either every missing segment is
/// persisted or none are.

/// Re-parent a group. Pass `Some(id)` to make it a child of that group,
/// or `None` to make it a top-level root. Cycles are rejected.

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
