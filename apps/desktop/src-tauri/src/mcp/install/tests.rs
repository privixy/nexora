use super::*;

#[test]
fn lists_codex_as_command_client() {
    let clients = get_all_clients();
    let codex = clients
        .iter()
        .find(|client| client.id == "codex")
        .expect("Codex should be listed as an MCP client");

    assert_eq!(codex.name, "Codex");
    assert_eq!(codex.client_type, "command");
    assert!(
        codex
            .config_path
            .as_ref()
            .is_some_and(|path| path.ends_with(".codex/config.toml")),
        "Codex config path should point to ~/.codex/config.toml"
    );
}

#[test]
fn builds_codex_manual_command() {
    assert_eq!(
        build_manual_command("codex", "/Applications/Nexora.app/nexora").as_deref(),
        Some("codex mcp add nexora -- /Applications/Nexora.app/nexora --mcp")
    );
}

#[test]
fn lists_opencode_and_other_clients() {
    let clients = get_all_clients();
    let opencode = clients
        .iter()
        .find(|client| client.id == "opencode")
        .expect("OpenCode should be listed as an MCP client");
    let other = clients
        .iter()
        .find(|client| client.id == "other")
        .expect("Other should be listed as an MCP client");

    assert_eq!(opencode.name, "OpenCode");
    assert_eq!(opencode.client_type, "opencode");
    assert!(
        opencode
            .config_path
            .as_ref()
            .is_some_and(|path| path.ends_with("opencode/opencode.json")),
        "OpenCode config path should point to the global opencode config"
    );
    assert_eq!(other.name, "Other");
    assert_eq!(other.client_type, "manual");
    assert!(other.config_path.is_none());
}

#[test]
fn builds_claude_code_manual_command() {
    assert_eq!(
        build_manual_command("claude_code", "/Applications/Nexora.app/nexora").as_deref(),
        Some("claude mcp add --scope user nexora /Applications/Nexora.app/nexora -- --mcp")
    );
}

#[test]
fn detects_codex_toml_config() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_path = temp_dir.path().join("config.toml");
    fs::write(
        &config_path,
        r#"
[mcp_servers.nexora]
command = "/Applications/Nexora.app/nexora"
args = ["--mcp"]
"#,
    )
    .unwrap();

    assert!(is_command_client_installed(&config_path));
}

#[test]
fn detects_opencode_json_config() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_path = temp_dir.path().join("opencode.json");
    fs::write(
        &config_path,
        r#"
{
  "mcp": {
"nexora": {
  "type": "local",
  "command": ["/Applications/Nexora.app/nexora", "--mcp"],
  "enabled": true
}
  }
}
"#,
    )
    .unwrap();

    assert!(is_opencode_client_installed(&config_path));
}

#[test]
fn writes_opencode_config_and_verifies_install() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_path = temp_dir.path().join("opencode.json");
    fs::write(
        &config_path,
        r#"
{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": false
}
"#,
    )
    .unwrap();
    let client = McpClient {
        id: "opencode",
        name: "OpenCode",
        config_path: Some(config_path.clone()),
        client_type: "opencode",
    };

    write_mcp_config(&client, "/Applications/Nexora.app/nexora").unwrap();

    let config = read_json_config(&config_path).unwrap();
    assert_eq!(config["autoupdate"], false);
    assert_eq!(config["mcp"]["nexora"]["type"], "local");
    assert_eq!(
        config["mcp"]["nexora"]["command"],
        json!(["/Applications/Nexora.app/nexora", "--mcp"])
    );
    assert_eq!(config["mcp"]["nexora"]["enabled"], true);
    assert!(is_opencode_client_installed(&config_path));
}

#[test]
fn refuses_to_successfully_install_invalid_json_config() {
    let temp_dir = tempfile::tempdir().unwrap();
    let config_path = temp_dir.path().join("mcp.json");
    fs::write(&config_path, "{").unwrap();
    let client = McpClient {
        id: "cursor",
        name: "Cursor",
        config_path: Some(config_path.clone()),
        client_type: "file",
    };

    let err = write_mcp_config(&client, "/Applications/Nexora.app/nexora").unwrap_err();

    assert!(err.contains("Invalid JSON"));
    assert!(!is_nexora_in_mcp_servers(&config_path));
}
