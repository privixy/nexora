use tauri::{AppHandle, Manager, Runtime};

use crate::domains::connections::{ConnectionContextResolver, DatabaseContext, ResolvedConnection};
use crate::models::{ConnectionParams, K8sConnection, SshConnection};
use crate::ssh_tunnel::{get_tunnels, SshTunnel};

use super::repository::{find_connection_by_id, get_k8s_config_path, get_ssh_config_path};

const DEFAULT_MYSQL_PORT: u16 = 3306;

async fn driver_for(
    id: &str,
) -> Result<std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>, String> {
    crate::drivers::registry::get_driver(id)
        .await
        .ok_or_else(|| format!("Unsupported driver: {}", id))
}

async fn get_ssh_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    ssh_id: &str,
) -> Result<SshConnection, String> {
    let path = get_ssh_config_path(app)?;
    if !path.exists() {
        return Err(format!("SSH connection with ID {} not found", ssh_id));
    }

    let content = tokio::task::spawn_blocking({
        let path = path.clone();
        move || std::fs::read_to_string(path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut ssh = serde_json::from_str::<Vec<SshConnection>>(&content)
        .unwrap_or_default()
        .into_iter()
        .find(|connection| connection.id == ssh_id)
        .ok_or_else(|| format!("SSH connection with ID {} not found", ssh_id))?;

    if ssh.auth_type.is_none() {
        ssh.auth_type = Some(
            if ssh
                .key_file
                .as_ref()
                .map_or(false, |key| !key.trim().is_empty())
            {
                "ssh_key".to_string()
            } else {
                "password".to_string()
            },
        );
    }

    if ssh.save_in_keychain.unwrap_or(false) {
        let cache = app
            .state::<std::sync::Arc<crate::credential_cache::CredentialCache>>()
            .inner()
            .clone();
        let id = ssh.id.clone();
        let (password, passphrase) = tokio::task::spawn_blocking(move || {
            let password = crate::credential_cache::get_ssh_password_cached(&cache, &id);
            let passphrase = crate::credential_cache::get_ssh_key_passphrase_cached(&cache, &id);
            (password, passphrase)
        })
        .await
        .map_err(|e| e.to_string())?;

        if let Ok(value) = password {
            if !value.trim().is_empty() {
                ssh.password = Some(value);
            }
        }
        if let Ok(value) = passphrase {
            if !value.trim().is_empty() {
                ssh.key_passphrase = Some(value);
            }
        }
    }

    Ok(ssh)
}

pub async fn expand_ssh_connection_params<R: Runtime>(
    app: &AppHandle<R>,
    params: &ConnectionParams,
) -> Result<ConnectionParams, String> {
    let mut expanded_params = params.clone();
    if params.ssh_enabled.unwrap_or(false) {
        if let Some(ssh_id) = &params.ssh_connection_id {
            let ssh = get_ssh_connection_by_id(app, ssh_id).await?;
            expanded_params.ssh_host = Some(ssh.host);
            expanded_params.ssh_port = Some(ssh.port);
            expanded_params.ssh_user = Some(ssh.user);
            expanded_params.ssh_password = ssh.password;
            expanded_params.ssh_key_file = ssh.key_file;
            expanded_params.ssh_key_passphrase = ssh.key_passphrase;
            expanded_params.ssh_allow_passphrase_prompt = ssh.allow_passphrase_prompt;
        }
    }
    Ok(expanded_params)
}

fn build_tunnel_map_key(
    ssh_user: &str,
    ssh_host: &str,
    ssh_port: u16,
    remote_host: &str,
    remote_port: u16,
) -> String {
    crate::ssh_tunnel::build_tunnel_key(ssh_user, ssh_host, ssh_port, remote_host, remote_port)
}

pub fn resolve_k8s_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
    let context = params.k8s_context.as_deref().ok_or("Missing K8s context")?;
    let namespace = params
        .k8s_namespace
        .as_deref()
        .ok_or("Missing K8s namespace")?;
    let resource_type = params
        .k8s_resource_type
        .as_deref()
        .ok_or("Missing K8s resource type")?;
    let resource_name = params
        .k8s_resource_name
        .as_deref()
        .ok_or("Missing K8s resource name")?;
    let port = params.k8s_port.ok_or("Missing K8s port")?;
    let key =
        crate::k8s_tunnel::build_tunnel_key(context, namespace, resource_type, resource_name, port);

    {
        let tunnels = crate::k8s_tunnel::get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&key) {
            let mut resolved = params.clone();
            resolved.k8s_enabled = Some(false);
            resolved.host = Some("127.0.0.1".to_string());
            resolved.port = Some(tunnel.local_port);
            return Ok(resolved);
        }
    }

    let tunnel =
        crate::k8s_tunnel::K8sTunnel::new(context, namespace, resource_type, resource_name, port)
            .map_err(|error| {
            eprintln!("[Connection Error] K8s Tunnel setup failed: {}", error);
            error
        })?;
    let local_port = tunnel.local_port;
    crate::k8s_tunnel::get_tunnels()
        .lock()
        .unwrap()
        .insert(key, tunnel);
    let mut resolved = params.clone();
    resolved.k8s_enabled = Some(false);
    resolved.host = Some("127.0.0.1".to_string());
    resolved.port = Some(local_port);
    Ok(resolved)
}

pub fn resolve_connection_params(params: &ConnectionParams) -> Result<ConnectionParams, String> {
    if params.k8s_enabled.unwrap_or(false) && params.ssh_enabled.unwrap_or(false) {
        return Err(
            "Kubernetes and SSH tunnel cannot both be enabled for the same connection".to_string(),
        );
    }
    if params.k8s_enabled.unwrap_or(false) {
        return resolve_k8s_params(params);
    }
    if !params.ssh_enabled.unwrap_or(false) {
        return Ok(params.clone());
    }

    let ssh_host = params.ssh_host.as_deref().ok_or("Missing SSH Host")?;
    let ssh_port = params.ssh_port.unwrap_or(22);
    let ssh_user = params.ssh_user.as_deref().ok_or("Missing SSH User")?;
    let remote_host = params.host.as_deref().unwrap_or("localhost");
    let remote_port = params.port.unwrap_or(DEFAULT_MYSQL_PORT);
    let key = build_tunnel_map_key(ssh_user, ssh_host, ssh_port, remote_host, remote_port);

    {
        let tunnels = get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&key) {
            let mut resolved = params.clone();
            resolved.host = Some("127.0.0.1".to_string());
            resolved.port = Some(tunnel.local_port);
            return Ok(resolved);
        }
    }

    let tunnel = SshTunnel::new(
        ssh_host,
        ssh_port,
        ssh_user,
        params.ssh_password.as_deref(),
        params.ssh_key_file.as_deref(),
        params.ssh_key_passphrase.as_deref(),
        params.ssh_allow_passphrase_prompt.unwrap_or(false),
        remote_host,
        remote_port,
    )
    .map_err(|error| {
        eprintln!("[Connection Error] SSH Tunnel setup failed: {}", error);
        error
    })?;
    let local_port = tunnel.local_port;
    get_tunnels().lock().unwrap().insert(key, tunnel);
    let mut resolved = params.clone();
    resolved.host = Some("127.0.0.1".to_string());
    resolved.port = Some(local_port);
    Ok(resolved)
}

pub fn resolve_connection_params_with_id(
    params: &ConnectionParams,
    connection_id: &str,
) -> Result<ConnectionParams, String> {
    let mut resolved = resolve_connection_params(params)?;
    resolved.connection_id = Some(connection_id.to_string());
    Ok(resolved)
}

pub async fn expand_k8s_connection_params<R: Runtime>(
    app: &AppHandle<R>,
    params: &ConnectionParams,
) -> Result<ConnectionParams, String> {
    if !params.k8s_enabled.unwrap_or(false) {
        return Ok(params.clone());
    }
    if params.ssh_enabled.unwrap_or(false) {
        return Err(
            "Kubernetes and SSH tunnel cannot both be enabled for the same connection".to_string(),
        );
    }

    let (context, namespace, resource_type, resource_name, port) =
        if let Some(k8s_id) = &params.k8s_connection_id {
            let connection = get_k8s_connection_by_id(app, k8s_id).await?;
            (
                connection.context,
                connection.namespace,
                connection.resource_type,
                connection.resource_name,
                connection.port,
            )
        } else {
            (
                params
                    .k8s_context
                    .as_deref()
                    .ok_or("Missing K8s context")?
                    .to_string(),
                params
                    .k8s_namespace
                    .as_deref()
                    .ok_or("Missing K8s namespace")?
                    .to_string(),
                params
                    .k8s_resource_type
                    .as_deref()
                    .ok_or("Missing K8s resource type")?
                    .to_string(),
                params
                    .k8s_resource_name
                    .as_deref()
                    .ok_or("Missing K8s resource name")?
                    .to_string(),
                params.k8s_port.ok_or("Missing K8s port")?,
            )
        };

    let key = crate::k8s_tunnel::build_tunnel_key(
        &context,
        &namespace,
        &resource_type,
        &resource_name,
        port,
    );
    {
        let tunnels = crate::k8s_tunnel::get_tunnels().lock().unwrap();
        if let Some(tunnel) = tunnels.get(&key) {
            let mut resolved = params.clone();
            resolved.k8s_enabled = Some(false);
            resolved.host = Some("127.0.0.1".to_string());
            resolved.port = Some(tunnel.local_port);
            return Ok(resolved);
        }
    }

    let tunnel = crate::k8s_tunnel::K8sTunnel::new(
        &context,
        &namespace,
        &resource_type,
        &resource_name,
        port,
    )
    .map_err(|error| {
        eprintln!("[Connection Error] K8s Tunnel setup failed: {}", error);
        error
    })?;
    let local_port = tunnel.local_port;
    crate::k8s_tunnel::get_tunnels()
        .lock()
        .unwrap()
        .insert(key, tunnel);
    let mut resolved = params.clone();
    resolved.k8s_enabled = Some(false);
    resolved.host = Some("127.0.0.1".to_string());
    resolved.port = Some(local_port);
    Ok(resolved)
}

async fn get_k8s_connection_by_id<R: Runtime>(
    app: &AppHandle<R>,
    k8s_id: &str,
) -> Result<K8sConnection, String> {
    let path = get_k8s_config_path(app)?;
    if !path.exists() {
        return Err(format!("K8s connection with ID {} not found", k8s_id));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<Vec<K8sConnection>>(&content)
        .unwrap_or_default()
        .into_iter()
        .find(|connection| connection.id == k8s_id)
        .ok_or_else(|| format!("K8s connection with ID {} not found", k8s_id))
}

pub struct TauriConnectionContextResolver<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriConnectionContextResolver<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }

    pub async fn resolve(
        &self,
        context: DatabaseContext<'_>,
    ) -> Result<ResolvedConnection, String> {
        ConnectionContextResolver::resolve(self, context).await
    }
}

#[async_trait::async_trait]
impl<R: Runtime> ConnectionContextResolver for TauriConnectionContextResolver<R> {
    async fn resolve(&self, context: DatabaseContext<'_>) -> Result<ResolvedConnection, String> {
        let saved = find_connection_by_id(&self.app, context.connection_id)?;
        let expanded = expand_ssh_connection_params(&self.app, &saved.params).await?;
        let expanded = expand_k8s_connection_params(&self.app, &expanded).await?;
        let params = resolve_connection_params_with_id(&expanded, context.connection_id)?;
        let params = crate::connection_params::apply_database_override(params, context.database);
        let driver = driver_for(&saved.params.driver).await?;
        Ok(ResolvedConnection {
            saved,
            params,
            driver,
        })
    }
}
