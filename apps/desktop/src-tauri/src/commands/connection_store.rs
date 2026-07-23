use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

use crate::credential_cache;
use crate::keychain_utils;
use crate::models::{
    ConnectionParams, SavedConnection,
};
use crate::persistence;

use super::shared::*;

#[tauri::command]
pub async fn get_connection_by_id<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<SavedConnection, String> {
    find_connection_by_id(&app, &id)
}

#[tauri::command]
pub async fn save_connection<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    params: ConnectionParams,
    detect_json_in_text_columns: Option<bool>,
) -> Result<SavedConnection, String> {
    log::info!("Saving new connection: {}", name);

    let path = get_config_path(&app)?;
    let mut conn_file = persistence::load_connections_file(&path).unwrap_or_default();

    let id = Uuid::new_v4().to_string();
    let mut params_to_save = params.clone();

    if params.save_in_keychain.unwrap_or(false) {
        log::debug!("Storing passwords in keychain for connection: {}", name);
        let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
        if let Some(pwd) = &params.password {
            keychain_utils::set_db_password(&id, pwd)?;
            credential_cache::set_db_password_cached(&cache, &id, pwd);
        }
        if params.ssh_enabled.unwrap_or(false) {
            if let Some(ssh_pwd) = &params.ssh_password {
                keychain_utils::set_ssh_password(&id, ssh_pwd)?;
                credential_cache::set_ssh_password_cached(&cache, &id, ssh_pwd);
            }
            if let Some(ssh_passphrase) = &params.ssh_key_passphrase {
                if !ssh_passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&id, ssh_passphrase)?;
                    credential_cache::set_ssh_key_passphrase_cached(&cache, &id, ssh_passphrase);
                }
            }
        }
        params_to_save.password = None;
        params_to_save.ssh_password = None;
        params_to_save.ssh_key_passphrase = None;
    }

    let new_conn = SavedConnection {
        id: id.clone(),
        name: name.clone(),
        params: params_to_save,
        group_id: None,
        sort_order: None,
        detect_json_in_text_columns,
        appearance: None,
    };
    conn_file.connections.push(new_conn.clone());
    save_connections_and_invalidate(&app, &path, &conn_file)?;

    log::info!("Connection saved successfully: {} (ID: {})", name, id);

    let mut returned_conn = new_conn;
    returned_conn.params = params; // Return with password for frontend state
    Ok(returned_conn)
}

#[tauri::command]
pub async fn delete_connection<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    log::info!("Deleting connection: {}", id);

    let path = get_config_path(&app)?;
    if !path.exists() {
        return Ok(());
    }

    let mut conn_file = persistence::load_connections_file(&path)?;

    // Capture the appearance before retain so we can cascade-delete the icon file.
    let appearance_to_delete = conn_file
        .connections
        .iter()
        .find(|c| c.id == id)
        .and_then(|c| c.appearance.clone());

    let initial_count = conn_file.connections.len();
    conn_file.connections.retain(|c| c.id != id);
    let deleted = conn_file.connections.len() < initial_count;

    // Attempt to remove passwords from keychain (ignore if not found)
    keychain_utils::delete_db_password(&id).ok();
    keychain_utils::delete_ssh_password(&id).ok();
    keychain_utils::delete_ssh_key_passphrase(&id).ok();
    // Invalidate the in-memory cache for this connection
    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    credential_cache::invalidate_all_for_connection(&cache, &id);

    save_connections_and_invalidate(&app, &path, &conn_file)?;

    // Cascade-delete the custom icon file if the connection used one.
    if let Ok(app_data) = app.path().app_data_dir() {
        let _ = crate::connection_appearance::cascade_delete_if_image(
            &app_data,
            appearance_to_delete.as_ref(),
        );
    }

    // Clean up query history for this connection
    if let Err(e) = crate::query_history::remove_history_for_connection(&app, &id).await {
        log::warn!(
            "Failed to remove query history for connection {}: {}",
            id,
            e
        );
    }

    if deleted {
        log::info!("Connection deleted successfully: {}", id);
    } else {
        log::warn!("Connection not found for deletion: {}", id);
    }

    Ok(())
}

#[tauri::command]
pub async fn update_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    name: String,
    params: ConnectionParams,
    detect_json_in_text_columns: Option<bool>,
) -> Result<SavedConnection, String> {
    let path = get_config_path(&app)?;
    let mut conn_file = persistence::load_connections_file(&path)?;

    let conn_idx = conn_file
        .connections
        .iter()
        .position(|c| c.id == id)
        .ok_or("Connection not found")?;

    let mut params_to_save = params.clone();

    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();
    if params.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &params.password {
            keychain_utils::set_db_password(&id, pwd)?;
            credential_cache::set_db_password_cached(&cache, &id, pwd);
        }
        if params.ssh_enabled.unwrap_or(false) {
            if let Some(ssh_pwd) = &params.ssh_password {
                keychain_utils::set_ssh_password(&id, ssh_pwd)?;
                credential_cache::set_ssh_password_cached(&cache, &id, ssh_pwd);
            }
            if let Some(ssh_passphrase) = &params.ssh_key_passphrase {
                if !ssh_passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&id, ssh_passphrase)?;
                    credential_cache::set_ssh_key_passphrase_cached(&cache, &id, ssh_passphrase);
                }
            }
        } else {
            keychain_utils::delete_ssh_password(&id).ok();
            keychain_utils::delete_ssh_key_passphrase(&id).ok();
            credential_cache::invalidate_ssh_password(&cache, &id);
            credential_cache::invalidate_ssh_key_passphrase(&cache, &id);
        }
        params_to_save.password = None;
        params_to_save.ssh_password = None;
        params_to_save.ssh_key_passphrase = None;
    } else {
        keychain_utils::delete_db_password(&id).ok();
        keychain_utils::delete_ssh_password(&id).ok();
        keychain_utils::delete_ssh_key_passphrase(&id).ok();
        credential_cache::invalidate_all_for_connection(&cache, &id);
    }

    // Preserve existing group_id and sort_order from the original connection
    let original_group_id = conn_file.connections[conn_idx].group_id.clone();
    let original_sort_order = conn_file.connections[conn_idx].sort_order;
    let original_db_selection = conn_file.connections[conn_idx].params.database.clone();
    // Preserve user's appearance customization across edits
    let original_appearance = conn_file.connections[conn_idx].appearance.clone();

    let updated = SavedConnection {
        id: id.clone(),
        name,
        params: params_to_save,
        group_id: original_group_id,
        sort_order: original_sort_order,
        detect_json_in_text_columns,
        appearance: original_appearance,
    };

    conn_file.connections[conn_idx] = updated.clone();

    save_connections_and_invalidate(&app, &path, &conn_file)?;

    // On single→multi transition, associate existing favorites/history (with no
    // database set) to the original single database name.
    if let Some(previous_db) =
        crate::models::single_db_before_multi_transition(&original_db_selection, &params.database)
    {
        if let Err(e) =
            crate::saved_queries::backfill_missing_database_for_connection(&app, &id, &previous_db)
        {
            log::warn!("Failed to backfill saved query database for {}: {}", id, e);
        }
        if let Err(e) =
            crate::query_history::backfill_missing_database_for_connection(&app, &id, &previous_db)
                .await
        {
            log::warn!(
                "Failed to backfill query history database for {}: {}",
                id,
                e
            );
        }
    }

    let mut returned_conn = updated;
    returned_conn.params = params;
    Ok(returned_conn)
}

#[tauri::command]
pub async fn set_connection_appearance<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    appearance: Option<crate::models::ConnectionAppearance>,
) -> Result<(), String> {
    let path = get_config_path(&app)?;
    let mut conn_file = persistence::load_connections_file(&path)?;
    set_appearance_impl(&mut conn_file, &id, appearance)?;
    save_connections_and_invalidate(&app, &path, &conn_file)?;
    Ok(())
}

#[tauri::command]
pub async fn duplicate_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<SavedConnection, String> {
    let path = get_config_path(&app)?;
    let mut conn_file = persistence::load_connections_file(&path)?;

    let original_idx = conn_file
        .connections
        .iter()
        .position(|c| c.id == id)
        .ok_or("Connection not found")?;
    let mut original = conn_file.connections[original_idx].clone();

    let cache = app.state::<std::sync::Arc<crate::credential_cache::CredentialCache>>();

    // Recover passwords if in keychain (via cache for fast repeat access)
    if original.params.save_in_keychain.unwrap_or(false) {
        if let Ok(pwd) = credential_cache::get_db_password_cached(&cache, &original.id) {
            original.params.password = Some(pwd);
        }
        if original.params.ssh_enabled.unwrap_or(false) {
            if let Ok(ssh_pwd) = credential_cache::get_ssh_password_cached(&cache, &original.id) {
                if !ssh_pwd.trim().is_empty() {
                    original.params.ssh_password = Some(ssh_pwd);
                }
            }
            if let Ok(ssh_passphrase) =
                credential_cache::get_ssh_key_passphrase_cached(&cache, &original.id)
            {
                if !ssh_passphrase.trim().is_empty() {
                    original.params.ssh_key_passphrase = Some(ssh_passphrase);
                }
            }
        }
    }

    let new_id = Uuid::new_v4().to_string();
    let mut new_params = original.params.clone();

    // Save passwords to new keychain entries if enabled
    if new_params.save_in_keychain.unwrap_or(false) {
        if let Some(pwd) = &new_params.password {
            keychain_utils::set_db_password(&new_id, pwd)?;
            credential_cache::set_db_password_cached(&cache, &new_id, pwd);
        }
        if new_params.ssh_enabled.unwrap_or(false) {
            if let Some(ssh_pwd) = &new_params.ssh_password {
                keychain_utils::set_ssh_password(&new_id, ssh_pwd)?;
                credential_cache::set_ssh_password_cached(&cache, &new_id, ssh_pwd);
            }
            if let Some(ssh_passphrase) = &new_params.ssh_key_passphrase {
                if !ssh_passphrase.trim().is_empty() {
                    keychain_utils::set_ssh_key_passphrase(&new_id, ssh_passphrase)?;
                    credential_cache::set_ssh_key_passphrase_cached(
                        &cache,
                        &new_id,
                        ssh_passphrase,
                    );
                }
            }
        }
        new_params.password = None;
        new_params.ssh_password = None;
        new_params.ssh_key_passphrase = None;
    }

    // Copy the icon file so the duplicate owns its own copy.
    // If the original has an Image icon, the duplicate must not share the same file path —
    // deleting either connection would otherwise cascade-delete the shared file and break
    // the other connection's icon. We copy the file; on failure we drop the icon rather
    // than sharing the path.
    let new_appearance = {
        let mut app_earance = original.appearance.clone();
        if let Some(ref mut a) = app_earance {
            if let Some(crate::models::IconOverride::Image { ref path }) = a.icon.clone() {
                if let Ok(app_data) = app.path().app_data_dir() {
                    match crate::connection_appearance::copy_icon_for_duplicate(
                        &app_data, path, &new_id,
                    ) {
                        Ok(new_path) => {
                            a.icon = Some(crate::models::IconOverride::Image { path: new_path });
                        }
                        Err(_) => {
                            // Couldn't copy — drop the icon to avoid sharing
                            a.icon = None;
                            if a.accent_color.is_none() {
                                app_earance = None;
                            }
                        }
                    }
                } else {
                    // Can't determine app_data_dir — drop icon to avoid sharing
                    a.icon = None;
                    if a.accent_color.is_none() {
                        app_earance = None;
                    }
                }
            }
        }
        app_earance
    };

    let new_conn = SavedConnection {
        id: new_id,
        name: format!("{} (Copy)", original.name),
        params: new_params,
        group_id: original.group_id.clone(), // Copy to same group as original
        sort_order: None,                    // Will be placed at end of group
        detect_json_in_text_columns: original.detect_json_in_text_columns,
        appearance: new_appearance,
    };

    conn_file.connections.push(new_conn.clone());

    save_connections_and_invalidate(&app, &path, &conn_file)?;

    let mut returned_conn = new_conn;
    // Return with passwords for frontend consistency
    if returned_conn.params.save_in_keychain.unwrap_or(false) {
        // We can just use the values from `original.params` as they are identical (unless we cleared them in new_params)
        // Actually original.params holds the clear text now.
        returned_conn.params.password = original.params.password;
        returned_conn.params.ssh_password = original.params.ssh_password;
        returned_conn.params.ssh_key_passphrase = original.params.ssh_key_passphrase;
    }

    Ok(returned_conn)
}

#[tauri::command]
pub async fn get_connections<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<SavedConnection>, String> {
    // Run migration if needed
    migrate_ssh_connections(&app).await.ok();

    let path = get_config_path(&app)?;
    // Use persistence function that handles both old and new formats
    persistence::load_connections(&path)
}
