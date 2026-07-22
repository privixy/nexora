use std::fs;

#[test]
fn app_setup_legacy_preserves_builder_and_shutdown_order() {
    let source = fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/lib.rs")).unwrap();
    let ordered = [
        ".plugin(tauri_plugin_updater::Builder::new().build())",
        ".plugin(tauri_plugin_clipboard_manager::init())",
        ".plugin(tauri_plugin_opener::init())",
        ".plugin(tauri_plugin_dialog::init())",
        ".plugin(tauri_plugin_fs::init())",
        ".plugin(tauri_plugin_notification::init())",
        ".manage(commands::QueryCancellationState::default())",
        ".manage(export::ExportCancellationState::default())",
        ".manage(dump_commands::DumpCancellationState::default())",
        ".manage(log_buffer)",
        ".manage(std::sync::Arc::new(\n            credential_cache::CredentialCache::default(),",
        ".manage(std::sync::Arc::new(\n            connection_cache::ConnectionCache::default(),",
        ".manage(connection_import_commands::ImportEnvelopeCache::default())",
        ".manage(explain_import::PendingExplainFile::default())",
        ".manage(json_viewer::JsonViewerStore::default())",
        ".manage(results_window::ResultsWindowStore::default())",
        ".manage(query_history::QueryHistoryState::default())",
        ".setup(move |app|",
        ".invoke_handler(tauri::generate_handler![",
        ".build(tauri::generate_context!())",
        ".expect(\"error while building tauri application\")",
        ".run(|_app_handle, event|",
    ];
    let mut cursor = 0;
    for needle in ordered {
        let found = source[cursor..]
            .find(needle)
            .unwrap_or_else(|| panic!("missing ordered app setup fragment: {needle}"));
        cursor += found + needle.len();
    }

    let setup = source.split(".setup(move |app|").nth(1).unwrap();
    let setup_order = [
        "register_driver(drivers::mysql::MysqlDriver::new())",
        "register_driver(drivers::postgres::PostgresDriver::new())",
        "register_driver(drivers::sqlite::SqliteDriver::new())",
        "crate::plugins::manager::load_plugins",
        "health_check::start_ping_loop",
        "ai_approval_watcher::spawn",
        "heartbeat::spawn",
        ".start_maximized",
        "window.maximize()",
        "if args.debug",
        "window.open_devtools()",
        "if let Some(path) = args.explain.clone()",
        "explain_import::spawn_visual_explain_window",
        "main.close()",
    ];
    let mut cursor = 0;
    for needle in setup_order {
        let found = setup[cursor..]
            .find(needle)
            .unwrap_or_else(|| panic!("missing ordered setup fragment: {needle}"));
        cursor += found + needle.len();
    }

    let run_body = source.split(".run(|_app_handle, event|").nth(1).unwrap();
    assert!(run_body.contains("if let tauri::RunEvent::Exit = event"));
    assert!(run_body.contains("Application exiting, stopping all active SSH tunnels..."));
    assert!(run_body.contains("crate::ssh_tunnel::stop_all_tunnels();"));
}
