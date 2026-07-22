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
use crate::infrastructure::cancellation::{register_abort_handle, unregister_abort_handle};

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, QueryCancellationState>,
    connection_id: String,
) -> Result<(), String> {
    cancel_query_impl(&state, &connection_id)
}

#[tauri::command]
pub async fn execute_query<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, QueryCancellationState>,
    connection_id: String,
    query: String,
    limit: Option<u32>,
    page: Option<u32>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<QueryResult, String> {
    log::info!(
        "Executing query on connection: {} | Query: {}",
        connection_id,
        query
    );

    let sanitized_query = sanitize_user_query(&query);

    let resolved =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app.clone())
            .resolve(crate::domains::connections::DatabaseContext {
                connection_id: &connection_id,
                database: database.as_deref(),
                schema: schema.as_deref(),
                table: None,
            })
            .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    let task = tokio::spawn(async move {
        drv.execute_query(
            &params,
            &sanitized_query,
            limit,
            page.unwrap_or(1),
            schema.as_deref(),
        )
        .await
    });

    let abort_handle = Arc::new(task.abort_handle());
    register_abort_handle(&state.handles, connection_id.clone(), abort_handle.clone());

    let result = task.await;

    unregister_abort_handle(&state.handles, &connection_id, &abort_handle);

    match result {
        Ok(Ok(query_result)) => {
            log::info!(
                "Query executed successfully, returned {} rows",
                query_result.rows.len()
            );
            Ok(query_result)
        }
        Ok(Err(e)) => {
            log::error!("Query execution failed: {}", e);
            Err(e)
        }
        Err(_) => {
            log::warn!("Query was cancelled");
            Err("Query cancelled".into())
        }
    }
}

#[tauri::command]
pub async fn execute_query_batch<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, QueryCancellationState>,
    connection_id: String,
    queries: Vec<String>,
    limit: Option<u32>,
    page: Option<u32>,
    schema: Option<String>,
    database: Option<String>,
    batch_id: Option<String>,
) -> Result<Vec<BatchStatementResult>, String> {
    log::info!(
        "Executing query batch on connection: {} | {} statement(s)",
        connection_id,
        queries.len()
    );

    let sanitized_queries: Vec<String> = queries.iter().map(|q| sanitize_user_query(q)).collect();

    let resolved =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app.clone())
            .resolve(crate::domains::connections::DatabaseContext {
                connection_id: &connection_id,
                database: database.as_deref(),
                schema: schema.as_deref(),
                table: None,
            })
            .await?;
    let params = resolved.params;
    let drv = resolved.driver;

    // Build a Tauri-agnostic progress sink the driver invokes per statement.
    // Each invocation emits one event so result tabs resolve as they finish.
    let progress: Option<Arc<crate::drivers::driver_trait::BatchProgressFn>> =
        batch_id.map(|bid| {
            let app = app.clone();
            let cb: Arc<crate::drivers::driver_trait::BatchProgressFn> =
                Arc::new(move |index, statement: &BatchStatementResult| {
                    let _ = app.emit(
                        "batch-statement-complete",
                        BatchStatementEvent {
                            batch_id: &bid,
                            index,
                            statement,
                        },
                    );
                });
            cb
        });

    let task = tokio::spawn(async move {
        drv.execute_batch(
            &params,
            &sanitized_queries,
            limit,
            page.unwrap_or(1),
            schema.as_deref(),
            progress.as_deref(),
        )
        .await
    });

    let abort_handle = Arc::new(task.abort_handle());
    register_abort_handle(&state.handles, connection_id.clone(), abort_handle.clone());

    let result = task.await;

    unregister_abort_handle(&state.handles, &connection_id, &abort_handle);

    match result {
        Ok(Ok(batch_results)) => {
            let success_count = batch_results.iter().filter(|r| r.result.is_some()).count();
            log::info!(
                "Batch executed: {} succeeded, {} failed (of {} total)",
                success_count,
                batch_results.len() - success_count,
                batch_results.len()
            );
            Ok(batch_results)
        }
        Ok(Err(e)) => {
            log::error!("Batch execution failed at setup: {}", e);
            Err(e)
        }
        Err(_) => {
            log::warn!("Batch was cancelled");
            Err("Query cancelled".into())
        }
    }
}

#[tauri::command]
pub async fn explain_query_plan<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, QueryCancellationState>,
    connection_id: String,
    query: String,
    analyze: bool,
    schema: Option<String>,
    database: Option<String>,
) -> Result<ExplainPlan, String> {
    log::info!(
        "Explaining query on connection: {} | analyze: {} | Query: {}",
        connection_id,
        analyze,
        query
    );

    let sanitized_query = sanitize_user_query(&query);

    if !crate::drivers::common::is_explainable_query(&sanitized_query) {
        return Err(
            "EXPLAIN is only supported for DML statements (SELECT, INSERT, UPDATE, DELETE, REPLACE). DDL statements like CREATE, DROP, or ALTER cannot be explained."
                .into(),
        );
    }

    let resolved =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app.clone())
            .resolve(crate::domains::connections::DatabaseContext {
                connection_id: &connection_id,
                database: database.as_deref(),
                schema: schema.as_deref(),
                table: None,
            })
            .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    let task = tokio::spawn(async move {
        drv.explain_query(&params, &sanitized_query, analyze, schema.as_deref())
            .await
    });

    let abort_handle = Arc::new(task.abort_handle());
    register_abort_handle(&state.handles, connection_id.clone(), abort_handle.clone());

    let result = task.await;

    unregister_abort_handle(&state.handles, &connection_id, &abort_handle);

    match result {
        Ok(Ok(plan)) => {
            log::info!("Explain query completed successfully");
            Ok(plan)
        }
        Ok(Err(e)) => {
            log::error!("Explain query failed: {}", e);
            Err(e)
        }
        Err(_) => {
            log::warn!("Explain query was cancelled");
            Err("Explain query cancelled".into())
        }
    }
}

#[tauri::command]
pub async fn count_query<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    query: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    let resolved =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
            .resolve(crate::domains::connections::DatabaseContext {
                connection_id: &connection_id,
                database: database.as_deref(),
                schema: schema.as_deref(),
                table: None,
            })
            .await?;
    let params = resolved.params;
    let drv = resolved.driver;

    let sanitized = query.trim().trim_end_matches(';').to_string();

    let count_q = format!("SELECT COUNT(*) FROM ({}) as count_wrapper", sanitized);

    let result = drv
        .execute_query(&params, &count_q, None, 1, schema.as_deref())
        .await?;

    let total: u64 = result
        .rows
        .first()
        .and_then(|r| r.first())
        .and_then(|v| v.as_i64())
        .map(|n| n as u64)
        .unwrap_or(0);

    Ok(total)
}
