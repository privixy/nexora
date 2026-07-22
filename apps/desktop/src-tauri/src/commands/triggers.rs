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

use super::legacy::*;

#[tauri::command]
pub async fn get_triggers<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TriggerInfo>, String> {
    log::info!("Fetching triggers for connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    let result = drv.get_triggers(&params, schema.as_deref()).await;

    match &result {
        Ok(triggers) => log::info!("Retrieved {} triggers", triggers.len()),
        Err(e) => log::error!("Failed to get triggers: {}", e),
    }

    result
}

#[tauri::command]
pub async fn get_trigger_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    trigger_name: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching trigger definition for: {} on connection: {}",
        trigger_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_trigger_definition(&params, &trigger_name, &table_name, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn create_trigger<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    trigger_sql: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!("Creating trigger on connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    let result = drv
        .create_trigger(&params, &trigger_sql, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully created trigger"),
        Err(e) => log::error!("Failed to create trigger: {}", e),
    }

    result
}

#[tauri::command]
pub async fn drop_trigger<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    trigger_name: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Dropping trigger: {} on connection: {}",
        trigger_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    let result = drv
        .drop_trigger(&params, &trigger_name, &table_name, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully dropped trigger: {}", trigger_name),
        Err(e) => log::error!("Failed to drop trigger {}: {}", trigger_name, e),
    }

    result
}
