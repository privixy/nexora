#[test]
fn target_mcp_modules_exist() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/mcp");
    for file in [
        "audit.rs",
        "connections.rs",
        "resources.rs",
        "router.rs",
        "server.rs",
        "tools/mod.rs",
        "tools/list.rs",
        "tools/describe.rs",
        "tools/query.rs",
    ] {
        assert!(root.join(file).exists(), "missing {file}");
    }
    assert!(!root.join("tests.rs").exists());
}
