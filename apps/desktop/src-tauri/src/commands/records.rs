use tauri::{AppHandle, Runtime};


use crate::domains::connections::DatabaseContext;
use crate::infrastructure::connections::TauriConnectionContextResolver;

#[tauri::command]
pub async fn delete_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    pk_map: std::collections::HashMap<String, serde_json::Value>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    log::info!(
        "Executing query on connection: {} | Query: DELETE FROM {} WHERE pk_map={:?}",
        connection_id,
        table,
        pk_map
    );
    let resolved = TauriConnectionContextResolver::new(app)
        .resolve(DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    resolved
        .driver
        .delete_record(&resolved.params, &table, &pk_map, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn update_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    pk_map: std::collections::HashMap<String, serde_json::Value>,
    col_name: String,
    new_val: serde_json::Value,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    log::info!(
        "Executing query on connection: {} | Query: UPDATE {} SET {} = {:?} WHERE pk_map={:?}",
        connection_id,
        table,
        col_name,
        new_val,
        pk_map
    );
    let max_blob_size = crate::config::get_max_blob_size(&app);
    let resolved = TauriConnectionContextResolver::new(app)
        .resolve(DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    resolved
        .driver
        .update_record(
            &resolved.params,
            &table,
            &pk_map,
            &col_name,
            new_val,
            schema.as_deref(),
            max_blob_size,
        )
        .await
}

#[tauri::command]
pub async fn insert_record<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    data: std::collections::HashMap<String, serde_json::Value>,
    schema: Option<String>,
    database: Option<String>,
) -> Result<u64, String> {
    let columns: Vec<&str> = data.keys().map(|k| k.as_str()).collect();
    log::info!(
        "Executing query on connection: {} | Query: INSERT INTO {} ({}) VALUES (...)",
        connection_id,
        table,
        columns.join(", ")
    );
    let max_blob_size = crate::config::get_max_blob_size(&app);
    let resolved = TauriConnectionContextResolver::new(app)
        .resolve(DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    resolved
        .driver
        .insert_record(
            &resolved.params,
            &table,
            data,
            schema.as_deref(),
            max_blob_size,
        )
        .await
}
