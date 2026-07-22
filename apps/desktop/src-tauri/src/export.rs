mod format;
mod progress;
mod sink;

#[cfg(test)]
mod tests;

pub use format::{parse_csv_delimiter, value_to_csv_string, ExportFormat, DEFAULT_CSV_DELIMITER};
pub use progress::{ProgressEmitter, DEFAULT_INTERVAL as DEFAULT_PROGRESS_INTERVAL};
pub use sink::{CsvSink, JsonSink, RowSink};

use std::collections::HashMap;
use std::fs::File;
use std::io::BufWriter;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::commands::{register_abort_handle, unregister_abort_handle, AbortHandleMap};
use crate::domains::connections::DatabaseContext;
use crate::drivers::{mysql, postgres, sqlite};
use crate::infrastructure::connections::TauriConnectionContextResolver;
use crate::models::ConnectionParams;

pub struct ExportCancellationState {
    pub handles: Arc<Mutex<AbortHandleMap>>,
}

impl Default for ExportCancellationState {
    fn default() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Clone, Serialize)]
struct ExportProgressPayload {
    rows_processed: u64,
}

const EXPORT_PROGRESS_EVENT: &str = "export_progress";

fn sanitize_query(query: &str) -> String {
    query.trim().trim_end_matches(';').to_string()
}

#[tauri::command]
pub async fn cancel_export(
    state: State<'_, ExportCancellationState>,
    connection_id: String,
) -> Result<(), String> {
    let entries = crate::infrastructure::cancellation::abort_slot(&state.handles, &connection_id);
    for handle in entries {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn export_query_to_file<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ExportCancellationState>,
    connection_id: String,
    query: String,
    file_path: String,
    format: String,
    csv_delimiter: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    let sanitized_query = sanitize_query(&query);
    let resolved = TauriConnectionContextResolver::new(app.clone())
        .resolve(DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: None,
            table: None,
        })
        .await?;
    let params = resolved.params;
    let driver = resolved.saved.params.driver;

    let export_format = ExportFormat::parse(&format)?;
    let delimiter = parse_csv_delimiter(csv_delimiter.as_deref());

    let app_for_task = app.clone();
    let task_connection_id = connection_id.clone();

    let task = tokio::spawn(async move {
        let file = File::create(&file_path).map_err(|e| e.to_string())?;
        let writer = BufWriter::new(file);
        run_export(
            app_for_task,
            &driver,
            &params,
            &sanitized_query,
            writer,
            export_format,
            delimiter,
        )
        .await
    });

    let abort_handle = Arc::new(task.abort_handle());
    register_abort_handle(
        &state.handles,
        task_connection_id.clone(),
        abort_handle.clone(),
    );

    let result = task.await;

    unregister_abort_handle(&state.handles, &task_connection_id, &abort_handle);

    match result {
        Ok(res) => res,
        Err(_) => Err("Export cancelled".into()),
    }
}

/// Wires the driver stream, the row sink, and the progress emitter together.
/// Kept as a free function so the spawned task body stays linear and the
/// pieces remain individually unit-testable.
async fn run_export<R: Runtime>(
    app: AppHandle<R>,
    driver: &str,
    params: &ConnectionParams,
    query: &str,
    writer: BufWriter<File>,
    format: ExportFormat,
    delimiter: u8,
) -> Result<(), String> {
    let app_for_progress = app.clone();
    let mut progress = ProgressEmitter::new(DEFAULT_PROGRESS_INTERVAL, move |count| {
        let _ = app_for_progress.emit(
            EXPORT_PROGRESS_EVENT,
            ExportProgressPayload {
                rows_processed: count,
            },
        );
    });

    match format {
        ExportFormat::Csv => {
            let mut sink = CsvSink::new(writer, delimiter);
            stream_to_sink(driver, params, query, &mut sink, &mut progress).await?;
            sink.finish()?;
        }
        ExportFormat::Json => {
            let mut sink = JsonSink::new(writer);
            stream_to_sink(driver, params, query, &mut sink, &mut progress).await?;
            sink.finish()?;
        }
    }

    progress.finish();
    Ok(())
}

async fn stream_to_sink<S, F>(
    driver: &str,
    params: &ConnectionParams,
    query: &str,
    sink: &mut S,
    progress: &mut ProgressEmitter<F>,
) -> Result<(), String>
where
    S: RowSink + Send,
    F: FnMut(u64) + Send,
{
    let mut on_row = |headers: &[String], values: &[Value]| -> Result<(), String> {
        sink.write_row(headers, values)?;
        progress.tick();
        Ok(())
    };

    match driver {
        "mysql" => mysql::export::stream_query(params, query, &mut on_row).await,
        "postgres" => postgres::export::stream_query(params, query, &mut on_row).await,
        "sqlite" => sqlite::export::stream_query(params, query, &mut on_row).await,
        // External plugin drivers: page through the driver's own paginated
        // `execute_query` and forward every row to the sink.
        other => stream_query_via_plugin(other, params, query, &mut on_row).await,
    }
}

/// Streams a query for an external plugin driver by repeatedly calling its
/// `execute_query` with the driver's pagination, forwarding each row to
/// `on_row`. Built-in drivers stream directly from the database; plugins only
/// expose paged query execution over JSON-RPC, so we drive that here.
async fn stream_query_via_plugin<F>(
    driver_id: &str,
    params: &ConnectionParams,
    query: &str,
    mut on_row: F,
) -> Result<(), String>
where
    F: FnMut(&[String], &[Value]) -> Result<(), String> + Send,
{
    const PAGE_SIZE: u32 = 1000;

    let driver = crate::drivers::registry::get_driver(driver_id)
        .await
        .ok_or_else(|| format!("Unsupported driver for export: {driver_id}"))?;

    let mut page: u32 = 1;
    loop {
        let result = driver
            .execute_query(params, query, Some(PAGE_SIZE), page, None)
            .await?;

        for row in &result.rows {
            on_row(&result.columns, row)?;
        }

        let fetched = result.rows.len() as u32;
        let has_more = result
            .pagination
            .as_ref()
            .map(|p| p.has_more)
            .unwrap_or(fetched >= PAGE_SIZE);

        if fetched == 0 || !has_more {
            break;
        }
        page += 1;
    }

    Ok(())
}
