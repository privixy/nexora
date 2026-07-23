use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn save_blob_to_file<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    col_name: String,
    pk_map: std::collections::HashMap<String, serde_json::Value>,
    file_path: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    drv.save_blob_to_file(
        &params,
        &table,
        &col_name,
        &pk_map,
        schema.as_deref(),
        &file_path,
    )
    .await
}

#[tauri::command]
pub async fn fetch_blob_as_data_url<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    col_name: String,
    pk_map: std::collections::HashMap<String, serde_json::Value>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    let wire = drv
        .fetch_blob_as_data_url(&params, &table, &col_name, &pk_map, schema.as_deref())
        .await?;
    crate::domains::queries::blob_wire_to_data_url(&wire)
}

#[tauri::command]
pub fn detect_blob_mime(base64_data: String) -> Result<String, String> {
    crate::domains::queries::BlobService::detect_blob_mime(&base64_data)
}

#[tauri::command]
pub async fn load_blob_from_file<R: Runtime>(
    app: AppHandle<R>,
    file_path: String,
) -> Result<String, String> {
    crate::domains::queries::BlobService::load_from_file(
        file_path.into(),
        crate::config::get_max_blob_size(&app),
    )
    .await
}

#[tauri::command]
pub fn detect_mime_type(header_base64: String) -> Result<String, String> {
    crate::domains::queries::BlobService::detect_mime_type(&header_base64)
}

#[tauri::command]
pub fn get_file_stats(file_path: String) -> Result<serde_json::Value, String> {
    crate::domains::queries::BlobService::get_file_stats(std::path::Path::new(&file_path))
}

#[tauri::command]
pub async fn read_file_as_data_url(file_path: String) -> Result<String, String> {
    crate::domains::queries::BlobService::read_file_as_data_url(file_path.into()).await
}
