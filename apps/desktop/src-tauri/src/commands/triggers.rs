use tauri::{AppHandle, Runtime};

use crate::models::TriggerInfo;

#[tauri::command]
pub async fn get_triggers<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<Vec<TriggerInfo>, String> {
    log::info!("Fetching triggers for connection: {}", connection_id);

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
    let result = drv.get_triggers(&params, schema.as_deref()).await;

    match &result {
        Ok(triggers) => log::info!("Retrieved {} triggers", triggers.len()),
        Err(e) => log::error!("Failed to get triggers: {}", e),
    }

    result
}

#[tauri::command]
pub async fn get_trigger_definition<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    trigger_name: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<String, String> {
    log::info!(
        "Fetching trigger definition for: {} on connection: {}",
        trigger_name,
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
    drv.get_trigger_definition(&params, &trigger_name, &table_name, schema.as_deref())
        .await
}

#[tauri::command]
pub async fn create_trigger<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    trigger_sql: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!("Creating trigger on connection: {}", connection_id);

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
        .create_trigger(&params, &trigger_sql, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully created trigger"),
        Err(e) => log::error!("Failed to create trigger: {}", e),
    }

    result
}

#[tauri::command]
pub async fn drop_trigger<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    trigger_name: String,
    table_name: String,
    schema: Option<String>,
    database: Option<String>,
) -> Result<(), String> {
    log::info!(
        "Dropping trigger: {} on connection: {}",
        trigger_name,
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
        .drop_trigger(&params, &trigger_name, &table_name, schema.as_deref())
        .await;

    match &result {
        Ok(_) => log::info!("Successfully dropped trigger: {}", trigger_name),
        Err(e) => log::error!("Failed to drop trigger {}: {}", trigger_name, e),
    }

    result
}
