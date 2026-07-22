use std::collections::HashMap;
use std::time::Duration;

use once_cell::sync::Lazy;
use tauri::Emitter;
use tokio::sync::{oneshot, Mutex};

use super::active::ACTIVE_CONNECTIONS;
use super::{emit_active_changed, unregister_connection};

static PING_STOP_TX: Lazy<Mutex<Option<oneshot::Sender<()>>>> = Lazy::new(|| Mutex::new(None));

pub const DEFAULT_PING_INTERVAL: u32 = 30;
const FAILURE_THRESHOLD: u32 = 2;
const PING_TIMEOUT: Duration = Duration::from_secs(5);

pub async fn start_ping_loop(app: tauri::AppHandle, interval_secs: u64) {
    stop_ping_loop().await;

    if interval_secs == 0 {
        log::info!("Health check: disabled (interval = 0)");
        return;
    }

    let (stop_tx, mut stop_rx) = oneshot::channel::<()>();
    {
        let mut guard = PING_STOP_TX.lock().await;
        *guard = Some(stop_tx);
    }

    log::info!(
        "Health check: starting ping loop with interval {}s",
        interval_secs
    );

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
        let mut failure_counts: HashMap<String, u32> = HashMap::new();

        loop {
            tokio::select! {
                _ = &mut stop_rx => {
                    log::info!("Health check: ping loop stopped");
                    break;
                }
                _ = interval.tick() => {
                    ping_all_connections(&app, &mut failure_counts).await;
                }
            }
        }
    });
}

pub async fn stop_ping_loop() {
    let mut guard = PING_STOP_TX.lock().await;
    if let Some(tx) = guard.take() {
        let _ = tx.send(());
    }
}

pub async fn restart_ping_loop(app: tauri::AppHandle, interval_secs: u64) {
    stop_ping_loop().await;
    start_ping_loop(app, interval_secs).await;
}

async fn ping_all_connections(app: &tauri::AppHandle, failure_counts: &mut HashMap<String, u32>) {
    let active: Vec<String> = ACTIVE_CONNECTIONS.read().await.iter().cloned().collect();

    if active.is_empty() {
        return;
    }

    let results = futures::future::join_all(active.iter().map(|conn_id| {
        let app = app.clone();
        let conn_id = conn_id.clone();
        async move {
            let result = ping_single_connection(&app, &conn_id).await;
            (conn_id, result)
        }
    }))
    .await;

    for (conn_id, result) in results {
        match result {
            Ok(()) => {
                failure_counts.remove(&conn_id);
            }
            Err(err) => {
                let count = failure_counts.entry(conn_id.clone()).or_insert(0);
                *count += 1;
                log::warn!(
                    "Health check: ping failed for {} ({}/{}): {}",
                    conn_id,
                    count,
                    FAILURE_THRESHOLD,
                    err
                );

                if *count >= FAILURE_THRESHOLD {
                    log::error!(
                        "Health check: connection {} exceeded failure threshold, disconnecting",
                        conn_id
                    );
                    failure_counts.remove(&conn_id);
                    handle_connection_failure(app, &conn_id, &err).await;
                }
            }
        }
    }
}

async fn ping_single_connection(app: &tauri::AppHandle, connection_id: &str) -> Result<(), String> {
    let resolved =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app.clone())
            .resolve(crate::domains::connections::DatabaseContext {
                connection_id,
                database: None,
                schema: None,
                table: None,
            })
            .await?;
    let params = resolved.params;

    let is_builtin = matches!(params.driver.as_str(), "mysql" | "postgres" | "sqlite");
    if is_builtin && !crate::pool_manager::has_pool(&params, Some(connection_id)).await {
        return Err("No active connection pool".into());
    }

    let driver = crate::drivers::registry::get_driver(&params.driver)
        .await
        .ok_or_else(|| format!("Driver not found: {}", params.driver))?;

    tokio::time::timeout(PING_TIMEOUT, driver.ping(&params))
        .await
        .map_err(|_| "Ping timed out".to_string())?
}

async fn handle_connection_failure(app: &tauri::AppHandle, connection_id: &str, error: &str) {
    unregister_connection(connection_id).await;

    if let Ok(resolved) =
        crate::infrastructure::connections::TauriConnectionContextResolver::new(app.clone())
            .resolve(crate::domains::connections::DatabaseContext {
                connection_id,
                database: None,
                schema: None,
                table: None,
            })
            .await
    {
        crate::pool_manager::close_pool_with_id(&resolved.params, Some(connection_id)).await;
    }

    let payload = serde_json::json!({
        "connectionId": connection_id,
        "error": error,
    });
    if let Err(e) = app.emit("connection-health-failed", payload) {
        log::error!(
            "Health check: failed to emit connection-health-failed event: {}",
            e
        );
    }

    emit_active_changed(app).await;
}
