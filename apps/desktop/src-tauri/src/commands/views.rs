use tauri::{AppHandle, Runtime};

use crate::models::TableColumn;


#[tauri::command]
pub async fn get_views<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<crate::models::ViewInfo>, String> {
    log::info!("Fetching views for connection: {}", connection_id);

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
        "Getting views from {} database: {}",
        resolved.saved.params.driver,
        params.database
    );

    let drv = resolved.driver;
    let result = drv.get_views(&params, schema.as_deref()).await;

    match &result {
        Ok(views) => log::info!("Retrieved {} views from {}", views.len(), params.database),
        Err(e) => log::error!("Failed to get views from {}: {}", params.database, e),
    }

    result
}

#[tauri::command]
pub async fn get_view_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching view definition for: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .get_view_definition(&params, &view_name, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully retrieved view definition for {}", view_name),
        Err(e) => log::error!("Failed to get view definition for {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn create_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    definition: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Creating view: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .create_view(&params, &view_name, &definition, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully created view: {}", view_name),
        Err(e) => log::error!("Failed to create view {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn alter_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    definition: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Altering view: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .alter_view(&params, &view_name, &definition, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully altered view: {}", view_name),
        Err(e) => log::error!("Failed to alter view {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn drop_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Dropping view: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv.drop_view(&params, &view_name, schema.as_deref()).await;

    match &result {
        Ok(_) => log::info!("Successfully dropped view: {}", view_name),
        Err(e) => log::error!("Failed to drop view {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn get_view_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TableColumn>, String> {
    log::info!(
        "Fetching view columns for: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .get_view_columns(&params, &view_name, schema.as_deref())
        .await;

    match &result {
        Ok(columns) => log::info!("Retrieved {} columns for view {}", columns.len(), view_name),
        Err(e) => log::error!("Failed to get view columns for {}: {}", view_name, e),
    }

    result
}

#[tauri::command]
pub async fn get_materialized_views<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<crate::models::ViewInfo>, String> {
    log::info!(
        "Fetching materialized views for connection: {}",
        connection_id
    );

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
    let result = drv.get_materialized_views(&params, schema.as_deref()).await;

    match &result {
        Ok(views) => log::info!(
            "Retrieved {} materialized views from {}",
            views.len(),
            params.database
        ),
        Err(e) => log::error!(
            "Failed to get materialized views from {}: {}",
            params.database,
            e
        ),
    }

    result
}

#[tauri::command]
pub async fn get_materialized_view_columns<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TableColumn>, String> {
    log::info!(
        "Fetching materialized view columns for: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .get_materialized_view_columns(&params, &view_name, schema.as_deref())
        .await;

    match &result {
        Ok(columns) => log::info!(
            "Retrieved {} columns for materialized view {}",
            columns.len(),
            view_name
        ),
        Err(e) => log::error!(
            "Failed to get materialized view columns for {}: {}",
            view_name,
            e
        ),
    }

    result
}

#[tauri::command]
pub async fn get_materialized_view_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching materialized view definition for: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .get_materialized_view_definition(&params, &view_name, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!(
            "Successfully retrieved materialized view definition for {}",
            view_name
        ),
        Err(e) => log::error!(
            "Failed to get materialized view definition for {}: {}",
            view_name,
            e
        ),
    }

    result
}

#[tauri::command]
pub async fn refresh_materialized_view<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    view_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Refreshing materialized view: {} on connection: {}",
        view_name,
        connection_id
    );

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
    let result = drv
        .refresh_materialized_view(&params, &view_name, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully refreshed materialized view: {}", view_name),
        Err(e) => log::error!("Failed to refresh materialized view {}: {}", view_name, e),
    }

    result
}
