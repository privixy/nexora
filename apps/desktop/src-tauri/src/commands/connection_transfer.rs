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

use super::shared::*;

#[tauri::command]
pub async fn export_connections_payload<R: Runtime>(
    app: AppHandle<R>,
    include_secrets: Option<bool>,
    connection_ids: Option<Vec<String>>,
) -> Result<ExportPayload, String> {
    let include_secrets = include_secrets.unwrap_or(true);
    let conn_path = get_config_path(&app)?;
    let ssh_path = get_ssh_config_path(&app)?;

    let mut conn_file = persistence::load_connections_file(&conn_path)?;
    let mut ssh_connections = if ssh_path.exists() {
        let content = fs::read_to_string(&ssh_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Vec<SshConnection>>(&content).unwrap_or_default()
    } else {
        Vec::new()
    };
    let mut k8s_connections = load_k8s_connections_sync(&app)?;

    // When a selection is provided, keep only the selected connections (of any
    // kind) plus the group chains needed to preserve their hierarchy. Done
    // before password resolution so unselected credentials never leave the
    // keychain.
    if let Some(ids) = &connection_ids {
        let selected: std::collections::HashSet<&str> = ids.iter().map(String::as_str).collect();
        conn_file
            .connections
            .retain(|c| selected.contains(c.id.as_str()));
        ssh_connections.retain(|s| selected.contains(s.id.as_str()));
        k8s_connections.retain(|k| selected.contains(k.id.as_str()));
        let kept_groups = crate::models::collect_group_ancestors(
            &conn_file.groups,
            conn_file
                .connections
                .iter()
                .filter_map(|c| c.group_id.as_deref()),
        );
        conn_file.groups.retain(|g| kept_groups.contains(&g.id));
    }

    let cache = app
        .state::<std::sync::Arc<crate::credential_cache::CredentialCache>>()
        .inner()
        .clone();

    // Resolve passwords for database connections
    for conn in &mut conn_file.connections {
        if !include_secrets {
            // Strip any secrets that may already live in the connections file
            conn.params.password = None;
            conn.params.ssh_password = None;
            conn.params.ssh_key_passphrase = None;
            continue;
        }
        if conn.params.save_in_keychain.unwrap_or(false) {
            if let Ok(pwd) = credential_cache::get_db_password_cached(&cache, &conn.id) {
                conn.params.password = Some(pwd);
            }
            if conn.params.ssh_enabled.unwrap_or(false) {
                if let Ok(ssh_pwd) = credential_cache::get_ssh_password_cached(&cache, &conn.id) {
                    conn.params.ssh_password = Some(ssh_pwd);
                }
                if let Ok(ssh_passphrase) =
                    credential_cache::get_ssh_key_passphrase_cached(&cache, &conn.id)
                {
                    conn.params.ssh_key_passphrase = Some(ssh_passphrase);
                }
            }
        }
    }

    // Resolve passwords for SSH connections
    for ssh in &mut ssh_connections {
        if !include_secrets {
            ssh.password = None;
            ssh.key_passphrase = None;
            continue;
        }
        if ssh.save_in_keychain.unwrap_or(false) {
            if let Ok(pwd) = credential_cache::get_ssh_password_cached(&cache, &ssh.id) {
                ssh.password = Some(pwd);
            }
            if let Ok(passphrase) = credential_cache::get_ssh_key_passphrase_cached(&cache, &ssh.id)
            {
                ssh.key_passphrase = Some(passphrase);
            }
        }
    }

    Ok(ExportPayload {
        version: 1,
        groups: conn_file.groups,
        connections: conn_file.connections,
        ssh_connections,
        k8s_connections,
    })
}

#[tauri::command]
pub async fn encrypt_export_payload(
    payload: ExportPayload,
    password: String,
) -> Result<crate::export_crypto::EncryptedEnvelope, String> {
    let plaintext = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    crate::export_crypto::encrypt(&plaintext, &password)
}

#[tauri::command]
pub async fn decrypt_export_payload(
    envelope: crate::export_crypto::EncryptedEnvelope,
    password: String,
) -> Result<ExportPayload, String> {
    let plaintext = crate::export_crypto::decrypt(&envelope, &password)?;
    serde_json::from_str(&plaintext).map_err(|e| format!("Invalid export payload: {e}"))
}

#[tauri::command]
pub async fn import_connections_payload<R: Runtime>(
    app: AppHandle<R>,
    payload: ExportPayload,
) -> Result<(), String> {
    apply_export_payload(app, payload).await
}
