#[test]
fn target_query_services_are_available() {
    use super::{blob_wire_to_data_url, build_er_window, sanitize_user_query};

    assert_eq!(sanitize_user_query(" SELECT “x”;;; "), "SELECT \"x\"");
    assert_eq!(
        blob_wire_to_data_url("BLOB:3:image/png:YWJj").unwrap(),
        "data:image/png;base64,YWJj"
    );
    let window = build_er_window("id", "name", "db", Some("table"), Some("public"));
    assert!(window.url.contains("focusTable=table"));
    assert!(window.url.contains("schema=public"));
}
