use super::super::router::*;

#[test]
fn audit_defaults_to_success() {
    let audit = CallAudit::for_tool("list_connections");
    assert_eq!(audit.tool, "list_connections");
    assert_eq!(audit.status, "success");
    assert!(audit.error.is_none());
}
