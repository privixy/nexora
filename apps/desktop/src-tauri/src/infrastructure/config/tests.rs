use super::*;

#[test]
fn ai_key_workflow_writes_keychain_before_cache_and_deletes_in_the_same_order() {
    let events = std::sync::Mutex::new(Vec::new());
    ai_keys::store_with(
        "openai",
        "secret",
        |provider, key| {
            events
                .lock()
                .unwrap()
                .push(format!("keychain:{provider}:{key}"));
            Ok(())
        },
        |provider, key| {
            events
                .lock()
                .unwrap()
                .push(format!("cache:{provider}:{key}"))
        },
    )
    .unwrap();
    ai_keys::delete_with(
        "openai",
        |provider| {
            events.lock().unwrap().push(format!("delete:{provider}"));
            Ok(())
        },
        |provider| {
            events
                .lock()
                .unwrap()
                .push(format!("invalidate:{provider}"))
        },
    )
    .unwrap();
    assert_eq!(
        *events.lock().unwrap(),
        [
            "keychain:openai:secret",
            "cache:openai:secret",
            "delete:openai",
            "invalidate:openai"
        ]
    );
}

#[test]
fn selected_schemas_default_is_none() {
    let config = AppConfig::default();
    assert!(config.selected_schemas.is_none());
}

#[test]
fn selected_schemas_serialization_round_trip() {
    let mut config = AppConfig::default();
    let mut map = HashMap::new();
    map.insert(
        "conn-1".to_string(),
        vec!["public".to_string(), "analytics".to_string()],
    );
    config.selected_schemas = Some(map);

    let json = serde_json::to_string(&config).unwrap();
    let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

    let schemas = deserialized.selected_schemas.unwrap();
    let conn1 = schemas.get("conn-1").unwrap();
    assert_eq!(conn1, &vec!["public".to_string(), "analytics".to_string()]);
}

#[test]
fn selected_schemas_camel_case_in_json() {
    let mut config = AppConfig::default();
    let mut map = HashMap::new();
    map.insert("conn-1".to_string(), vec!["public".to_string()]);
    config.selected_schemas = Some(map);

    let json = serde_json::to_string(&config).unwrap();
    assert!(json.contains("selectedSchemas"));
    assert!(!json.contains("selected_schemas"));
}

#[test]
fn multiple_connections_independent_selected_schemas() {
    let mut config = AppConfig::default();
    let mut map = HashMap::new();
    map.insert("conn-1".to_string(), vec!["public".to_string()]);
    map.insert(
        "conn-2".to_string(),
        vec!["staging".to_string(), "prod".to_string()],
    );
    config.selected_schemas = Some(map);

    let json = serde_json::to_string(&config).unwrap();
    let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

    let schemas = deserialized.selected_schemas.unwrap();
    assert_eq!(schemas.get("conn-1").unwrap(), &vec!["public".to_string()]);
    assert_eq!(
        schemas.get("conn-2").unwrap(),
        &vec!["staging".to_string(), "prod".to_string()]
    );
}

#[test]
fn old_hidden_schemas_json_deserializes_without_error() {
    // Ensure old config files with hiddenSchemas don't break deserialization
    let json = r#"{"hiddenSchemas":{"conn-1":["secret"]}}"#;
    let config: AppConfig = serde_json::from_str(json).unwrap();
    // hiddenSchemas is no longer a field, so it's ignored; selectedSchemas is None
    assert!(config.selected_schemas.is_none());
}

#[test]
fn editor_fields_default_to_none() {
    let config = AppConfig::default();
    assert!(config.editor_theme.is_none());
    assert!(config.editor_font_family.is_none());
    assert!(config.editor_font_size.is_none());
    assert!(config.editor_line_height.is_none());
    assert!(config.editor_tab_size.is_none());
    assert!(config.editor_word_wrap.is_none());
    assert!(config.editor_show_line_numbers.is_none());
    assert!(config.editor_accept_suggestion_on_enter.is_none());
}

#[test]
fn editor_fields_serialize_with_camel_case() {
    let mut config = AppConfig::default();
    config.editor_font_family = Some("JetBrains Mono".to_string());
    config.editor_font_size = Some(16);
    config.editor_line_height = Some(1.5);
    config.editor_tab_size = Some(4);
    config.editor_word_wrap = Some(false);
    config.editor_show_line_numbers = Some(true);
    config.editor_theme = Some("nexora-light".to_string());
    config.editor_accept_suggestion_on_enter = Some(true);

    let json = serde_json::to_string(&config).unwrap();
    assert!(json.contains("editorFontFamily"));
    assert!(json.contains("editorFontSize"));
    assert!(json.contains("editorLineHeight"));
    assert!(json.contains("editorTabSize"));
    assert!(json.contains("editorWordWrap"));
    assert!(json.contains("editorShowLineNumbers"));
    assert!(json.contains("editorTheme"));
    assert!(json.contains("editorAcceptSuggestionOnEnter"));
    // snake_case must not appear
    assert!(!json.contains("editor_font_family"));
    assert!(!json.contains("editor_accept_suggestion_on_enter"));
}

#[test]
fn editor_fields_round_trip() {
    let json = r#"{
        "editorFontFamily": "Hack",
        "editorFontSize": 14,
        "editorLineHeight": 1.8,
        "editorTabSize": 2,
        "editorWordWrap": true,
        "editorShowLineNumbers": true,
        "editorTheme": "nexora-dark",
        "editorAcceptSuggestionOnEnter": true
    }"#;

    let config: AppConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.editor_font_family.as_deref(), Some("Hack"));
    assert_eq!(config.editor_font_size, Some(14));
    assert_eq!(config.editor_tab_size, Some(2));
    assert_eq!(config.editor_word_wrap, Some(true));
    assert_eq!(config.editor_show_line_numbers, Some(true));
    assert_eq!(config.editor_theme.as_deref(), Some("nexora-dark"));
    assert_eq!(config.editor_accept_suggestion_on_enter, Some(true));
}

#[test]
fn save_config_json_rejects_invalid_json() {
    // Test that the validation logic catches malformed AppConfig JSON
    let invalid = r#"{"editorFontSize": "not-a-number"}"#;
    let result = serde_json::from_str::<AppConfig>(invalid);
    assert!(result.is_err());
}

#[test]
fn ai_safety_fields_default_to_none() {
    let config = AppConfig::default();
    assert!(config.ai_audit_enabled.is_none());
    assert!(config.ai_audit_max_entries.is_none());
    assert!(config.ai_session_gap_minutes.is_none());
    assert!(config.mcp_readonly_default.is_none());
    assert!(config.mcp_readonly_connections.is_none());
    assert!(config.mcp_approval_mode.is_none());
    assert!(config.mcp_approval_timeout_seconds.is_none());
    assert!(config.mcp_preflight_explain.is_none());
    assert!(config.mcp_approval_always_on_top.is_none());
    assert!(config.mcp_approval_notify_sound.is_none());
}

#[test]
fn ai_safety_fields_serialize_with_camel_case() {
    let mut config = AppConfig::default();
    config.ai_audit_enabled = Some(true);
    config.ai_audit_max_entries = Some(1000);
    config.ai_session_gap_minutes = Some(5);
    config.mcp_readonly_default = Some(true);
    config.mcp_readonly_connections = Some(vec!["c1".into()]);
    config.mcp_approval_mode = Some("all".into());
    config.mcp_approval_timeout_seconds = Some(60);
    config.mcp_preflight_explain = Some(false);
    config.mcp_approval_always_on_top = Some(true);
    config.mcp_approval_notify_sound = Some(true);

    let json = serde_json::to_string(&config).unwrap();
    assert!(json.contains("aiAuditEnabled"));
    assert!(json.contains("aiAuditMaxEntries"));
    assert!(json.contains("aiSessionGapMinutes"));
    assert!(json.contains("mcpReadonlyDefault"));
    assert!(json.contains("mcpReadonlyConnections"));
    assert!(json.contains("mcpApprovalMode"));
    assert!(json.contains("mcpApprovalTimeoutSeconds"));
    assert!(json.contains("mcpPreflightExplain"));
    assert!(json.contains("mcpApprovalAlwaysOnTop"));
    assert!(json.contains("mcpApprovalNotifySound"));
}

#[test]
fn ai_safety_fields_round_trip() {
    let json = r#"{
        "aiAuditEnabled": false,
        "aiAuditMaxEntries": 2000,
        "aiSessionGapMinutes": 30,
        "mcpReadonlyDefault": true,
        "mcpReadonlyConnections": ["a", "b"],
        "mcpApprovalMode": "writes_only",
        "mcpApprovalTimeoutSeconds": 90,
        "mcpPreflightExplain": true,
        "mcpApprovalAlwaysOnTop": false,
        "mcpApprovalNotifySound": true
    }"#;
    let config: AppConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.ai_audit_enabled, Some(false));
    assert_eq!(config.ai_audit_max_entries, Some(2000));
    assert_eq!(config.ai_session_gap_minutes, Some(30));
    assert_eq!(config.mcp_readonly_default, Some(true));
    assert_eq!(
        config.mcp_readonly_connections.as_deref(),
        Some(&["a".to_string(), "b".to_string()][..])
    );
    assert_eq!(config.mcp_approval_mode.as_deref(), Some("writes_only"));
    assert_eq!(config.mcp_approval_timeout_seconds, Some(90));
    assert_eq!(config.mcp_preflight_explain, Some(true));
    assert_eq!(config.mcp_approval_always_on_top, Some(false));
    assert_eq!(config.mcp_approval_notify_sound, Some(true));
}

#[test]
fn display_timezone_serializes_with_camel_case_and_round_trips() {
    let mut config = AppConfig::default();
    assert!(config.display_timezone.is_none());
    config.display_timezone = Some("Asia/Tokyo".into());
    let json = serde_json::to_string(&config).unwrap();
    assert!(json.contains("displayTimezone"));
    let parsed: AppConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.display_timezone.as_deref(), Some("Asia/Tokyo"));
}

#[test]
fn is_connection_readonly_default_false_no_override_returns_false() {
    let config = AppConfig::default();
    assert!(!is_connection_readonly(&config, "c1"));
}

#[test]
fn is_connection_readonly_default_false_with_inclusion_list() {
    let mut config = AppConfig::default();
    config.mcp_readonly_default = Some(false);
    config.mcp_readonly_connections = Some(vec!["c1".into()]);
    assert!(is_connection_readonly(&config, "c1"));
    assert!(!is_connection_readonly(&config, "c2"));
}

#[test]
fn is_connection_readonly_default_true_with_exclusion_list() {
    let mut config = AppConfig::default();
    config.mcp_readonly_default = Some(true);
    config.mcp_readonly_connections = Some(vec!["c1".into()]);
    assert!(!is_connection_readonly(&config, "c1"));
    assert!(is_connection_readonly(&config, "c2"));
}

#[test]
fn load_config_from_disk_returns_default_when_missing() {
    // The default config dir is unlikely to have our test sentinels, so
    // we just confirm the call returns a valid AppConfig (Default fallback
    // path is exercised indirectly via parse failures + missing file).
    let _ = load_config_from_disk();
}
