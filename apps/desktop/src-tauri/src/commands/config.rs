use tauri::{AppHandle, Manager};

use crate::infrastructure::config::{self, AiKeyStatus, AppConfig};

#[tauri::command]
pub fn get_config(app: AppHandle) -> AppConfig {
    config::get_config_impl(app)
}

#[tauri::command]
pub fn save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    config::save_config_impl(app, config)
}

#[tauri::command]
pub fn get_schema_preference(app: AppHandle, connection_id: String) -> Option<String> {
    config::get_schema_preference_impl(app, connection_id)
}

#[tauri::command]
pub fn set_schema_preference(
    app: AppHandle,
    connection_id: String,
    schema: String,
) -> Result<(), String> {
    config::set_schema_preference_impl(app, connection_id, schema)
}

#[tauri::command]
pub fn get_last_active_connection(app: AppHandle) -> Option<String> {
    config::get_last_active_connection_impl(app)
}

#[tauri::command]
pub fn set_last_active_connection(
    app: AppHandle,
    connection_id: Option<String>,
) -> Result<(), String> {
    config::set_last_active_connection_impl(app, connection_id)
}

#[tauri::command]
pub fn get_last_open_connections(app: AppHandle) -> Vec<String> {
    config::get_last_open_connections_impl(app)
}

#[tauri::command]
pub fn set_last_open_connections(
    app: AppHandle,
    connection_ids: Vec<String>,
) -> Result<(), String> {
    config::set_last_open_connections_impl(app, connection_ids)
}

#[tauri::command]
pub fn get_selected_schemas(app: AppHandle, connection_id: String) -> Vec<String> {
    config::get_selected_schemas_impl(app, connection_id)
}

#[tauri::command]
pub fn set_selected_schemas(
    app: AppHandle,
    connection_id: String,
    schemas: Vec<String>,
) -> Result<(), String> {
    config::set_selected_schemas_impl(app, connection_id, schemas)
}

#[tauri::command]
pub fn set_ai_key(app: AppHandle, provider: String, key: String) -> Result<(), String> {
    crate::keychain_utils::set_ai_key(&provider, &key)?;
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    crate::credential_cache::set_ai_key_cached(&cache, &provider, &key);
    Ok(())
}

#[tauri::command]
pub fn delete_ai_key(app: AppHandle, provider: String) -> Result<(), String> {
    crate::keychain_utils::delete_ai_key(&provider)?;
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    crate::credential_cache::invalidate_ai_key(&cache, &provider);
    Ok(())
}

#[tauri::command]
pub fn check_ai_key(app: AppHandle, provider: String) -> bool {
    config::get_ai_api_key(&app, &provider).is_ok()
}

#[tauri::command]
pub fn check_ai_key_status(app: AppHandle, provider: String) -> AiKeyStatus {
    config::get_ai_api_key_status(&app, &provider)
}

#[tauri::command]
pub fn get_system_prompt(app: AppHandle) -> String {
    config::get_system_prompt_impl(app)
}

#[tauri::command]
pub fn save_system_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    config::save_system_prompt_impl(app, prompt)
}

#[tauri::command]
pub fn reset_system_prompt(app: AppHandle) -> Result<String, String> {
    config::reset_system_prompt_impl(app)
}

#[tauri::command]
pub fn get_explain_prompt(app: AppHandle) -> String {
    config::get_explain_prompt_impl(app)
}

#[tauri::command]
pub fn save_explain_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    config::save_explain_prompt_impl(app, prompt)
}

#[tauri::command]
pub fn reset_explain_prompt(app: AppHandle) -> Result<String, String> {
    config::reset_explain_prompt_impl(app)
}

#[tauri::command]
pub fn get_explainplan_prompt(app: AppHandle) -> String {
    config::get_explainplan_prompt_impl(app)
}

#[tauri::command]
pub fn save_explainplan_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    config::save_explainplan_prompt_impl(app, prompt)
}

#[tauri::command]
pub fn reset_explainplan_prompt(app: AppHandle) -> Result<String, String> {
    config::reset_explainplan_prompt_impl(app)
}

#[tauri::command]
pub fn get_cellname_prompt(app: AppHandle) -> String {
    config::get_cellname_prompt_impl(app)
}

#[tauri::command]
pub fn save_cellname_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    config::save_cellname_prompt_impl(app, prompt)
}

#[tauri::command]
pub fn reset_cellname_prompt(app: AppHandle) -> Result<String, String> {
    config::reset_cellname_prompt_impl(app)
}

#[tauri::command]
pub fn get_tabrename_prompt(app: AppHandle) -> String {
    config::get_tabrename_prompt_impl(app)
}

#[tauri::command]
pub fn save_tabrename_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    config::save_tabrename_prompt_impl(app, prompt)
}

#[tauri::command]
pub fn reset_tabrename_prompt(app: AppHandle) -> Result<String, String> {
    config::reset_tabrename_prompt_impl(app)
}

#[tauri::command]
pub fn get_config_json(app: AppHandle) -> Result<String, String> {
    config::get_config_json_impl(app)
}

#[tauri::command]
pub fn relaunch_app(app: AppHandle) {
    app.restart();
}

#[tauri::command]
pub fn save_config_json(app: AppHandle, json: String) -> Result<(), String> {
    config::save_config_json_impl(app, json)
}
