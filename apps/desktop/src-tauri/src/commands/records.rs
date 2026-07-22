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
pub async fn delete_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    pk_map: std::collections::HashMap<String, serde_json::Value>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    log::info!(
        "Executing query on connection: {} | Query: DELETE FROM {} WHERE pk_map={:?}",
        connection_id,
        table,
        pk_map
    );
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let mut params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    if let Some(db) = database {
        params.database = crate::models::DatabaseSelection::Single(db);
    }
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.delete_record(&params, &table, &pk_map, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn update_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    pk_map: std::collections::HashMap<String, serde_json::Value>,
    col_name: String,
    new_val: serde_json::Value,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    log::info!(
        "Executing query on connection: {} | Query: UPDATE {} SET {} = {:?} WHERE pk_map={:?}",
        connection_id,
        table,
        col_name,
        new_val,
        pk_map
    );
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let mut params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    if let Some(db) = database {
        params.database = crate::models::DatabaseSelection::Single(db);
    }
    let max_blob_size = crate::config::get_max_blob_size(&app);
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.update_record(
        &params,
        &table,
        &pk_map,
        &col_name,
        new_val,
        schema.as_deref(),
        max_blob_size,
    )
    .await
}

#[tauri::command]
pub async fn insert_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    data: std::collections::HashMap<String, serde_json::Value>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    let columns: Vec<&str> = data.keys().map(|k| k.as_str()).collect();
    log::info!(
        "Executing query on connection: {} | Query: INSERT INTO {} ({}) VALUES (...)",
        connection_id,
        table,
        columns.join(", ")
    );
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let expanded_params = expand_ssh_connection_params(&app, &saved_conn.params).await?;
    let expanded_params = expand_k8s_connection_params(&app, &expanded_params).await?;
    let mut params = resolve_connection_params_with_id(&expanded_params, &connection_id)?;
    if let Some(db) = database {
        params.database = crate::models::DatabaseSelection::Single(db);
    }
    let max_blob_size = crate::config::get_max_blob_size(&app);
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.insert_record(&params, &table, data, schema.as_deref(), max_blob_size)
        .await
}
