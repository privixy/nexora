

use crate::infrastructure::connections::workflows::*;

#[tauri::command]
pub async fn get_data_types(driver: String) -> Result<crate::models::DataTypeRegistry, String> {
    log::debug!("Fetching data types for driver: {}", driver);

    let drv = driver_for(&driver).await?;
    let types = drv.get_data_types();

    Ok(crate::models::DataTypeRegistry { driver, types })
}

#[tauri::command]
pub async fn map_inferred_column_types(
    driver: String,
    kinds: Vec<String>,
) -> Result<Vec<String>, String> {
    let drv = driver_for(&driver).await?;
    Ok(kinds.iter().map(|k| drv.map_inferred_type(k)).collect())
}

#[tauri::command]
pub async fn get_registered_drivers() -> Vec<crate::drivers::driver_trait::PluginManifest> {
    crate::drivers::registry::list_drivers().await
}

#[tauri::command]
pub async fn get_driver_manifest(
    driver_id: String,
) -> Option<crate::drivers::driver_trait::PluginManifest> {
    crate::drivers::registry::get_driver(&driver_id)
        .await
        .map(|d| d.manifest().clone())
}
