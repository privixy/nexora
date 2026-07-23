pub mod ai;
pub mod ai_activity;
pub mod ai_approval;
pub mod ai_approval_watcher;
pub mod ai_commands;
pub mod ai_notebook_export;
pub mod ai_schema_context;
pub mod app;
pub mod askpass;
pub mod cli;
pub mod clipboard_import;
pub mod commands;
pub mod config;
pub mod connection_appearance;
pub mod connection_cache;
pub mod connection_import;
pub mod connection_import_commands;
pub mod connection_params;
pub mod connection_window;
pub(crate) mod count_query_compat;
pub mod credential_cache;
pub mod domains;
pub mod dump_commands; // Added
pub mod dump_utils;
pub mod explain_import;
pub mod export;
pub mod export_crypto;
pub mod health_check;
pub mod heartbeat;
pub mod infrastructure;
pub mod json_viewer;
pub mod k8s_tunnel;
pub mod keychain_utils;
pub mod log_commands;
pub mod logger;
pub mod mcp;
pub mod models;
pub mod notebooks;
pub mod paths; // Added
pub mod persistence;
pub mod plugins;
pub mod pool_manager;
pub mod preferences;
pub mod query_history;
pub mod results_window;
pub mod saved_queries;
pub(crate) mod server_time_compat;
pub mod ssh_tunnel;
pub mod task_manager;
pub mod theme_commands;
pub mod theme_models;
pub mod updater;
pub mod window_title;

pub mod drivers {
    pub mod bootstrap;
    pub mod common;
    pub mod driver_trait;
    pub mod mysql;
    pub mod postgres;
    pub mod registry;
    pub mod sqlite;
}

use logger::{create_log_buffer, init_logger, SharedLogBuffer};

// Global log buffer for capturing logs
static LOG_BUFFER: std::sync::OnceLock<SharedLogBuffer> = std::sync::OnceLock::new();

pub fn get_log_buffer() -> SharedLogBuffer {
    LOG_BUFFER
        .get()
        .expect("Log buffer not initialized")
        .clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // When ssh re-executes this binary as its SSH_ASKPASS helper (see the
    // `askpass` module), serve the prompt and exit without booting the app.
    askpass::maybe_run_askpass_client();

    // On Linux + Wayland, disable the DMA-BUF renderer in WebKitGTK to prevent
    // "Protocol error dispatching to Wayland display" crashes.
    // This targets the specific protocol causing the error while keeping GPU
    // compositing and rendering intact.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WAYLAND_DISPLAY").is_ok()
            || std::env::var("XDG_SESSION_TYPE").map_or(false, |v| v == "wayland")
        {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    let args = cli::parse();

    if args.mcp {
        // Initialize the logger so plugin-loading and driver RPC errors (which
        // use the `log` crate) are visible. The custom logger writes to stderr
        // only, leaving the stdout JSON-RPC stream clean.
        init_logger(create_log_buffer(1000), log::LevelFilter::Info);
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(mcp::run_mcp_server());
        return;
    }

    // Configure log level based on debug flag
    // Default to Info level so users can see application logs
    let log_level = log::LevelFilter::Info;

    // Store debug flag in global state
    app::debug::set_debug_mode(args.debug);

    // Create and initialize log buffer - MUST be before sqlx to capture all logs
    let log_buffer = create_log_buffer(1000);
    LOG_BUFFER
        .set(log_buffer.clone())
        .expect("Failed to initialize log buffer");

    // Initialize custom logger that captures logs to buffer and prints to stderr
    init_logger(log_buffer.clone(), log_level);

    // Log startup message
    log::info!("Nexora application starting...");
    if args.debug {
        log::info!("Debug mode enabled - verbose logging active");
    } else {
        log::info!("Debug mode disabled - standard logging active");
    }

    app::run_desktop(args, log_buffer);
}
