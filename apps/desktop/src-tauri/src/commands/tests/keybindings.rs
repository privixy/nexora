#[test]
fn keybinding_commands_are_thin_storage_adapters() {
    let source = include_str!("../keybindings.rs");
    assert!(source.contains("app.path().app_config_dir()"));
    assert!(source.contains("crate::infrastructure::keybindings::load_keybindings(&config_dir)"));
    assert!(source.contains(
        "crate::infrastructure::keybindings::save_keybindings(&config_dir, &keybindings)"
    ));
    assert!(!source.contains("std::fs"));
    assert!(!source.contains("fs::"));
}
