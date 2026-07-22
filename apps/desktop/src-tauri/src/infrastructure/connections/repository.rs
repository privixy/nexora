use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::models::{ConnectionsFile, SavedConnection};

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

pub fn find_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
) -> Result<SavedConnection, String> {
    let conn_cache = app.state::<std::sync::Arc<crate::connection_cache::ConnectionCache>>();

    let mut conn = match conn_cache.lookup(id) {
        crate::connection_cache::CacheLookup::Hit(connection) => connection,
        crate::connection_cache::CacheLookup::Miss => return Err("Connection not found".to_string()),
        crate::connection_cache::CacheLookup::Cold => {
            let path = get_config_path(app)?;
            let conn_file = crate::persistence::load_connections_file(&path).unwrap_or_default();
            conn_cache.populate(&conn_file.connections);
            conn_file
                .connections
                .into_iter()
                .find(|connection| connection.id == id)
                .ok_or_else(|| "Connection not found".to_string())?
        }
    };

    if conn.params.save_in_keychain.unwrap_or(false) {
        let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
        match crate::credential_cache::get_db_password_cached(&cache, &conn.id) {
            Ok(password) => conn.params.password = Some(password),
            Err(error) => eprintln!(
                "[Keyring Error] Failed to get DB password for {}: {}",
                conn.id, error
            ),
        }
        if conn.params.ssh_enabled.unwrap_or(false) {
            if let Ok(password) = crate::credential_cache::get_ssh_password_cached(&cache, &conn.id)
            {
                if !password.trim().is_empty() {
                    conn.params.ssh_password = Some(password);
                }
            }
            if let Ok(passphrase) =
                crate::credential_cache::get_ssh_key_passphrase_cached(&cache, &conn.id)
            {
                if !passphrase.trim().is_empty() {
                    conn.params.ssh_key_passphrase = Some(passphrase);
                }
            }
        }
    }

    Ok(conn)
}

pub(crate) fn save_connections_and_invalidate<R: Runtime>(
    app: &AppHandle<R>,
    path: &std::path::Path,
    file: &ConnectionsFile,
) -> Result<(), String> {
    crate::persistence::save_connections_file(path, file)?;
    app.state::<std::sync::Arc<crate::connection_cache::ConnectionCache>>()
        .invalidate();
    Ok(())
}
