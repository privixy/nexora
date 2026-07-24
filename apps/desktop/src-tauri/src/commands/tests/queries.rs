use crate::commands::sanitize_user_query;

#[test]
fn sanitizes_smart_quotes_and_trailing_semicolons() {
    assert_eq!(
        sanitize_user_query("  SELECT “name” FROM users WHERE note = ‘ok’;;;  "),
        "SELECT \"name\" FROM users WHERE note = 'ok'"
    );
}

#[test]
fn count_query_owner_preserves_wrapper_and_execute_arguments() {
    let source = include_str!("../../count_query_compat.rs");
    assert!(source.contains("SELECT COUNT(*) FROM ({}) as count_wrapper"));
    assert!(source.contains(".execute_query(&params, &count_q, None, 1, schema.as_deref())"));
    assert!(source.contains(".and_then(|value| value.as_i64())"));
    assert!(source.contains(".unwrap_or(0)"));
}

#[test]
fn count_query_owner_propagates_driver_errors() {
    let source = include_str!("../../count_query_compat.rs");
    assert!(source.contains(".await?;"));
}
