use super::*;

#[test]
fn compatibility_facade_exports_the_complete_public_health_api() {
    let _ = register_connection;
    let _ = unregister_connection;
    let _ = active_connections;
    let _ = emit_active_changed::<tauri::Wry>;
    let _ = start_ping_loop;
    let _ = stop_ping_loop;
    let _ = restart_ping_loop;
    assert_eq!(DEFAULT_PING_INTERVAL, 30);
    assert_eq!(
        ACTIVE_CONNECTIONS_CHANGED_EVENT,
        "connections:active-changed"
    );

    let source = include_str!("../health_check.rs");
    assert!(!source.contains("FAILURE_THRESHOLD"));
    assert!(!source.contains("PING_TIMEOUT"));
    assert!(!source.contains("ping_all_connections"));
    assert!(!source.contains("ping_single_connection"));
    assert!(!source.contains("handle_connection_failure"));
}
