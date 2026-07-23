use crate::infrastructure::notebooks::NotebookMetadata;

#[tauri::command]
pub async fn create_notebook(
    connection_id: String,
    notebook_id: String,
    content: String,
) -> Result<(), String> {
    crate::infrastructure::notebooks::create_notebook(connection_id, notebook_id, content).await
}

#[tauri::command]
pub async fn save_notebook(
    connection_id: String,
    notebook_id: String,
    content: String,
) -> Result<(), String> {
    crate::infrastructure::notebooks::save_notebook(connection_id, notebook_id, content).await
}

#[tauri::command]
pub async fn load_notebook(
    connection_id: String,
    notebook_id: String,
) -> Result<Option<String>, String> {
    crate::infrastructure::notebooks::load_notebook(connection_id, notebook_id).await
}

#[tauri::command]
pub async fn delete_notebook(connection_id: String, notebook_id: String) -> Result<(), String> {
    crate::infrastructure::notebooks::delete_notebook(connection_id, notebook_id).await
}

#[tauri::command]
pub async fn rename_notebook(
    connection_id: String,
    notebook_id: String,
    title: String,
) -> Result<(), String> {
    crate::infrastructure::notebooks::rename_notebook(connection_id, notebook_id, title).await
}

#[tauri::command]
pub async fn list_notebooks(connection_id: String) -> Result<Vec<NotebookMetadata>, String> {
    crate::infrastructure::notebooks::list_notebooks(connection_id).await
}
