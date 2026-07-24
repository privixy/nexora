use crate::plugins::manager::PluginLoadError;

#[tauri::command]
pub fn get_plugin_startup_errors() -> Vec<PluginLoadError> {
    crate::plugins::manager::get_plugin_startup_errors()
}
