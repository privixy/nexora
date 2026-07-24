use super::super::rpc_driver::*;
use crate::drivers::driver_trait::DriverCapabilities;
use crate::drivers::driver_trait::{DatabaseDriver, PluginManifest};
use crate::models::ConnectionParams;
use crate::models::DatabaseSelection;
use crate::plugins::process::{PluginCommand, PluginProcess};
use crate::plugins::rpc::JsonRpcRequest;
use serde_json::{json, Value};
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

fn test_manifest() -> PluginManifest {
    PluginManifest {
        id: "test-plugin".to_string(),
        name: "Test Plugin".to_string(),
        version: "1.0.0".to_string(),
        description: "Test plugin".to_string(),
        default_port: None,
        capabilities: DriverCapabilities {
            triggers: true,
            ..Default::default()
        },
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
        host: Some("localhost".to_string()),
        port: Some(1234),
        username: Some("user".to_string()),
        password: Some("secret".to_string()),
        database: DatabaseSelection::Single("db".to_string()),
        ssl_mode: None,
        ssl_ca: None,
        ssl_cert: None,
        ssl_key: None,
        enable_cleartext_plugin: None,
        pipes_as_concat: None,
        ssh_enabled: None,
        ssh_connection_id: None,
        ssh_host: None,
        ssh_port: None,
        ssh_user: None,
        ssh_password: None,
        ssh_key_file: None,
        ssh_key_passphrase: None,
        ssh_allow_passphrase_prompt: None,
        save_in_keychain: None,
        k8s_enabled: None,
        k8s_connection_id: None,
        k8s_context: None,
        k8s_namespace: None,
        k8s_resource_type: None,
        k8s_resource_name: None,
        k8s_port: None,
        startup_script: None,
        connection_id: Some("conn-1".to_string()),
    }
}

fn test_driver<F>(mut handle_request: F) -> RpcDriver
where
    F: FnMut(JsonRpcRequest) -> Value + Send + 'static,
{
    let (tx, mut rx) = mpsc::channel::<PluginCommand>(8);
    tokio::spawn(async move {
        while let Some(command) = rx.recv().await {
            if let PluginCommand::Call(request, response_tx) = command {
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    handle_request(request)
                }))
                .map_err(|_| "request assertion failed".to_string());
                let _ = response_tx.send(result);
            }
        }
    });

    let (shutdown_tx, _shutdown_rx) = oneshot::channel();
    RpcDriver {
        manifest: test_manifest(),
        process: Arc::new(PluginProcess {
            sender: tx,
            next_id: AtomicU64::new(1),
            shutdown_tx: tokio::sync::Mutex::new(Some(shutdown_tx)),
            pid: None,
        }),
        data_types: Vec::new(),
    }
}

fn test_driver_result<F>(mut handle_request: F) -> RpcDriver
where
    F: FnMut(JsonRpcRequest) -> Result<Value, String> + Send + 'static,
{
    let (tx, mut rx) = mpsc::channel::<PluginCommand>(8);
    tokio::spawn(async move {
        while let Some(command) = rx.recv().await {
            if let PluginCommand::Call(request, response_tx) = command {
                let result = handle_request(request);
                let _ = response_tx.send(result);
            }
        }
    });

    let (shutdown_tx, _shutdown_rx) = oneshot::channel();
    RpcDriver {
        manifest: test_manifest(),
        process: Arc::new(PluginProcess {
            sender: tx,
            next_id: AtomicU64::new(1),
            shutdown_tx: tokio::sync::Mutex::new(Some(shutdown_tx)),
            pid: None,
        }),
        data_types: Vec::new(),
    }
}

#[tokio::test]
async fn rpc_driver_uses_custom_ai_schema_context_when_available() {
    let driver = test_driver(|request| {
        assert_eq!(request.method, "get_ai_schema_context");
        assert_eq!(request.params["schema"], "public");
        assert_eq!(request.params["max_tables"], 20);
        json!({
            "tables": [{
                "name": "users",
                "columns": [],
                "foreign_keys": []
            }],
            "total_table_count": 1
        })
    });

    let context = driver
        .get_ai_schema_context(&test_connection_params(), Some("public"), 20)
        .await
        .expect("get_ai_schema_context");

    assert_eq!(context.tables.len(), 1);
    assert_eq!(context.tables[0].name, "users");
    assert_eq!(context.total_table_count, 1);
}

#[tokio::test]
async fn rpc_driver_builds_ai_schema_context_from_standard_metadata_as_fallback() {
    let driver = test_driver_result(|request| match request.method.as_str() {
        "get_ai_schema_context" => Err("Method not found (-32601)".to_string()),
        "get_tables" => Ok(json!([{ "name": "users" }])),
        "get_columns" => Ok(json!([{
            "name": "id",
            "data_type": "bigint",
            "is_pk": true,
            "is_nullable": false,
            "is_auto_increment": true
        }])),
        "get_foreign_keys" => Ok(json!([])),
        method => Err(format!("Unexpected method: {method}")),
    });

    let context = driver
        .get_ai_schema_context(&test_connection_params(), Some("public"), 20)
        .await
        .expect("fallback schema context");

    assert_eq!(context.tables.len(), 1);
    assert_eq!(context.tables[0].name, "users");
    assert_eq!(context.tables[0].columns[0].name, "id");
    assert_eq!(context.total_table_count, 1);
}

#[tokio::test]
async fn rpc_driver_forwards_get_triggers() {
    let driver = test_driver(|request| {
        assert_eq!(request.method, "get_triggers");
        assert_eq!(request.params["schema"], "public");
        assert_eq!(request.params["params"]["driver"], "test-plugin");
        json!([
            {
                "name": "users_audit_trg",
                "table_name": "users",
                "event": "INSERT OR UPDATE",
                "timing": "AFTER",
                "definition": "CREATE TRIGGER users_audit_trg ..."
            }
        ])
    });

    let triggers = driver
        .get_triggers(&test_connection_params(), Some("public"))
        .await
        .expect("get_triggers");

    assert_eq!(triggers.len(), 1);
    assert_eq!(triggers[0].name, "users_audit_trg");
    assert_eq!(triggers[0].table_name, "users");
    assert_eq!(triggers[0].event, "INSERT OR UPDATE");
    assert_eq!(triggers[0].timing, "AFTER");
    assert_eq!(
        triggers[0].definition.as_deref(),
        Some("CREATE TRIGGER users_audit_trg ...")
    );
}

#[tokio::test]
async fn rpc_driver_forwards_get_trigger_definition() {
    let driver = test_driver(|request| {
        assert_eq!(request.method, "get_trigger_definition");
        assert_eq!(request.params["trigger_name"], "users_audit_trg");
        assert_eq!(request.params["table_name"], "users");
        assert_eq!(request.params["schema"], "public");
        assert_eq!(request.params["params"]["driver"], "test-plugin");
        json!("CREATE TRIGGER users_audit_trg ...")
    });

    let definition = driver
        .get_trigger_definition(
            &test_connection_params(),
            "users_audit_trg",
            "users",
            Some("public"),
        )
        .await
        .expect("get_trigger_definition");

    assert_eq!(definition, "CREATE TRIGGER users_audit_trg ...");
}

#[tokio::test]
async fn rpc_driver_forwards_create_trigger() {
    let driver = test_driver(|request| {
        assert_eq!(request.method, "create_trigger");
        assert_eq!(
            request.params["trigger_sql"],
            "CREATE TRIGGER users_audit_trg ..."
        );
        assert_eq!(request.params["schema"], "public");
        assert_eq!(request.params["params"]["driver"], "test-plugin");
        Value::Null
    });

    driver
        .create_trigger(
            &test_connection_params(),
            "CREATE TRIGGER users_audit_trg ...",
            Some("public"),
        )
        .await
        .expect("create_trigger");
}

#[tokio::test]
async fn rpc_driver_forwards_drop_trigger() {
    let driver = test_driver(|request| {
        assert_eq!(request.method, "drop_trigger");
        assert_eq!(request.params["trigger_name"], "users_audit_trg");
        assert_eq!(request.params["table_name"], "users");
        assert_eq!(request.params["schema"], "public");
        assert_eq!(request.params["params"]["driver"], "test-plugin");
        Value::Null
    });

    driver
        .drop_trigger(
            &test_connection_params(),
            "users_audit_trg",
            "users",
            Some("public"),
        )
        .await
        .expect("drop_trigger");
}
