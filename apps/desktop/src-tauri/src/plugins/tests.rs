mod manifest;
mod rpc_driver;

use std::collections::HashMap;
use std::fs;

use tempfile::tempdir;

use super::driver::RpcDriver;
use super::installer::{plugin_project_dirs, read_plugin_info_from_dir};
use super::manager::ConfigManifest;
use super::registry::fetch_registry;
use crate::drivers::driver_trait::{DatabaseDriver, DriverCapabilities, PluginManifest};
use crate::models::{ConnectionParams, DatabaseSelection};

#[test]
fn reads_installed_plugin_info_from_manifest() {
    let dir = tempdir().expect("temp dir");
    let manifest_path = dir.path().join("manifest.json");
    fs::write(
        &manifest_path,
        r#"{
  "id": "google-sheets",
  "name": "Google Sheets",
  "version": "0.2.0",
  "description": "Query Sheets"
}"#,
    )
    .expect("write manifest");

    let plugin = read_plugin_info_from_dir(dir.path()).expect("read manifest");

    assert_eq!(plugin.id, "google-sheets");
    assert_eq!(plugin.name, "Google Sheets");
    assert_eq!(plugin.version, "0.2.0");
    assert_eq!(plugin.description, "Query Sheets");
}

#[test]
fn preserves_ui_extension_driver_filter_from_manifest() {
    let manifest: ConfigManifest = serde_json::from_str(
        r#"{
  "id": "wordpress",
  "name": "WordPress",
  "version": "1.0.0",
  "description": "WordPress driver",
  "ui_extensions": [
    {
      "slot": "connection-modal.connection_content",
      "module": "ui/dist/index.js",
      "driver": "wordpress"
    },
    {
      "slot": "data-grid.toolbar.actions",
      "module": "ui/dist/index.js",
      "order": 10
    }
  ]
}"#,
    )
    .expect("parse manifest");

    let entries = manifest.ui_extensions.expect("ui_extensions present");
    assert_eq!(entries[0].driver.as_deref(), Some("wordpress"));
    assert_eq!(entries[1].driver, None);
    assert_eq!(entries[1].order, Some(10));
}

#[test]
fn returns_error_for_invalid_manifest() {
    let dir = tempdir().expect("temp dir");
    let manifest_path = dir.path().join("manifest.json");
    fs::write(&manifest_path, "{ invalid json").expect("write manifest");

    let error = read_plugin_info_from_dir(dir.path()).expect_err("invalid manifest");

    assert!(error.contains("Failed to parse plugin manifest"));
}

#[test]
fn plugin_project_dirs_use_nexora_identity() {
    let dirs = plugin_project_dirs().expect("project dirs");
    let data_dir = dirs.data_dir().to_string_lossy().to_lowercase();

    assert!(data_dir.contains("nexora"));
}

#[tokio::test]
async fn empty_default_registry_returns_empty_registry() {
    let registry = fetch_registry(None).await.expect("registry");

    assert_eq!(registry.schema_version, 1);
    assert!(registry.plugins.is_empty());
}

fn test_manifest() -> PluginManifest {
    PluginManifest {
        id: "test-plugin".to_string(),
        name: "Test Plugin".to_string(),
        version: "1.0.0".to_string(),
        description: "Test plugin".to_string(),
        default_port: None,
        capabilities: DriverCapabilities::default(),
        is_builtin: false,
        default_username: String::new(),
        color: String::new(),
        icon: String::new(),
        settings: Vec::new(),
        ui_extensions: None,
    }
}

fn test_connection_params() -> ConnectionParams {
    ConnectionParams {
        driver: "test-plugin".to_string(),
        database: DatabaseSelection::Single("customer_db".to_string()),
        connection_id: Some("conn-1".to_string()),
        ..Default::default()
    }
}

#[cfg(unix)]
fn plugin_fixture(
    request_path: Option<&std::path::Path>,
) -> (tempfile::TempDir, std::path::PathBuf) {
    use std::os::unix::fs::PermissionsExt;

    let dir = tempdir().expect("temp dir");
    let path = dir.path().join("plugin.sh");
    let capture_request = request_path
        .map(|path| format!("printf '%s\\n' \"$line\" > '{}'", path.display()))
        .unwrap_or_else(|| ":".to_string());
    fs::write(
        &path,
        format!(
            r##"#!/bin/sh
while IFS= read -r line; do
  method=$(printf '%s' "$line" | sed -n 's/.*"method":"\([^"]*\)".*/\1/p')
  id=$(printf '%s' "$line" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
  if [ "$method" = "initialize" ]; then
    printf '{{"jsonrpc":"2.0","error":{{"code":-32603,"message":"initialization failed"}},"id":%s}}\n' "$id"
  elif [ "$method" = "truncate_table" ]; then
    {capture_request}
    printf '{{"jsonrpc":"2.0","result":null,"id":%s}}\n' "$id"
  fi
done
"##
        ),
    )
    .expect("write plugin fixture");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o755))
        .expect("make plugin fixture executable");
    std::thread::sleep(std::time::Duration::from_millis(10));
    (dir, path)
}

#[cfg(unix)]
async fn wait_for_process_exit(pid: u32) {
    let pid = sysinfo::Pid::from_u32(pid);
    let pids = [pid];
    let mut system = sysinfo::System::new();

    for _ in 0..100 {
        system.refresh_processes(sysinfo::ProcessesToUpdate::Some(&pids), true);
        if system.process(pid).is_none() {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("plugin fixture process {pid} did not exit");
}

#[cfg(unix)]
#[tokio::test]
async fn rpc_driver_reports_plugin_spawn_failure() {
    let path = std::env::temp_dir().join(format!(
        "nexora-plugin-that-does-not-exist-{}",
        std::process::id()
    ));

    let error = RpcDriver::new(
        test_manifest(),
        path.clone(),
        None,
        Vec::new(),
        HashMap::new(),
    )
    .await
    .err()
    .expect("nonexistent plugin must fail to spawn");

    assert_eq!(
        error,
        format!(
            "Failed to start plugin process {:?}: No such file or directory (os error 2)",
            path
        )
    );
}

#[cfg(unix)]
#[tokio::test]
async fn rpc_driver_drop_cleans_up_successfully_spawned_fixture_without_shutdown() {
    let (_dir, path) = plugin_fixture(None);
    let driver = RpcDriver::new(test_manifest(), path, None, Vec::new(), HashMap::new())
        .await
        .unwrap_or_else(|error| panic!("initialization error should be suppressed: {error}"));
    let pid = driver.pid().expect("plugin pid");

    drop(driver);

    wait_for_process_exit(pid).await;
}

#[cfg(unix)]
#[tokio::test]
async fn rpc_driver_forwards_database_schema_and_table_as_json_rpc() {
    let request_dir = tempdir().expect("request temp dir");
    let request_path = request_dir.path().join("request.json");
    let (_dir, path) = plugin_fixture(Some(&request_path));
    let driver = RpcDriver::new(test_manifest(), path, None, Vec::new(), HashMap::new())
        .await
        .unwrap_or_else(|error| panic!("initialization error should be suppressed: {error:?}"));
    let params = test_connection_params();

    driver
        .truncate_table(&params, "audit_log", Some("tenant_42"))
        .await
        .expect("truncate_table");

    let request: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(&request_path).expect("captured JSON-RPC request"),
    )
    .expect("valid JSON-RPC request");
    assert_eq!(request["method"], "truncate_table");
    assert_eq!(request["params"]["params"]["database"], "customer_db");
    assert_eq!(request["params"]["schema"], "tenant_42");
    assert_eq!(request["params"]["table"], "audit_log");
}
