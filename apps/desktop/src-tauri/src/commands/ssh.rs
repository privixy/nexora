use std::fs;
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

use crate::credential_cache;
use crate::keychain_utils;
use crate::models::{SshConnection, SshConnectionInput, SshTestParams};

use crate::domains::connections::*;
use crate::infrastructure::connections::get_ssh_config_path;

#[tauri::command]
pub async fn get_ssh_connections<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<SshConnection>, String> {
    let path = get_ssh_config_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    // File I/O off the Tokio executor thread
    let content = tokio::task::spawn_blocking({
        let path = path.clone();
        move || std::fs::read_to_string(path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut ssh_connections: Vec<SshConnection> =
        serde_json::from_str(&content).unwrap_or_default();

    // Backward compatibility: determine auth_type if missing
    for ssh in &mut ssh_connections {
        if ssh.auth_type.is_none() {
            ssh.auth_type = Some(
                if ssh.key_file.as_ref().is_some_and(|k| !k.trim().is_empty()) {
                    "ssh_key".to_string()
                } else {
                    "password".to_string()
                },
            );
        }
    }

    // Fetch credentials for all connections that use keychain, in a single
    // spawn_blocking call. The cache is checked first (HashMap lookup), so
    // subsequent calls (e.g. from the UI refreshing the list) are near-instant.
    let ids_needing_creds: Vec<String> = ssh_connections
        .iter()
        .filter(|s| s.save_in_keychain.unwrap_or(false))
        .map(|s| s.id.clone())
        .collect();

    if !ids_needing_creds.is_empty() {
        // Clone the Arc out of the Tauri State so the closure owns it ('static bound)
        let cache = app
            .state::<std::sync::Arc<crate::credential_cache::CredentialCache>>()
            .inner()
            .clone();
        let credentials = tokio::task::spawn_blocking(move || {
            ids_needing_creds
                .into_iter()
                .map(|id| {
                    let pwd = credential_cache::get_ssh_password_cached(&cache, &id);
                    let pass = credential_cache::get_ssh_key_passphrase_cached(&cache, &id);
                    (id, pwd, pass)
                })
                .collect::<Vec<_>>()
        })
        .await
        .map_err(|e| e.to_string())?;

        for (id, pwd_r, pass_r) in credentials {
            if let Some(ssh) = ssh_connections.iter_mut().find(|s| s.id == id) {
                if let Ok(pwd) = pwd_r {
                    if !pwd.trim().is_empty() {
                        ssh.password = Some(pwd);
                    }
                }
                if let Ok(pass) = pass_r {
                    if !pass.trim().is_empty() {
                        ssh.key_passphrase = Some(pass);
                    }
                }
            }
        }
    }

    Ok(ssh_connections)
}

#[tauri::command]
pub async fn save_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    ssh: SshConnectionInput,
) -> Result<SshConnection, String> {
    let path = get_ssh_config_path(&app)?;
    let mut ssh_connections: Vec<SshConnection> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let id = Uuid::new_v4().to_string();
    let ssh_to_save = SshConnection {
        id: id.clone(),
        name: name.clone(),
        host: ssh.host,
        port: ssh.port,
        user: ssh.user,
        auth_type: Some(ssh.auth_type.clone()),
        password: if ssh.save_in_keychain.unwrap_or(false) {
            let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
            if let Some(pwd) = &ssh.password {
                keychain_utils::set_ssh_password(&id, pwd)?;
                credential_cache::set_ssh_password_cached(&cache, &id, pwd);
            }
            None
        } else {
            ssh.password.clone()
        },
        key_file: ssh.key_file.clone(),
        key_passphrase: if ssh.save_in_keychain.unwrap_or(false) {
            let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
            if let Some(passphrase) = &ssh.key_passphrase {
                if !passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&id, passphrase)?;
                    credential_cache::set_ssh_key_passphrase_cached(&cache, &id, passphrase);
                }
            }
            None
        } else {
            ssh.key_passphrase.clone()
        },
        allow_passphrase_prompt: ssh.allow_passphrase_prompt,
        save_in_keychain: ssh.save_in_keychain,
    };

    ssh_connections.push(ssh_to_save.clone());
    let json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_ssh = ssh_to_save;
    returned_ssh.password = ssh.password;
    returned_ssh.key_passphrase = ssh.key_passphrase;
    Ok(returned_ssh)
}

#[tauri::command]
pub async fn update_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    name: String,
    ssh: SshConnectionInput,
) -> Result<SshConnection, String> {
    let path = get_ssh_config_path(&app)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut ssh_connections: Vec<SshConnection> =
        serde_json::from_str(&content).unwrap_or_default();

    let ssh_idx = ssh_connections
        .iter()
        .position(|s| s.id == id)
        .ok_or("SSH connection not found")?;

    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    if ssh.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &ssh.password {
            keychain_utils::set_ssh_password(&id, pwd)?;
            credential_cache::set_ssh_password_cached(&cache, &id, pwd);
        }
        if let Some(passphrase) = &ssh.key_passphrase {
            if !passphrase.trim().is_empty() {
                keychain_utils::set_ssh_key_passphrase(&id, passphrase)?;
                credential_cache::set_ssh_key_passphrase_cached(&cache, &id, passphrase);
            }
        }
    } else {
        keychain_utils::delete_ssh_password(&id).ok();
        keychain_utils::delete_ssh_key_passphrase(&id).ok();
        credential_cache::invalidate_ssh_password(&cache, &id);
        credential_cache::invalidate_ssh_key_passphrase(&cache, &id);
    }

    let ssh_to_save = SshConnection {
        id: id.clone(),
        name: name.clone(),
        host: ssh.host,
        port: ssh.port,
        user: ssh.user,
        auth_type: Some(ssh.auth_type.clone()),
        password: if ssh.save_in_keychain.unwrap_or(false) {
            None
        } else {
            ssh.password.clone()
        },
        key_file: ssh.key_file.clone(),
        key_passphrase: if ssh.save_in_keychain.unwrap_or(false) {
            None
        } else {
            ssh.key_passphrase.clone()
        },
        allow_passphrase_prompt: ssh.allow_passphrase_prompt,
        save_in_keychain: ssh.save_in_keychain,
    };

    ssh_connections[ssh_idx] = ssh_to_save.clone();

    let json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;

    let mut returned_ssh = ssh_to_save;
    returned_ssh.password = ssh.password;
    returned_ssh.key_passphrase = ssh.key_passphrase;
    Ok(returned_ssh)
}

#[tauri::command]
pub async fn delete_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let path = get_ssh_config_path(&app)?;
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut ssh_connections: Vec<SshConnection> =
        serde_json::from_str(&content).unwrap_or_default();

    ssh_connections.retain(|s| s.id != id);

    // Remove credentials from keychain and invalidate cache
    keychain_utils::delete_ssh_password(&id).ok();
    keychain_utils::delete_ssh_key_passphrase(&id).ok();
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    credential_cache::invalidate_ssh_password(&cache, &id);
    credential_cache::invalidate_ssh_key_passphrase(&cache, &id);

    let json = serde_json::to_string_pretty(&ssh_connections).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn test_ssh_connection<R: Runtime>(
    app: AppHandle<R>,
    ssh: SshTestParams,
) -> Result<String, String> {
    use crate::ssh_tunnel;

    // Resolve password using same logic as database connections
    let resolved_password = resolve_ssh_test_password(
        ssh.password.as_deref(),
        ssh.connection_id.as_deref(),
        |conn_id| {
            let path = get_ssh_config_path(&app).ok()?;
            if !path.exists() {
                return None;
            }
            let content = fs::read_to_string(path).ok()?;
            let connections: Vec<SshConnection> =
                serde_json::from_str(&content).unwrap_or_default();
            connections.into_iter().find(|c| c.id == conn_id)
        },
        |conn_id| keychain_utils::get_ssh_password(conn_id, ""),
    );

    // Resolve passphrase using same logic
    let resolved_passphrase = resolve_ssh_test_credential(
        ssh.key_passphrase.as_deref(),
        ssh.connection_id.as_deref(),
        |conn_id| {
            let path = get_ssh_config_path(&app).ok()?;
            if !path.exists() {
                return None;
            }
            let content = fs::read_to_string(path).ok()?;
            let connections: Vec<SshConnection> =
                serde_json::from_str(&content).unwrap_or_default();
            connections.into_iter().find(|c| c.id == conn_id)
        },
        |conn_id| keychain_utils::get_ssh_key_passphrase(conn_id, ""),
        |conn| {
            conn.key_passphrase
                .as_ref()
                .filter(|p| !p.trim().is_empty())
                .cloned()
        },
    );

    ssh_tunnel::test_ssh_connection(
        &ssh.host,
        ssh.port,
        &ssh.user,
        resolved_password.as_deref(),
        ssh.key_file.as_deref(),
        resolved_passphrase.as_deref(),
        ssh.allow_passphrase_prompt.unwrap_or(false),
    )
}
