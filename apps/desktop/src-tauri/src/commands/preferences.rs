use crate::infrastructure::preferences::EditorPreferences;

#[tauri::command]
pub async fn save_editor_preferences(
    connection_id: String,
    preferences: EditorPreferences,
) -> Result<(), String> {
    crate::infrastructure::preferences::save_editor_preferences(connection_id, preferences).await
}

#[tauri::command]
pub async fn load_editor_preferences(
    connection_id: String,
) -> Result<Option<EditorPreferences>, String> {
    crate::infrastructure::preferences::load_editor_preferences(connection_id).await
}

#[tauri::command]
pub async fn delete_editor_preferences(connection_id: String) -> Result<(), String> {
    crate::infrastructure::preferences::delete_editor_preferences(connection_id).await
}

#[tauri::command]
pub async fn list_all_preferences(
) -> Result<std::collections::HashMap<String, EditorPreferences>, String> {
    crate::infrastructure::preferences::list_all_preferences().await
}
