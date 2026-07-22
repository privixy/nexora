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
pub async fn test_connection<R: Runtime>(
    app: AppHandle<R>,
    request: TestConnectionRequest,
) -> Result<String, String> {
    log::info!(
        "Testing connection to database: {}",
        request.params.database
    );

    let mut expanded_params = expand_ssh_connection_params(&app, &request.params).await?;
    expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;

    if request.params.password.is_none() && expanded_params.password.is_none() {
        let saved_conn = match &request.connection_id {
            Some(id) => find_connection_by_id(&app, id).ok(),
            None => None,
        };
        expanded_params.password =
            resolve_test_connection_password(&request.params, saved_conn.as_ref(), |conn_id| {
                keychain_utils::get_db_password(conn_id, "")
            });
    }

    let resolved_params = if let Some(conn_id) = &request.connection_id {
        resolve_connection_params_with_id(&expanded_params, conn_id)?
    } else {
        resolve_connection_params(&expanded_params)?
    };
    log::debug!(
        "Test connection params: Host={:?}, Port={:?}",
        resolved_params.host,
        resolved_params.port
    );

    let drv = driver_for(&resolved_params.driver).await?;

    // For file-based drivers, verify the database file exists before attempting connection
    if drv.manifest().capabilities.file_based {
        let db_path = std::path::Path::new(resolved_params.database.primary());
        if !db_path.exists() {
            return Err(format!(
                "Database file not found: {}",
                resolved_params.database
            ));
        }
    }

    drv.test_connection(&resolved_params).await?;

    log::info!(
        "Connection test successful for database: {}",
        request.params.database
    );
    Ok("Connection successful!".to_string())
}

#[tauri::command]
pub async fn list_databases<R: Runtime>(
    app: AppHandle<R>,
    request: TestConnectionRequest,
) -> Result<Vec<String>, String> {
    let mut expanded_params = expand_ssh_connection_params(&app, &request.params).await?;
    expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;

    if request.params.password.is_none() && expanded_params.password.is_none() {
        let saved_conn = match &request.connection_id {
            Some(id) => find_connection_by_id(&app, id).ok(),
            None => None,
        };
        expanded_params.password =
            resolve_test_connection_password(&request.params, saved_conn.as_ref(), |conn_id| {
                keychain_utils::get_db_password(conn_id, "")
            });
    }

    let resolved_params = if let Some(conn_id) = &request.connection_id {
        resolve_connection_params_with_id(&expanded_params, conn_id)?
    } else {
        resolve_connection_params(&expanded_params)?
    };

    #[cfg(debug_assertions)]
    log::debug!(
        "[List Databases] Resolved Params: Host={:?}, Port={:?}, Username={:?}",
        resolved_params.host,
        resolved_params.port,
        resolved_params.username,
    );

    let drv = driver_for(&resolved_params.driver).await?;
    drv.get_databases(&resolved_params).await
}

#[tauri::command]
pub async fn register_active_connection<R: Runtime>(app: AppHandle<R>, connection_id: String) {
    crate::health_check::register_connection(connection_id).await;
    // Broadcast so every window learns this connection is now open.
    crate::health_check::emit_active_changed(&app).await;
}

#[tauri::command]
pub async fn get_active_connections() -> Vec<String> {
    crate::health_check::active_connections().await
}

#[tauri::command]
pub async fn disconnect_connection<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<(), String> {
    log::info!("Disconnecting from connection: {}", connection_id);

    let resolver =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app.clone());
    crate::domains::connections::ConnectionService::disconnect(
        &connection_id,
        |id| async move { crate::health_check::unregister_connection(&id).await },
        |id| async move {
            resolver
                .resolve(crate::domains::connections::DatabaseContext {
                    connection_id: &id,
                    database: None,
                    schema: None,
                    table: None,
                })
                .await
        },
        |resolved, id| async move {
            crate::pool_manager::close_pool_with_id(&resolved.params, Some(&id)).await;
        },
        || crate::health_check::emit_active_changed(&app),
    )
    .await?;

    log::info!(
        "Successfully disconnected from connection: {}",
        connection_id
    );
    Ok(())
}

#[tauri::command]
pub async fn get_server_now<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<String, String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: None,
            schema: None,
            table: None,
        })
        .await?;
    let driver_id = resolved.saved.params.driver.clone();
    crate::server_time_compat::run(resolved.driver, resolved.params, driver_id).await
}
