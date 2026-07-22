use nexora_lib::config::{
    is_connection_readonly, AiKeyStatus, AppConfig, PluginConfig,
    DEFAULT_AI_AUDIT_ENABLED, DEFAULT_AI_AUDIT_MAX_ENTRIES, DEFAULT_AI_SESSION_GAP_MINUTES,
    DEFAULT_MCP_APPROVAL_ALWAYS_ON_TOP, DEFAULT_MCP_APPROVAL_MODE,
    DEFAULT_MCP_APPROVAL_NOTIFY_SOUND, DEFAULT_MCP_APPROVAL_TIMEOUT_SECONDS,
    DEFAULT_MCP_PREFLIGHT_EXPLAIN, DEFAULT_MCP_READONLY_DEFAULT,
};

#[test]
fn public_config_api_remains_available() {
    let config = AppConfig::default();
    let plugin = PluginConfig::default();
    let status = AiKeyStatus {
        configured: false,
        from_env: false,
    };

    assert!(!is_connection_readonly(&config, "connection-1"));
    assert!(plugin.interpreter.is_none());
    assert!(!status.configured);
    assert!(DEFAULT_AI_AUDIT_ENABLED);
    assert_eq!(DEFAULT_AI_AUDIT_MAX_ENTRIES, 5000);
    assert_eq!(DEFAULT_AI_SESSION_GAP_MINUTES, 10);
    assert!(!DEFAULT_MCP_READONLY_DEFAULT);
    assert_eq!(DEFAULT_MCP_APPROVAL_MODE, "writes_only");
    assert_eq!(DEFAULT_MCP_APPROVAL_TIMEOUT_SECONDS, 120);
    assert!(DEFAULT_MCP_PREFLIGHT_EXPLAIN);
    assert!(DEFAULT_MCP_APPROVAL_ALWAYS_ON_TOP);
    assert!(DEFAULT_MCP_APPROVAL_NOTIFY_SOUND);
}

#[test]
fn target_config_modules_and_facades_exist() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    for file in ["model.rs", "store.rs", "ai_keys.rs", "prompts.rs"] {
        assert!(root.join("infrastructure/config").join(file).exists());
    }

    let root_facade = std::fs::read_to_string(root.join("config.rs")).unwrap();
    assert!(root_facade.contains("pub use crate::commands::config::*"));
    assert!(root_facade.contains("pub use crate::infrastructure::config::*"));
    assert!(!root_facade.contains("#[tauri::command]"));

    let command_adapter = std::fs::read_to_string(root.join("commands/config.rs")).unwrap();
    assert!(command_adapter.contains("#[tauri::command]"));
}
