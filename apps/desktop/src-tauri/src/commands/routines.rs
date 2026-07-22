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
pub async fn get_routines<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<RoutineInfo>, String> {
    log::info!("Fetching routines for connection: {}", connection_id);

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
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

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
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

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
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
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
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
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
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

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    drv.drop_routine(&params, &routine_name, &routine_type, schema.as_deref())
        .await
}
