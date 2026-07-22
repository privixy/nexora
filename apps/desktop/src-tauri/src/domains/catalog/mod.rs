use crate::domains::connections::ResolvedConnection;

pub struct CatalogService;

impl CatalogService {
    pub async fn get_schemas(resolved: ResolvedConnection) -> Result<Vec<String>, String> {
        resolved.driver.get_schemas(&resolved.params).await
    }

    pub async fn create_database(
        resolved: ResolvedConnection,
        database: &str,
    ) -> Result<(), String> {
        resolved
            .driver
            .create_database(&resolved.params, database)
            .await
    }

    pub async fn truncate_table(
        resolved: ResolvedConnection,
        table: &str,
        schema: Option<&str>,
    ) -> Result<(), String> {
        resolved
            .driver
            .truncate_table(&resolved.params, table, schema)
            .await
    }
}

#[cfg(test)]
mod tests;
