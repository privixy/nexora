use crate::drivers::driver_trait::PluginManifest;
use crate::plugins::installer::InstalledPluginInfo;
use crate::plugins::registry::RegistryPluginWithStatus;
use tauri::AppHandle;

#[tauri::command]
pub async fn fetch_plugin_registry(
    app: AppHandle,
) -> Result<Vec<RegistryPluginWithStatus>, String> {
    crate::plugins::service::fetch_plugin_registry(app).await
}

#[tauri::command]
pub async fn install_plugin(
    app: AppHandle,
    plugin_id: String,
    version: Option<String>,
) -> Result<(), String> {
    crate::plugins::service::install_plugin(app, plugin_id, version).await
}

#[tauri::command]
pub async fn uninstall_plugin(plugin_id: String) -> Result<(), String> {
    crate::plugins::service::uninstall_plugin(plugin_id).await
}

#[tauri::command]
pub async fn get_installed_plugins() -> Result<Vec<InstalledPluginInfo>, String> {
    crate::plugins::service::get_installed_plugins().await
}

#[tauri::command]
pub async fn disable_plugin(plugin_id: String) -> Result<(), String> {
    crate::plugins::service::disable_plugin(plugin_id).await
}

#[tauri::command]
pub async fn enable_plugin(app: AppHandle, plugin_id: String) -> Result<(), String> {
    crate::plugins::service::enable_plugin(app, plugin_id).await
}

#[tauri::command]
pub async fn get_plugin_manifest(plugin_id: String) -> Result<PluginManifest, String> {
    crate::plugins::service::get_plugin_manifest(plugin_id).await
}

#[tauri::command]
pub fn get_plugin_dir(plugin_id: String) -> Result<String, String> {
    crate::plugins::service::get_plugin_dir(plugin_id)
}

#[tauri::command]
pub fn read_plugin_file(plugin_id: String, file_path: String) -> Result<String, String> {
    crate::plugins::service::read_plugin_file(plugin_id, file_path)
}
