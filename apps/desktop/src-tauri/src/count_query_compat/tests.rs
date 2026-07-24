#[test]
fn target_owner_exposes_frozen_run_workflow() {
    let source = include_str!("../count_query_compat.rs");
    assert!(source.contains("pub(crate) async fn run"));
    assert!(source.contains("SELECT COUNT(*) FROM ({}) as count_wrapper"));
    assert!(source.contains("execute_query(&params, &count_q, None, 1, schema.as_deref())"));
}
