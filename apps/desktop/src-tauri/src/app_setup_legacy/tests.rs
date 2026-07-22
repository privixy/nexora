use std::fs;

#[test]
fn app_setup_legacy_preserves_builder_and_shutdown_order() {
    let source = [
        "plugins.rs",
        "state.rs",
        "setup.rs",
        "commands.rs",
        "mod.rs",
    ]
    .into_iter()
    .map(|file| {
        fs::read_to_string(format!("{}/src/app/{file}", env!("CARGO_MANIFEST_DIR"))).unwrap()
    })
    .collect::<Vec<_>>()
    .join("\n");
    let ordered = [
        ".plugin(tauri_plugin_updater::Builder::new().build())",
        ".plugin(tauri_plugin_clipboard_manager::init())",
        ".plugin(tauri_plugin_opener::init())",
        ".plugin(tauri_plugin_dialog::init())",
        ".plugin(tauri_plugin_fs::init())",
        ".plugin(tauri_plugin_notification::init())",
        ".manage(crate::commands::QueryCancellationState::default())",
        ".manage(crate::export::ExportCancellationState::default())",
        ".manage(crate::dump_commands::DumpCancellationState::default())",
        ".manage(log_buffer)",
        ".manage(Arc::new(crate::credential_cache::CredentialCache::default()))",
        ".manage(Arc::new(crate::connection_cache::ConnectionCache::default()))",
        ".manage(crate::connection_import_commands::ImportEnvelopeCache::default())",
        ".manage(crate::explain_import::PendingExplainFile::default())",
        ".manage(crate::json_viewer::JsonViewerStore::default())",
        ".manage(crate::results_window::ResultsWindowStore::default())",
        ".manage(crate::query_history::QueryHistoryState::default())",
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
        "register_driver(crate::drivers::mysql::MysqlDriver::new())",
        "register_driver(\n                crate::drivers::postgres::PostgresDriver::new()",
        "register_driver(crate::drivers::sqlite::SqliteDriver::new())",
        "crate::plugins::manager::load_plugins",
        "crate::health_check::start_ping_loop",
        "crate::ai_approval_watcher::spawn",
        "crate::heartbeat::spawn",
        ".start_maximized",
        "window.maximize()",
        "if args.debug",
        "window.open_devtools()",
        "if let Some(path) = args.explain.clone()",
        "crate::explain_import::spawn_visual_explain_window",
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
