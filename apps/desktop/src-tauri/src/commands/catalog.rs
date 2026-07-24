use tauri::{AppHandle, Runtime};

use crate::domains::catalog::CatalogService;
use crate::infrastructure::connections::TauriConnectionContextResolver;
use crate::models::{ForeignKey, Index, TableColumn, TableInfo};

#[tauri::command]
pub async fn get_schemas<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: Option<String>,
) -> Result<Vec<String>, String> {
    CatalogService::get_schemas(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_available_databases<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<String>, String> {
    CatalogService::get_available_databases(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
    )
    .await
}

#[tauri::command]
pub async fn create_database<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: String,
) -> Result<(), String> {
    CatalogService::create_database(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        &database,
    )
    .await
}

#[tauri::command]
pub async fn drop_database<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: String,
) -> Result<(), String> {
    CatalogService::drop_database(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        &database,
    )
    .await
}

#[tauri::command]
pub async fn rename_database<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: String,
    new_name: String,
) -> Result<(), String> {
    CatalogService::rename_database(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        &database,
        &new_name,
    )
    .await
}

#[tauri::command]
pub async fn create_schema<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: Option<String>,
    schema: String,
) -> Result<(), String> {
    CatalogService::create_schema(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        database.as_deref(),
        &schema,
    )
    .await
}

#[tauri::command]
pub async fn truncate_table<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: Option<String>,
    table: String,
    schema: Option<String>,
) -> Result<(), String> {
    CatalogService::truncate_table(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        database.as_deref(),
        &table,
        schema.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn drop_table<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: Option<String>,
    table: String,
    schema: Option<String>,
) -> Result<(), String> {
    CatalogService::drop_table(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        database.as_deref(),
        &table,
        schema.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_tables<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    CatalogService::get_tables(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TableColumn>, String> {
    CatalogService::get_columns(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        &table_name,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_foreign_keys<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<ForeignKey>, String> {
    CatalogService::get_foreign_keys(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        &table_name,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_indexes<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<Index>, String> {
    CatalogService::get_indexes(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        &table_name,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_schema_snapshot<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<crate::models::TableSchema>, String> {
    CatalogService::get_schema_snapshot(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        schema.as_deref(),
        database.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_ai_schema_context<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
) -> Result<String, String> {
    CatalogService::get_ai_schema_context(
        &TauriConnectionContextResolver::new(app),
        &connection_id,
        schema.as_deref(),
    )
    .await
}
