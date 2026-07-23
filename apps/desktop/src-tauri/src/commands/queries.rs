use std::sync::Arc;

use tauri::{AppHandle, Emitter, Runtime, State};

use crate::domains::connections::QueryCancellationState;
use crate::domains::queries::QueryService;
use crate::infrastructure::connections::TauriConnectionContextResolver;
use crate::models::{BatchStatementResult, ExplainPlan, QueryResult};

#[tauri::command]
pub async fn cancel_query(
    state: State<'_, QueryCancellationState>,
    connection_id: String,
) -> Result<(), String> {
    QueryService::cancel(&state, &connection_id)
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
    QueryService::execute(
        &TauriConnectionContextResolver::new(app),
        &state,
        &connection_id,
        &query,
        limit,
        page,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
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
    let progress: Option<Arc<crate::drivers::driver_trait::BatchProgressFn>> =
        batch_id.map(|batch_id| {
            let app = app.clone();
            let callback: Arc<crate::drivers::driver_trait::BatchProgressFn> =
                Arc::new(move |index, statement| {
                    let _ = app.emit(
                        "batch-statement-complete",
                        BatchStatementEvent {
                            batch_id: &batch_id,
                            index,
                            statement,
                        },
                    );
                });
            callback
        });
    QueryService::execute_batch(
        &TauriConnectionContextResolver::new(app),
        &state,
        &connection_id,
        queries,
        limit,
        page,
        schema.as_deref(),
        database.as_deref(),
        progress,
    )
    .await
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
    QueryService::explain(
        &TauriConnectionContextResolver::new(app),
        &state,
        &connection_id,
        &query,
        analyze,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn count_query<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    query: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    QueryService::count(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        query,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[derive(serde::Serialize, Clone)]
struct BatchStatementEvent<'a> {
    batch_id: &'a str,
    index: usize,
    statement: &'a BatchStatementResult,
}
