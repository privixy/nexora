use tauri::{AppHandle, Runtime};

use crate::models::{
    ForeignKey, Index, TableColumn, TableInfo,
};


#[tauri::command]
pub async fn get_schemas<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: Option<String>,
) -> Result<Vec<String>, String> {
    log::info!("Fetching schemas for connection: {}", connection_id);

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: None,
            table: None,
        })
        .await?;
    crate::domains::catalog::CatalogService::get_schemas(resolved).await
}

#[tauri::command]
pub async fn get_available_databases<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<String>, String> {
    log::info!(
        "Fetching available databases for connection: {}",
        connection_id
    );

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: None,
            schema: None,
            table: None,
        })
        .await?;
    resolved.driver.get_databases(&resolved.params).await
}

#[tauri::command]
pub async fn create_database<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: String,
) -> Result<(), String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: None,
            schema: None,
            table: None,
        })
        .await?;
    crate::domains::catalog::CatalogService::create_database(resolved, &database).await
}

#[tauri::command]
pub async fn drop_database<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: String,
) -> Result<(), String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: None,
            schema: None,
            table: None,
        })
        .await?;
    resolved
        .driver
        .drop_database(&resolved.params, &database)
        .await
}

#[tauri::command]
pub async fn rename_database<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: String,
    new_name: String,
) -> Result<(), String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: None,
            schema: None,
            table: None,
        })
        .await?;
    resolved
        .driver
        .rename_database(&resolved.params, &database, &new_name)
        .await
}

#[tauri::command]
pub async fn create_schema<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    database: Option<String>,
    schema: String,
) -> Result<(), String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: Some(schema.as_str()),
            table: None,
        })
        .await?;
    resolved
        .driver
        .create_schema(&resolved.params, &schema)
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
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    crate::domains::catalog::CatalogService::truncate_table(resolved, &table, schema.as_deref())
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
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table.as_str()),
        })
        .await?;
    resolved
        .driver
        .drop_table(&resolved.params, &table, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_tables<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    log::info!("Fetching tables for connection: {}", connection_id);

    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;

    log::debug!(
        "Getting tables from {} database: {}",
        resolved.saved.params.driver,
        params.database
    );

    let drv = resolved.driver;
    let result = drv.get_tables(&params, schema.as_deref()).await;

    match &result {
        Ok(tables) => log::info!("Retrieved {} tables from {}", tables.len(), params.database),
        Err(e) => log::error!("Failed to get tables from {}: {}", params.database, e),
    }

    result
}

#[tauri::command]
pub async fn get_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TableColumn>, String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table_name.as_str()),
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    drv.get_columns(&params, &table_name, schema.as_deref())
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
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table_name.as_str()),
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    drv.get_foreign_keys(&params, &table_name, schema.as_deref())
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
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: Some(table_name.as_str()),
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    drv.get_indexes(&params, &table_name, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn get_schema_snapshot<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<crate::models::TableSchema>, String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: database.as_deref(),
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let drv = resolved.driver;
    drv.get_schema_snapshot(&params, schema.as_deref()).await
}

#[tauri::command]
pub async fn get_ai_schema_context<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
) -> Result<String, String> {
    let resolved = crate::infrastructure::connections::TauriConnectionContextResolver::new(app)
        .resolve(crate::domains::connections::DatabaseContext {
            connection_id: &connection_id,
            database: None,
            schema: schema.as_deref(),
            table: None,
        })
        .await?;
    let params = resolved.params;
    let driver = resolved.driver;
    let identifier_quote = driver.manifest().capabilities.identifier_quote.as_str();
    let context = driver
        .get_ai_schema_context(
            &params,
            schema.as_deref(),
            crate::ai_schema_context::DEFAULT_MAX_TABLES,
        )
        .await?;

    Ok(crate::ai_schema_context::format_for_prompt(
        &context,
        identifier_quote,
    ))
}
