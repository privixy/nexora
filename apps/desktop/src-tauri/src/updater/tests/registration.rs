use tauri::test::mock_builder;
use tauri_plugin_updater::UpdaterExt;

#[test]
fn app_registers_updater_plugin_so_download_command_can_build_updater() {
    let app = mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(tauri::generate_context!())
        .expect("failed to build test app");

    assert!(app.handle().updater().is_ok());
}
