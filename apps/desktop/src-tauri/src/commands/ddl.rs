use tauri::{AppHandle, Runtime};

use crate::models::ColumnDefinition;

use crate::infrastructure::connections::workflows::*;

#[tauri::command]
pub async fn get_create_table_sql<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    columns: Vec<ColumnDefinition>,
    schema: Option<String>,
) -> Result<Vec<String>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_create_table_sql(&table_name, columns, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_add_column_sql<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    column: ColumnDefinition,
    schema: Option<String>,
) -> Result<Vec<String>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_add_column_sql(&table, column, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_alter_column_sql<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    old_column: ColumnDefinition,
    new_column: ColumnDefinition,
    schema: Option<String>,
) -> Result<Vec<String>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_alter_column_sql(&table, old_column, new_column, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_create_index_sql<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    index_name: String,
    columns: Vec<String>,
    is_unique: bool,
    schema: Option<String>,
) -> Result<Vec<String>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_create_index_sql(&table, &index_name, columns, is_unique, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_create_foreign_key_sql<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    fk_name: String,
    column: String,
    ref_table: String,
    ref_column: String,
    on_delete: Option<String>,
    on_update: Option<String>,
    schema: Option<String>,
) -> Result<Vec<String>, String> {
    let saved_conn = find_connection_by_id(&app, &connection_id)?;
    let drv = driver_for(&saved_conn.params.driver).await?;
    drv.get_create_foreign_key_sql(
        &table,
        &fk_name,
        &column,
        &ref_table,
        &ref_column,
        on_delete.as_deref(),
        on_update.as_deref(),
        schema.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn drop_index_action<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    index_name: String,
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
    drv.drop_index(&params, &table, &index_name, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn drop_foreign_key_action<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table: String,
    fk_name: String,
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
    drv.drop_foreign_key(&params, &table, &fk_name, schema.as_deref())
        .await
}
