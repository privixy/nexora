#![allow(unused_imports)]

use nexora_lib::plugins::driver::{PluginProcess, RpcDriver};

#[test]
fn legacy_plugin_driver_exports_remain_available() {}

#[test]
fn target_plugin_transport_and_adapter_are_separate() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/plugins");
    let facade = std::fs::read_to_string(root.join("driver.rs")).unwrap();
    let process = std::fs::read_to_string(root.join("process.rs")).unwrap();
    let adapter = std::fs::read_to_string(root.join("rpc_driver.rs")).unwrap();
    assert!(facade.contains("pub use super::process::PluginProcess;"));
    assert!(facade.contains("pub use super::rpc_driver::RpcDriver;"));
    assert!(process.contains("pub struct PluginProcess"));
    assert!(!process.contains("impl DatabaseDriver for RpcDriver"));
    assert!(adapter.contains("impl DatabaseDriver for RpcDriver"));
    assert!(!adapter.contains("tokio::process::Command"));
}
