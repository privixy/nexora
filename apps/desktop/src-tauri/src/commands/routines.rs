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
pub async fn get_routines<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<RoutineInfo>, String> {
    log::info!("Fetching routines for connection: {}", connection_id);

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routines(&params, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_routine_parameters<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<RoutineParameter>, String> {
    log::info!(
        "Fetching routine parameters for: {} on connection: {}",
        routine_name,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routine_parameters(&params, &routine_name, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_routine_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    routine_type: String, // "PROCEDURE" or "FUNCTION" - mainly for MySQL SHOW CREATE
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching routine definition for: {} ({}) on connection: {}",
        routine_name,
        routine_type,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routine_definition(&params, &routine_name, &routine_type, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn build_routine_call_sql<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    routine_type: String,
    args: Vec<crate::models::RoutineCallArg>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.build_routine_call_sql(
        &params,
        &routine_name,
        &routine_type,
        &args,
        schema.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_routine_create_template<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_type: String,
    schema: Option<String>,
) -> Result<String, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.routine_create_template(&routine_type, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_routine_edit_script<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    routine_type: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_routine_edit_script(&params, &routine_name, &routine_type, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn drop_routine<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    routine_name: String,
    routine_type: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Dropping routine: {} ({}) on connection: {}",
        routine_name,
        routine_type,
        connection_id
    );

    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    let params = apply_database_override(params, database.as_deref());

    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.drop_routine(&params, &routine_name, &routine_type, schema.as_deref())
        .await
}
