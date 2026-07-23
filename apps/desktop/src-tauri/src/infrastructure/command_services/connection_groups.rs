use tauri::{AppHandle, Runtime};
use uuid::Uuid;

use crate::models::{
    ConnectionGroup, ConnectionsFile, SavedConnection,
};
use crate::persistence;

use crate::infrastructure::connections::workflows::*;

#[tauri::command]
pub async fn get_connection_groups<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<ConnectionGroup>, String> {
    let path = get_config_path(&app)?;
    persistence::load_groups(&path)
}

#[tauri::command]
pub async fn get_connections_with_groups<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ConnectionsFile, String> {
    // Run migration if needed
    migrate_ssh_connections(&app).await.ok();

    let path = get_config_path(&app)?;
    persistence::load_connections_file(&path)
}

#[tauri::command]
pub async fn create_connection_group<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    parent_id: Option<String>,
) -> Result<ConnectionGroup, String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path).unwrap_or_default();

    if let Some(pid) = &parent_id {
        if !file.groups.iter().any(|g| &g.id == pid) {
            return Err(format!("Parent group with ID {} not found", pid));
        }
    }

    let max_order = file
        .groups
        .iter()
        .filter(|g| g.parent_id == parent_id)
        .map(|g| g.sort_order)
        .max()
        .unwrap_or(-1);

    let group = ConnectionGroup {
        id: Uuid::new_v4().to_string(),
        name,
        collapsed: false,
        sort_order: max_order + 1,
        parent_id,
    };

    file.groups.push(group.clone());
    save_connections_and_invalidate(&app, &path, &file)?;

    Ok(group)
}

#[tauri::command]
pub async fn create_group_path<R: Runtime>(
    app: AppHandle<R>,
    path: String,
    parent_id: Option<String>,
) -> Result<ConnectionGroup, String> {
    let path_cfg = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path_cfg).unwrap_or_default();

    if let Some(pid) = &parent_id {
        if !file.groups.iter().any(|g| &g.id == pid) {
            return Err(format!("Parent group with ID {} not found", pid));
        }
    }

    let segments = parse_group_path(&path)?;
    let mut current_parent = parent_id;
    let mut last_created: Option<ConnectionGroup> = None;

    for seg in segments {
        if let Some(g) = find_child_group(&file.groups, &seg, &current_parent).cloned() {
            current_parent = Some(g.id.clone());
            last_created = Some(g);
            continue;
        }
        let max_order = file
            .groups
            .iter()
            .filter(|g| g.parent_id == current_parent)
            .map(|g| g.sort_order)
            .max()
            .unwrap_or(-1);
        let new_group = ConnectionGroup {
            id: Uuid::new_v4().to_string(),
            name: seg,
            collapsed: false,
            sort_order: max_order + 1,
            parent_id: current_parent.clone(),
        };
        current_parent = Some(new_group.id.clone());
        last_created = Some(new_group.clone());
        file.groups.push(new_group);
    }

    save_connections_and_invalidate(&app, &path_cfg, &file)?;

    last_created.ok_or_else(|| "Group path resolved to an empty hierarchy".to_string())
}

#[tauri::command]
pub async fn update_connection_group<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    name: Option<String>,
    collapsed: Option<bool>,
    sort_order: Option<i32>,
) -> Result<ConnectionGroup, String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path)?;

    let group = file
        .groups
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or_else(|| format!("Group with ID {} not found", id))?;

    if let Some(n) = name {
        group.name = n;
    }
    if let Some(c) = collapsed {
        group.collapsed = c;
    }
    if let Some(o) = sort_order {
        group.sort_order = o;
    }

    let updated = group.clone();
    save_connections_and_invalidate(&app, &path, &file)?;

    Ok(updated)
}

#[tauri::command]
pub async fn move_group_to_parent<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    parent_id: Option<String>,
) -> Result<ConnectionGroup, String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path)?;

    if !file.groups.iter().any(|g| g.id == id) {
        return Err(format!("Group with ID {} not found", id));
    }

    if let Some(pid) = &parent_id {
        if pid == &id {
            return Err("A group cannot be its own parent".to_string());
        }
        if !file.groups.iter().any(|g| &g.id == pid) {
            return Err(format!("Parent group with ID {} not found", pid));
        }
    }

    reject_if_would_create_cycle(&file.groups, &id, parent_id.as_deref())?;

    let group = file
        .groups
        .iter_mut()
        .find(|g| g.id == id)
        .expect("group existence checked above");
    group.parent_id = parent_id;
    let updated = group.clone();

    save_connections_and_invalidate(&app, &path, &file)?;
    Ok(updated)
}

#[tauri::command]
pub async fn delete_connection_group<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path)?;

    // Ensure the group exists before we walk the tree.
    if !file.groups.iter().any(|g| g.id == id) {
        return Err(format!("Group with ID {} not found", id));
    }

    // Cascade delete: collect the target group and all of its descendants
    // (transitively) so the entire subtree is removed. The caller only
    // needs to specify the top-level group — every nested child group is
    // deleted along with it. Connections belonging to any group in the
    // subtree are removed as well.
    let to_delete = crate::models::collect_group_subtree(&file.groups, &id);

    file.groups.retain(|g| !to_delete.contains(&g.id));
    file.connections.retain(|c| {
        !c.group_id
            .as_ref()
            .is_some_and(|gid| to_delete.contains(gid))
    });

    save_connections_and_invalidate(&app, &path, &file)?;

    Ok(())
}

#[tauri::command]
pub async fn move_connection_to_group<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    group_id: Option<String>,
    sort_order: Option<i32>,
) -> Result<SavedConnection, String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path)?;

    let conn = file
        .connections
        .iter_mut()
        .find(|c| c.id == connection_id)
        .ok_or_else(|| format!("Connection with ID {} not found", connection_id))?;

    conn.group_id = group_id;
    if let Some(order) = sort_order {
        conn.sort_order = Some(order);
    }

    let updated = conn.clone();
    save_connections_and_invalidate(&app, &path, &file)?;

    Ok(updated)
}

#[tauri::command]
pub async fn reorder_groups<R: Runtime>(
    app: AppHandle<R>,
    group_orders: Vec<(String, i32)>,
) -> Result<(), String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path)?;

    for (group_id, order) in group_orders {
        if let Some(group) = file.groups.iter_mut().find(|g| g.id == group_id) {
            group.sort_order = order;
        }
    }

    save_connections_and_invalidate(&app, &path, &file)?;
    Ok(())
}

#[tauri::command]
pub async fn reorder_connections_in_group<R: Runtime>(
    app: AppHandle<R>,
    connection_orders: Vec<(String, i32)>,
) -> Result<(), String> {
    let path = get_config_path(&app)?;
    let mut file = persistence::load_connections_file(&path)?;

    for (conn_id, order) in connection_orders {
        if let Some(conn) = file.connections.iter_mut().find(|c| c.id == conn_id) {
            conn.sort_order = Some(order);
        }
    }

    save_connections_and_invalidate(&app, &path, &file)?;
    Ok(())
}
