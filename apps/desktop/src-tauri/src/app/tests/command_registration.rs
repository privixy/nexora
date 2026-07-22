#[test]
fn command_registration_stage_is_present() {
    let source = include_str!("../commands.rs");
    assert!(source.contains("fn register_commands"));
    assert!(source.contains("tauri::generate_handler!["));
}
