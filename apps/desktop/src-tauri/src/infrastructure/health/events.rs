use tauri::Emitter;

use super::active_connections;

pub const ACTIVE_CONNECTIONS_CHANGED_EVENT: &str = "connections:active-changed";

pub async fn emit_active_changed<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let ids = active_connections().await;
    if let Err(e) = app.emit(ACTIVE_CONNECTIONS_CHANGED_EVENT, ids) {
        log::error!(
            "Health check: failed to emit {} event: {}",
            ACTIVE_CONNECTIONS_CHANGED_EVENT,
            e
        );
    }
}
