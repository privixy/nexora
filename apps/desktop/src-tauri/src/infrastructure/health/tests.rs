use super::*;
use std::fs;

async fn clear_active_connections() {
    let ids = active_connections().await;
    for id in ids {
        unregister_connection(&id).await;
    }
}

#[tokio::test]
async fn registration_and_unregistration_return_current_snapshots() {
    clear_active_connections().await;
    register_connection("second".to_string()).await;
    register_connection("first".to_string()).await;
    let mut ids = active_connections().await;
    ids.sort();
    assert_eq!(ids, vec!["first", "second"]);
    unregister_connection("first").await;
    assert_eq!(active_connections().await, vec!["second"]);
    clear_active_connections().await;
}

#[test]
fn health_loop_and_failure_contract_remain_ordered() {
    let source = fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/infrastructure/health/ping.rs"
    ))
    .unwrap();
    assert!(source.contains("const FAILURE_THRESHOLD: u32 = 2;"));
    assert!(source.contains("const PING_TIMEOUT: Duration = Duration::from_secs(5);"));
    assert!(source.contains("if interval_secs == 0"));
    assert!(source.contains("let mut interval = tokio::time::interval"));
    assert!(source.contains("futures::future::join_all"));
    assert!(source.contains("failure_counts.remove(&conn_id);"));
    assert!(source.contains("if is_builtin && !crate::pool_manager::has_pool"));
    assert!(source.contains("tokio::time::timeout(PING_TIMEOUT, driver.ping(&params))"));

    let failure = source
        .split("async fn handle_connection_failure")
        .nth(1)
        .unwrap();
    let ordered = [
        "unregister_connection(connection_id).await",
        "crate::pool_manager::close_pool_with_id",
        "\"connection-health-failed\"",
        "emit_active_changed(app).await",
    ];
    let mut cursor = 0;
    for needle in ordered {
        let found = failure[cursor..]
            .find(needle)
            .unwrap_or_else(|| panic!("missing ordered health failure fragment: {needle}"));
        cursor += found + needle.len();
    }
    assert!(failure.contains("\"connectionId\": connection_id"));
    assert!(failure.contains("\"error\": error"));
}

#[test]
fn active_event_contract_is_preserved() {
    let source = fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/infrastructure/health/events.rs"
    ))
    .unwrap();
    assert!(source.contains(
        "pub const ACTIVE_CONNECTIONS_CHANGED_EVENT: &str = \"connections:active-changed\";"
    ));
}
