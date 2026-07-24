use std::sync::Arc;

use crate::logger::SharedLogBuffer;

pub(crate) fn manage_state(
    builder: tauri::Builder<tauri::Wry>,
    log_buffer: SharedLogBuffer,
) -> tauri::Builder<tauri::Wry> {
    builder
        .manage(crate::commands::QueryCancellationState::default())
        .manage(crate::export::ExportCancellationState::default())
        .manage(crate::dump_commands::DumpCancellationState::default())
        .manage(log_buffer)
        .manage(Arc::new(crate::credential_cache::CredentialCache::default()))
        .manage(Arc::new(crate::connection_cache::ConnectionCache::default()))
        .manage(crate::connection_import_commands::ImportEnvelopeCache::default())
        .manage(crate::explain_import::PendingExplainFile::default())
        .manage(crate::json_viewer::JsonViewerStore::default())
        .manage(crate::results_window::ResultsWindowStore::default())
        .manage(crate::query_history::QueryHistoryState::default())
}
