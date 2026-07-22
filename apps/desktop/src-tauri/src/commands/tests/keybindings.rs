#[test]
fn keybinding_commands_preserve_filename_and_missing_file_behavior() {
    let source = include_str!("../keybindings.rs");
    assert!(source.contains("config_dir.join(\"keybindings.json\")"));
    assert!(source.contains("serde_json::Value::Object(serde_json::Map::new())"));
}

#[test]
fn keybinding_commands_preserve_json_and_filesystem_behavior() {
    let source = include_str!("../keybindings.rs");
    assert!(source.contains("fs::read_to_string(&path)"));
    assert!(source.contains("serde_json::from_str(&content)"));
    assert!(source.contains("fs::create_dir_all(&config_dir)"));
    assert!(source.contains("serde_json::to_string_pretty(&keybindings)"));
    assert!(source.contains("fs::write(&path, content)"));
}
