use std::sync::Arc;

use crate::drivers::driver_trait::DatabaseDriver;
use crate::models::{ConnectionParams, SavedConnection};

pub struct DatabaseContext<'a> {
    pub connection_id: &'a str,
    pub database: Option<&'a str>,
    pub schema: Option<&'a str>,
    pub table: Option<&'a str>,
}

pub struct ResolvedConnection {
    pub saved: SavedConnection,
    pub params: ConnectionParams,
    pub driver: Arc<dyn DatabaseDriver>,
}

#[async_trait::async_trait]
pub trait ConnectionContextResolver: Send + Sync {
    async fn resolve(&self, context: DatabaseContext<'_>) -> Result<ResolvedConnection, String>;
}
