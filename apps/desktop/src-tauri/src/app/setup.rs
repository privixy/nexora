use tauri::Manager;

pub(crate) fn attach_setup(
    builder: tauri::Builder<tauri::Wry>,
    args: crate::cli::Args,
) -> tauri::Builder<tauri::Wry> {
    builder.setup(move |app| {
        crate::askpass::set_app_handle(app.handle().clone());

        let active_ext_drivers =
            crate::config::load_config_internal(&app.handle()).active_external_drivers;

        tauri::async_runtime::block_on(async {
            crate::drivers::registry::register_driver(crate::drivers::mysql::MysqlDriver::new())
                .await;
            crate::drivers::registry::register_driver(
                crate::drivers::postgres::PostgresDriver::new(),
            )
            .await;
            crate::drivers::registry::register_driver(crate::drivers::sqlite::SqliteDriver::new())
                .await;

            crate::plugins::manager::load_plugins(&app.handle(), active_ext_drivers.as_deref())
                .await;
        });

        {
            let config = crate::config::load_config_internal(&app.handle());
            let interval = config
                .ping_interval
                .unwrap_or(crate::health_check::DEFAULT_PING_INTERVAL);
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                crate::health_check::start_ping_loop(handle, interval as u64).await;
            });
        }

        crate::ai_approval_watcher::spawn(app.handle().clone());
        crate::heartbeat::spawn();

        if crate::config::load_config_internal(&app.handle())
            .start_maximized
            .unwrap_or(false)
        {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(e) = window.maximize() {
                    log::warn!("Failed to maximize window on startup: {e}");
                }
            }
        }

        if args.debug {
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
                log::info!("DevTools opened (debug mode active)");
            }
        }

        if let Some(path) = args.explain.clone() {
            log::info!("CLI --explain received: {path}");
            if let Err(e) = crate::explain_import::spawn_visual_explain_window(app, Some(path)) {
                log::error!("Failed to open Visual Explain window: {e}");
            }
            if let Some(main) = app.get_webview_window("main") {
                if let Err(e) = main.close() {
                    log::warn!("Failed to close main window: {e}");
                }
            }
        }
        Ok(())
    })
}
