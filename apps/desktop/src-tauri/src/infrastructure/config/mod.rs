use crate::keychain_utils;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::AppHandle;
use tauri::Manager;

use std::collections::HashMap;

pub mod ai_keys;
pub mod model;
pub mod prompts;
pub mod store;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
    pub interpreter: Option<String>,
    #[serde(default)]
    pub settings: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub theme: Option<String>,
    pub language: Option<String>,
    pub result_page_size: Option<u32>,
    pub font_family: Option<String>,
    pub font_size: Option<u32>,
    /// Colorize query result cell values by their data type (number, string,
    /// date, boolean). Default: false — values render in the primary text color.
    pub result_color_by_type: Option<bool>,
    /// Per-type hex color overrides for result cell values. Keys: "number",
    /// "string", "date", "boolean". Missing keys fall back to the active theme's
    /// semantic colors.
    pub result_type_colors: Option<HashMap<String, String>>,
    pub ai_enabled: Option<bool>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub ai_custom_models: Option<HashMap<String, Vec<String>>>,
    pub ai_ollama_port: Option<u16>,
    pub ai_custom_openai_url: Option<String>,
    pub ai_custom_openai_model: Option<String>,
    pub check_for_updates: Option<bool>,
    pub auto_check_updates_on_startup: Option<bool>,
    pub last_dismissed_version: Option<String>,
    pub er_diagram_default_layout: Option<String>,
    pub schema_preferences: Option<HashMap<String, String>>,
    pub selected_schemas: Option<HashMap<String, Vec<String>>>,
    pub max_blob_size: Option<u64>,
    pub copy_format: Option<String>,
    pub csv_delimiter: Option<String>,
    /// Whether copied CSV output includes a header row. Default: true.
    pub csv_include_headers: Option<bool>,
    pub active_external_drivers: Option<Vec<String>>,
    pub custom_registry_url: Option<String>,
    pub plugins: Option<HashMap<String, PluginConfig>>,
    pub editor_theme: Option<String>,
    pub editor_font_family: Option<String>,
    pub editor_font_size: Option<u32>,
    pub editor_line_height: Option<f32>,
    pub editor_tab_size: Option<u32>,
    pub editor_word_wrap: Option<bool>,
    pub editor_show_line_numbers: Option<bool>,
    /// Whether the Enter key accepts the active autocomplete suggestion in the
    /// SQL editor. Maps to Monaco's `acceptSuggestionOnEnter` setting: `true`
    /// becomes `"smart"` (the safer variant), `false` becomes `"off"`.
    /// Default: `true` — matches the behaviour users expect from most editors.
    pub editor_accept_suggestion_on_enter: Option<bool>,
    /// Connection health check interval in seconds. 0 = disabled. Default: 30.
    pub ping_interval: Option<u32>,
    /// Maximum number of query history entries per connection. Default: 500.
    pub query_history_max_entries: Option<u32>,
    /// Whether to show the welcome screen on startup. Default: true (first launch).
    pub show_welcome: Option<bool>,
    /// Maximize the window on startup. Default: false.
    pub start_maximized: Option<bool>,
    /// IANA timezone name (e.g. `Asia/Tokyo`) used to render timestamps in the
    /// UI and exports. `None` or `"auto"` follows the OS local timezone.
    pub display_timezone: Option<String>,

    // ----- AI Audit Log -----
    /// Record every MCP tool call to the audit log. Default: true.
    pub ai_audit_enabled: Option<bool>,
    /// Maximum entries per audit-log file before rotation. Default: 5000.
    pub ai_audit_max_entries: Option<u32>,
    /// Inactivity gap (in minutes) after which a new MCP session id is minted.
    /// Default: 10.
    pub ai_session_gap_minutes: Option<u32>,

    // ----- MCP Read-only Mode -----
    /// Default behaviour for MCP `run_query`: when true, every connection is
    /// read-only unless explicitly listed as writable. Default: false.
    pub mcp_readonly_default: Option<bool>,
    /// Per-connection override list. Semantics depend on `mcp_readonly_default`:
    /// when default is `false` this is the *inclusion* list of read-only
    /// connections; when default is `true` this is the *exclusion* list of
    /// connections that are allowed to write.
    pub mcp_readonly_connections: Option<Vec<String>>,

    // ----- MCP Approval Gate -----
    /// `"off"` | `"writes_only"` | `"all"`. Default: `"writes_only"`.
    pub mcp_approval_mode: Option<String>,
    /// Maximum time the MCP subprocess waits for the user to decide. Default: 120.
    pub mcp_approval_timeout_seconds: Option<u32>,
    /// Run a pre-flight EXPLAIN before opening the approval modal. Default: true.
    pub mcp_preflight_explain: Option<bool>,
    /// Bring the main window to the foreground and make it temporarily top-most
    /// while an MCP approval is pending. Default: true.
    pub mcp_approval_always_on_top: Option<bool>,
    /// Send a native notification and play a short sound when a new MCP
    /// approval request arrives. Default: true.
    pub mcp_approval_notify_sound: Option<bool>,

    // ----- Session restore -----
    /// Reconnect to the last active connection on startup. Default: true.
    pub auto_connect_last_connection: Option<bool>,
    /// Id of the connection that was active when the app was last closed.
    pub last_active_connection_id: Option<String>,
    /// Ids of all connections that were open when the app was last closed.
    pub last_open_connection_ids: Option<Vec<String>>,
}

static CONFIG_CACHE: Lazy<RwLock<AppConfig>> = Lazy::new(|| RwLock::new(AppConfig::default()));

pub fn get_config_dir<R: tauri::Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok()
}

fn cache_config(config: &AppConfig) {
    if let Ok(mut cached) = CONFIG_CACHE.write() {
        *cached = config.clone();
    }
}

pub fn get_cached_config() -> AppConfig {
    CONFIG_CACHE
        .read()
        .map(|cached| cached.clone())
        .unwrap_or_default()
}

// ---------- AI/MCP safety defaults ----------
pub const DEFAULT_AI_AUDIT_ENABLED: bool = true;
pub const DEFAULT_AI_AUDIT_MAX_ENTRIES: u32 = 5000;
pub const DEFAULT_AI_SESSION_GAP_MINUTES: u32 = 10;
pub const DEFAULT_MCP_READONLY_DEFAULT: bool = false;
pub const DEFAULT_MCP_APPROVAL_MODE: &str = "writes_only";
pub const DEFAULT_MCP_APPROVAL_TIMEOUT_SECONDS: u32 = 120;
pub const DEFAULT_MCP_PREFLIGHT_EXPLAIN: bool = true;
pub const DEFAULT_MCP_APPROVAL_ALWAYS_ON_TOP: bool = true;
pub const DEFAULT_MCP_APPROVAL_NOTIFY_SOUND: bool = true;

/// Load `config.json` directly from disk without an `AppHandle`.
///
/// Used by the standalone MCP subprocess (`nexora --mcp`) which has no
/// Tauri runtime. Falls back to `AppConfig::default()` when missing or
/// unreadable.
pub fn load_config_from_disk() -> AppConfig {
    let path = crate::paths::get_app_config_dir().join("config.json");
    if !path.exists() {
        return AppConfig::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<AppConfig>(&s).ok())
        .unwrap_or_default()
}

/// True when `connection_id` should be treated as read-only by MCP, taking
/// the per-connection override list into account.
pub fn is_connection_readonly(config: &AppConfig, connection_id: &str) -> bool {
    let default_ro = config
        .mcp_readonly_default
        .unwrap_or(DEFAULT_MCP_READONLY_DEFAULT);
    let listed = config
        .mcp_readonly_connections
        .as_ref()
        .map(|v| v.iter().any(|s| s == connection_id))
        .unwrap_or(false);
    // When default is false the list flips that connection to read-only.
    // When default is true the list flips that connection to writable.
    if default_ro {
        !listed
    } else {
        listed
    }
}

// Internal load
pub fn load_config_internal<R: tauri::Runtime>(app: &AppHandle<R>) -> AppConfig {
    if let Some(config_dir) = get_config_dir(app) {
        let config_path = config_dir.join("config.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(config_path) {
                if let Ok(config) = serde_json::from_str(&content) {
                    cache_config(&config);
                    return config;
                }
            }
        }
    }
    let default_config = AppConfig::default();
    cache_config(&default_config);
    default_config
}

pub fn get_config_impl(app: AppHandle) -> AppConfig {
    load_config_internal(&app)
}

pub fn save_config_impl(app: AppHandle, config: AppConfig) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");

        // Load existing config and merge with new values
        let mut existing_config = load_config_internal(&app);

        // Merge: only update fields that are Some in the new config
        if config.theme.is_some() {
            existing_config.theme = config.theme;
        }
        if config.language.is_some() {
            existing_config.language = config.language;
        }
        if config.result_page_size.is_some() {
            existing_config.result_page_size = config.result_page_size;
        }
        if config.font_family.is_some() {
            existing_config.font_family = config.font_family;
        }
        if config.font_size.is_some() {
            existing_config.font_size = config.font_size;
        }
        if config.result_color_by_type.is_some() {
            existing_config.result_color_by_type = config.result_color_by_type;
        }
        if config.result_type_colors.is_some() {
            existing_config.result_type_colors = config.result_type_colors;
        }
        if config.ai_enabled.is_some() {
            existing_config.ai_enabled = config.ai_enabled;
        }
        if config.ai_provider.is_some() {
            existing_config.ai_provider = config.ai_provider;
        }
        if config.ai_model.is_some() {
            existing_config.ai_model = config.ai_model;
        }
        if config.ai_custom_models.is_some() {
            existing_config.ai_custom_models = config.ai_custom_models;
        }
        if config.ai_ollama_port.is_some() {
            existing_config.ai_ollama_port = config.ai_ollama_port;
        }
        if config.ai_custom_openai_url.is_some() {
            existing_config.ai_custom_openai_url = config.ai_custom_openai_url;
        }
        if config.ai_custom_openai_model.is_some() {
            existing_config.ai_custom_openai_model = config.ai_custom_openai_model;
        }
        if config.check_for_updates.is_some() {
            existing_config.check_for_updates = config.check_for_updates;
        }
        if config.auto_check_updates_on_startup.is_some() {
            existing_config.auto_check_updates_on_startup = config.auto_check_updates_on_startup;
        }
        if config.last_dismissed_version.is_some() {
            existing_config.last_dismissed_version = config.last_dismissed_version;
        }
        if config.er_diagram_default_layout.is_some() {
            existing_config.er_diagram_default_layout = config.er_diagram_default_layout;
        }
        if config.schema_preferences.is_some() {
            existing_config.schema_preferences = config.schema_preferences;
        }
        if config.selected_schemas.is_some() {
            existing_config.selected_schemas = config.selected_schemas;
        }
        if config.max_blob_size.is_some() {
            existing_config.max_blob_size = config.max_blob_size;
        }
        if config.copy_format.is_some() {
            existing_config.copy_format = config.copy_format;
        }
        if config.csv_delimiter.is_some() {
            existing_config.csv_delimiter = config.csv_delimiter;
        }
        if config.csv_include_headers.is_some() {
            existing_config.csv_include_headers = config.csv_include_headers;
        }
        if config.active_external_drivers.is_some() {
            existing_config.active_external_drivers = config.active_external_drivers;
        }
        if config.plugins.is_some() {
            existing_config.plugins = config.plugins;
        }
        if config.editor_theme.is_some() {
            existing_config.editor_theme = config.editor_theme;
        }
        if config.editor_font_family.is_some() {
            existing_config.editor_font_family = config.editor_font_family;
        }
        if config.editor_font_size.is_some() {
            existing_config.editor_font_size = config.editor_font_size;
        }
        if config.editor_line_height.is_some() {
            existing_config.editor_line_height = config.editor_line_height;
        }
        if config.editor_tab_size.is_some() {
            existing_config.editor_tab_size = config.editor_tab_size;
        }
        if config.editor_word_wrap.is_some() {
            existing_config.editor_word_wrap = config.editor_word_wrap;
        }
        if config.editor_show_line_numbers.is_some() {
            existing_config.editor_show_line_numbers = config.editor_show_line_numbers;
        }
        if config.editor_accept_suggestion_on_enter.is_some() {
            existing_config.editor_accept_suggestion_on_enter =
                config.editor_accept_suggestion_on_enter;
        }
        if config.ping_interval.is_some() {
            let old_interval = existing_config.ping_interval;
            existing_config.ping_interval = config.ping_interval;
            // Restart the ping loop if the interval changed.
            if existing_config.ping_interval != old_interval {
                let interval = existing_config
                    .ping_interval
                    .unwrap_or(crate::health_check::DEFAULT_PING_INTERVAL);
                tauri::async_runtime::spawn(crate::health_check::restart_ping_loop(
                    app.clone(),
                    interval as u64,
                ));
            }
        }
        if config.query_history_max_entries.is_some() {
            existing_config.query_history_max_entries = config.query_history_max_entries;
        }
        if config.show_welcome.is_some() {
            existing_config.show_welcome = config.show_welcome;
        }
        if config.start_maximized.is_some() {
            existing_config.start_maximized = config.start_maximized;
        }
        if config.display_timezone.is_some() {
            existing_config.display_timezone = config.display_timezone;
        }
        if config.ai_audit_enabled.is_some() {
            existing_config.ai_audit_enabled = config.ai_audit_enabled;
        }
        if config.ai_audit_max_entries.is_some() {
            existing_config.ai_audit_max_entries = config.ai_audit_max_entries;
        }
        if config.ai_session_gap_minutes.is_some() {
            existing_config.ai_session_gap_minutes = config.ai_session_gap_minutes;
        }
        if config.mcp_readonly_default.is_some() {
            existing_config.mcp_readonly_default = config.mcp_readonly_default;
        }
        if config.mcp_readonly_connections.is_some() {
            existing_config.mcp_readonly_connections = config.mcp_readonly_connections;
        }
        if config.mcp_approval_mode.is_some() {
            existing_config.mcp_approval_mode = config.mcp_approval_mode;
        }
        if config.mcp_approval_timeout_seconds.is_some() {
            existing_config.mcp_approval_timeout_seconds = config.mcp_approval_timeout_seconds;
        }
        if config.mcp_preflight_explain.is_some() {
            existing_config.mcp_preflight_explain = config.mcp_preflight_explain;
        }
        if config.mcp_approval_always_on_top.is_some() {
            existing_config.mcp_approval_always_on_top = config.mcp_approval_always_on_top;
        }
        if config.mcp_approval_notify_sound.is_some() {
            existing_config.mcp_approval_notify_sound = config.mcp_approval_notify_sound;
        }
        if config.auto_connect_last_connection.is_some() {
            existing_config.auto_connect_last_connection = config.auto_connect_last_connection;
        }
        if config.last_active_connection_id.is_some() {
            existing_config.last_active_connection_id = config.last_active_connection_id;
        }
        if config.last_open_connection_ids.is_some() {
            existing_config.last_open_connection_ids = config.last_open_connection_ids;
        }

        let content = serde_json::to_string_pretty(&existing_config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        cache_config(&existing_config);
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

pub fn get_schema_preference_impl(app: AppHandle, connection_id: String) -> Option<String> {
    let config = load_config_internal(&app);
    config
        .schema_preferences
        .and_then(|prefs| prefs.get(&connection_id).cloned())
}

pub fn set_schema_preference_impl(
    app: AppHandle,
    connection_id: String,
    schema: String,
) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");
        let mut config = load_config_internal(&app);
        let prefs = config.schema_preferences.get_or_insert_with(HashMap::new);
        prefs.insert(connection_id, schema);
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

pub fn get_last_active_connection_impl(app: AppHandle) -> Option<String> {
    load_config_internal(&app).last_active_connection_id
}

pub fn set_last_active_connection_impl(
    app: AppHandle,
    connection_id: Option<String>,
) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");
        let mut config = load_config_internal(&app);
        config.last_active_connection_id = connection_id;
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        cache_config(&config);
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

pub fn get_last_open_connections_impl(app: AppHandle) -> Vec<String> {
    load_config_internal(&app)
        .last_open_connection_ids
        .unwrap_or_default()
}

pub fn set_last_open_connections_impl(
    app: AppHandle,
    connection_ids: Vec<String>,
) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");
        let mut config = load_config_internal(&app);
        config.last_open_connection_ids = Some(connection_ids);
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        cache_config(&config);
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

pub fn get_selected_schemas_impl(app: AppHandle, connection_id: String) -> Vec<String> {
    let config = load_config_internal(&app);
    config
        .selected_schemas
        .and_then(|map| map.get(&connection_id).cloned())
        .unwrap_or_default()
}

pub fn set_selected_schemas_impl(
    app: AppHandle,
    connection_id: String,
    schemas: Vec<String>,
) -> Result<(), String> {
    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");
        let mut config = load_config_internal(&app);
        let map = config.selected_schemas.get_or_insert_with(HashMap::new);
        if schemas.is_empty() {
            map.remove(&connection_id);
        } else {
            map.insert(connection_id, schemas);
        }
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}





/// Get the configured maximum BLOB size in bytes, or DEFAULT_MAX_BLOB_SIZE if not set
pub fn get_max_blob_size<R: tauri::Runtime>(app: &AppHandle<R>) -> u64 {
    let config = load_config_internal(app);
    config
        .max_blob_size
        .unwrap_or(crate::drivers::common::DEFAULT_MAX_BLOB_SIZE)
}

pub fn get_ai_api_key(app: &AppHandle, provider: &str) -> Result<String, String> {
    // 1. Try Keychain First (Override) — via the in-memory credential cache so
    //    repeated lookups don't trigger a macOS Keychain authorization prompt
    //    each time. The keychain is read at most once per provider per session.
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    if let Ok(key) = crate::credential_cache::get_ai_key_cached(&cache, provider) {
        if !key.is_empty() {
            return Ok(key);
        }
    }

    // 2. Try Env Var
    let env_var = match provider {
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        "custom-openai" => "CUSTOM_OPENAI_API_KEY",
        "minimax" => "MINIMAX_API_KEY",
        _ => "",
    };

    if !env_var.is_empty() {
        if let Ok(key) = std::env::var(env_var) {
            if !key.is_empty() {
                return Ok(key);
            }
        }
    }

    Err(format!(
        "API Key for {} not found in Keychain or Environment",
        provider
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiKeyStatus {
    pub configured: bool,
    pub from_env: bool,
}

pub fn get_ai_api_key_status(app: &AppHandle, provider: &str) -> AiKeyStatus {
    // 1. Check Keychain (through the cache to avoid repeated auth prompts)
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    let keychain_exists = crate::credential_cache::get_ai_key_cached(&cache, provider).is_ok();

    // 2. Check Env Var
    let env_var = match provider {
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        "custom-openai" => "CUSTOM_OPENAI_API_KEY",
        "minimax" => "MINIMAX_API_KEY",
        _ => "",
    };

    let env_exists = if !env_var.is_empty() {
        std::env::var(env_var)
            .map(|k| !k.is_empty())
            .unwrap_or(false)
    } else {
        false
    };

    // Configured if either exists
    // from_env is true ONLY if keychain is NOT present but env IS present
    // because keychain overrides env now

    if keychain_exists {
        AiKeyStatus {
            configured: true,
            from_env: false, // Even if env exists, we are using keychain
        }
    } else if env_exists {
        AiKeyStatus {
            configured: true,
            from_env: true,
        }
    } else {
        AiKeyStatus {
            configured: false,
            from_env: false,
        }
    }
}





const DEFAULT_SYSTEM_PROMPT: &str = "You are an expert SQL assistant. Your task is to generate a SQL query based on the user's request and the provided database schema.\nReturn ONLY the SQL query, without any markdown formatting, explanations, or code blocks.\n\nSchema:\n{{SCHEMA}}";
const DEFAULT_EXPLAIN_PROMPT: &str =
    "You are a helpful SQL assistant. Explain SQL queries in {{LANGUAGE}}.";
const DEFAULT_EXPLAINPLAN_PROMPT: &str =
    "You are a database performance expert. Analyze the following SQL query and its EXPLAIN plan output. Identify performance bottlenecks, suggest index improvements, and explain the execution strategy. Respond in {{LANGUAGE}}.";
const DEFAULT_CELLNAME_PROMPT: &str = "You are an assistant that generates concise, descriptive names for notebook cells.\nGiven a SQL query or Markdown content, return ONLY a short name (3-6 words max) that describes what the cell does or what it is about.\nDo not include quotes, punctuation, or explanations. Just the name.";
const DEFAULT_TABRENAME_PROMPT: &str = "You are an assistant that generates concise, descriptive names for SQL query result tabs.\nGiven a SQL query, return ONLY a short name (3-6 words max) that describes what the query does.\nDo not include quotes, punctuation, or explanations. Just the name.";

fn get_prompt(app: &AppHandle, filename: &str, default: &str) -> String {
    if let Some(config_dir) = get_config_dir(app) {
        let path = config_dir.join(filename);
        if let Ok(content) = fs::read_to_string(path) {
            return content;
        }
    }
    default.to_string()
}

fn save_prompt(app: &AppHandle, filename: &str, prompt: &str) -> Result<(), String> {
    let config_dir = get_config_dir(app).ok_or("Could not resolve config directory")?;
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    fs::write(config_dir.join(filename), prompt).map_err(|e| e.to_string())
}

fn reset_prompt(app: &AppHandle, filename: &str, default: &str) -> Result<String, String> {
    if let Some(config_dir) = get_config_dir(app) {
        let path = config_dir.join(filename);
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(default.to_string())
}

pub fn get_system_prompt_impl(app: AppHandle) -> String {
    get_prompt(&app, "prompt_query.txt", DEFAULT_SYSTEM_PROMPT)
}
pub fn save_system_prompt_impl(app: AppHandle, prompt: String) -> Result<(), String> {
    save_prompt(&app, "prompt_query.txt", &prompt)
}
pub fn reset_system_prompt_impl(app: AppHandle) -> Result<String, String> {
    reset_prompt(&app, "prompt_query.txt", DEFAULT_SYSTEM_PROMPT)
}

pub fn get_explain_prompt_impl(app: AppHandle) -> String {
    get_prompt(&app, "prompt_explain.txt", DEFAULT_EXPLAIN_PROMPT)
}
pub fn save_explain_prompt_impl(app: AppHandle, prompt: String) -> Result<(), String> {
    save_prompt(&app, "prompt_explain.txt", &prompt)
}
pub fn reset_explain_prompt_impl(app: AppHandle) -> Result<String, String> {
    reset_prompt(&app, "prompt_explain.txt", DEFAULT_EXPLAIN_PROMPT)
}

pub fn get_explainplan_prompt_impl(app: AppHandle) -> String {
    get_prompt(&app, "prompt_explainplan.txt", DEFAULT_EXPLAINPLAN_PROMPT)
}
pub fn save_explainplan_prompt_impl(app: AppHandle, prompt: String) -> Result<(), String> {
    save_prompt(&app, "prompt_explainplan.txt", &prompt)
}
pub fn reset_explainplan_prompt_impl(app: AppHandle) -> Result<String, String> {
    reset_prompt(&app, "prompt_explainplan.txt", DEFAULT_EXPLAINPLAN_PROMPT)
}

pub fn get_cellname_prompt_impl(app: AppHandle) -> String {
    get_prompt(&app, "prompt_cellname.txt", DEFAULT_CELLNAME_PROMPT)
}
pub fn save_cellname_prompt_impl(app: AppHandle, prompt: String) -> Result<(), String> {
    save_prompt(&app, "prompt_cellname.txt", &prompt)
}
pub fn reset_cellname_prompt_impl(app: AppHandle) -> Result<String, String> {
    reset_prompt(&app, "prompt_cellname.txt", DEFAULT_CELLNAME_PROMPT)
}

pub fn get_tabrename_prompt_impl(app: AppHandle) -> String {
    get_prompt(&app, "prompt_tabrename.txt", DEFAULT_TABRENAME_PROMPT)
}
pub fn save_tabrename_prompt_impl(app: AppHandle, prompt: String) -> Result<(), String> {
    save_prompt(&app, "prompt_tabrename.txt", &prompt)
}
pub fn reset_tabrename_prompt_impl(app: AppHandle) -> Result<String, String> {
    reset_prompt(&app, "prompt_tabrename.txt", DEFAULT_TABRENAME_PROMPT)
}

pub fn get_config_json_impl(app: AppHandle) -> Result<String, String> {
    if let Some(config_dir) = get_config_dir(&app) {
        let config_path = config_dir.join("config.json");
        if config_path.exists() {
            return fs::read_to_string(config_path).map_err(|e| e.to_string());
        }
    }
    // Return empty JSON object if no config file exists yet
    Ok("{}".to_string())
}



pub fn save_config_json_impl(app: AppHandle, json: String) -> Result<(), String> {
    // Validate the JSON parses as a valid AppConfig
    serde_json::from_str::<AppConfig>(&json)
        .map_err(|e| format!("Invalid configuration JSON: {}", e))?;

    if let Some(config_dir) = get_config_dir(&app) {
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");
        // Re-serialize with pretty-printing for consistency
        let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
        let pretty = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
        fs::write(config_path, pretty).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not resolve config directory".to_string())
    }
}

#[cfg(test)]
mod tests;
