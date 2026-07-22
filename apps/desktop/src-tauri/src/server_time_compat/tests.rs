#[test]
fn target_owner_exposes_frozen_run_workflow() {
    let source = include_str!("../server_time_compat.rs");
    assert!(source.contains("pub(crate) async fn run"));
    assert!(source.contains("\"sqlite\" => \"SELECT datetime('now', 'localtime')\""));
    assert!(source.contains("execute_query(&params, query, Some(1), 1, None)"));
    assert!(source.contains("No timestamp returned from server"));
}
