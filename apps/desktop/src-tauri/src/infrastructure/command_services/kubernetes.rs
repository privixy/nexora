use std::fs;
use tauri::{AppHandle, Runtime};
use uuid::Uuid;

use crate::models::{
    K8sConnection, K8sConnectionInput,
};

use crate::infrastructure::connections::workflows::*;

#[tauri::command]
pub async fn get_k8s_connections<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<K8sConnection>, String> {
    let path = get_k8s_config_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let connections: Vec<K8sConnection> = serde_json::from_str(&content).unwrap_or_default();
    Ok(connections)
}

#[tauri::command]
pub async fn save_k8s_connection<R: Runtime>(
    app: AppHandle<R>,
    k8s: K8sConnectionInput,
) -> Result<K8sConnection, String> {
    let path = get_k8s_config_path(&app)?;
    let mut connections: Vec<K8sConnection> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };

    let id = Uuid::new_v4().to_string();
    let connection = K8sConnection {
        id: id.clone(),
        name: k8s.name,
        context: k8s.context,
        namespace: k8s.namespace,
        resource_type: k8s.resource_type,
        resource_name: k8s.resource_name,
        port: k8s.port,
    };

    connections.push(connection.clone());
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(connection)
}

#[tauri::command]
pub async fn update_k8s_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    k8s: K8sConnectionInput,
) -> Result<K8sConnection, String> {
    let path = get_k8s_config_path(&app)?;
    let mut connections: Vec<K8sConnection> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        return Err("No K8s connections file found".to_string());
    };

    let idx = connections
        .iter()
        .position(|c| c.id == id)
        .ok_or_else(|| format!("K8s connection with ID {} not found", id))?;

    let connection = K8sConnection {
        id: id.clone(),
        name: k8s.name,
        context: k8s.context,
        namespace: k8s.namespace,
        resource_type: k8s.resource_type,
        resource_name: k8s.resource_name,
        port: k8s.port,
    };

    connections[idx] = connection.clone();
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(connection)
}

#[tauri::command]
pub async fn delete_k8s_connection<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let path = get_k8s_config_path(&app)?;
    let mut connections: Vec<K8sConnection> = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        return Ok(());
    };

    connections.retain(|c| c.id != id);
    let json = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn test_k8s_connection_cmd<R: Runtime>(
    _app: AppHandle<R>,
    context: String,
    namespace: String,
) -> Result<String, String> {
    crate::k8s_tunnel::test_k8s_connection(&context, &namespace)
}

#[tauri::command]
pub async fn get_k8s_contexts_cmd<R: Runtime>(_app: AppHandle<R>) -> Result<Vec<String>, String> {
    crate::k8s_tunnel::get_k8s_contexts()
}

#[tauri::command]
pub async fn get_k8s_namespaces_cmd<R: Runtime>(
    _app: AppHandle<R>,
    context: String,
) -> Result<Vec<String>, String> {
    crate::k8s_tunnel::get_k8s_namespaces(&context)
}

#[tauri::command]
pub async fn get_k8s_resources_cmd<R: Runtime>(
    _app: AppHandle<R>,
    context: String,
    namespace: String,
    resource_type: String,
) -> Result<Vec<String>, String> {
    crate::k8s_tunnel::get_k8s_resources(&context, &namespace, &resource_type)
}

#[tauri::command]
pub async fn get_k8s_resource_ports_cmd<R: Runtime>(
    _app: AppHandle<R>,
    context: String,
    namespace: String,
    resource_type: String,
    resource_name: String,
) -> Result<Vec<u16>, String> {
    crate::k8s_tunnel::get_k8s_resource_ports(&context, &namespace, &resource_type, &resource_name)
}
