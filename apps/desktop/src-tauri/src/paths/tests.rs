use super::*;

#[test]
fn resolve_connections_path_defaults_to_connections_json() {
    let dir = std::env::temp_dir().join("nexora-paths-test-empty");
    let _ = std::fs::create_dir_all(&dir);
    assert_eq!(resolve_connections_path(&dir), dir.join("connections.json"));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn resolve_connections_path_prefers_dev_file_in_debug_builds() {
    let dir = std::env::temp_dir().join("nexora-paths-test-dev");
    let _ = std::fs::create_dir_all(&dir);
    std::fs::write(dir.join("connections.dev.json"), "{}").unwrap();

    let resolved = resolve_connections_path(&dir);
    if cfg!(debug_assertions) {
        assert_eq!(resolved, dir.join("connections.dev.json"));
    } else {
        assert_eq!(resolved, dir.join("connections.json"));
    }
    let _ = std::fs::remove_dir_all(&dir);
}
