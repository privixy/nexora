use serde_json::json;
use tauri_plugin_updater::UpdaterExt;

#[test]
fn updater_state_is_managed_when_plugin_is_registered() {
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        json!({
            "pubkey": "test-key",
            "endpoints": ["https://example.com/latest.json"]
        }),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap_or_else(|error| panic!("failed to build test app: {error:?}"));

    let _ = app.handle().updater_builder();
}
