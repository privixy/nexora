use std::collections::HashSet;
use std::sync::Arc;

use once_cell::sync::Lazy;
use tokio::sync::RwLock;

pub(super) static ACTIVE_CONNECTIONS: Lazy<Arc<RwLock<HashSet<String>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashSet::new())));

pub async fn register_connection(connection_id: String) {
    log::info!("Health check: registering connection {}", connection_id);
    ACTIVE_CONNECTIONS.write().await.insert(connection_id);
}

pub async fn unregister_connection(connection_id: &str) {
    log::info!("Health check: unregistering connection {}", connection_id);
    ACTIVE_CONNECTIONS.write().await.remove(connection_id);
}

pub async fn active_connections() -> Vec<String> {
    ACTIVE_CONNECTIONS.read().await.iter().cloned().collect()
}
