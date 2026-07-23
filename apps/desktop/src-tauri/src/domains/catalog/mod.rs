use crate::ai_schema_context::{format_for_prompt, DEFAULT_MAX_TABLES};
use crate::domains::connections::{ConnectionContextResolver, DatabaseContext};
use crate::models::{ForeignKey, Index, TableColumn, TableInfo, TableSchema};

pub struct CatalogService;

impl CatalogService {
    pub async fn get_schemas(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: Option<&str>,
    ) -> Result<Vec<String>, String> {
        log::info!("Fetching schemas for connection: {}", connection_id);
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema: None,
                table: None,
            })
            .await?;
        resolved.driver.get_schemas(&resolved.params).await
    }

    pub async fn get_available_databases(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
    ) -> Result<Vec<String>, String> {
        log::info!(
            "Fetching available databases for connection: {}",
            connection_id
        );
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database: None,
                schema: None,
                table: None,
            })
            .await?;
        resolved.driver.get_databases(&resolved.params).await
    }

    pub async fn create_database(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: &str,
    ) -> Result<(), String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database: None,
                schema: None,
                table: None,
            })
            .await?;
        resolved
            .driver
            .create_database(&resolved.params, database)
            .await
    }

    pub async fn drop_database(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: &str,
    ) -> Result<(), String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database: None,
                schema: None,
                table: None,
            })
            .await?;
        resolved
            .driver
            .drop_database(&resolved.params, database)
            .await
    }

    pub async fn rename_database(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: &str,
        new_name: &str,
    ) -> Result<(), String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database: None,
                schema: None,
                table: None,
            })
            .await?;
        resolved
            .driver
            .rename_database(&resolved.params, database, new_name)
            .await
    }

    pub async fn create_schema(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: Option<&str>,
        schema: &str,
    ) -> Result<(), String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema: Some(schema),
                table: None,
            })
            .await?;
        resolved
            .driver
            .create_schema(&resolved.params, schema)
            .await
    }

    pub async fn truncate_table(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: Option<&str>,
        table: &str,
        schema: Option<&str>,
    ) -> Result<(), String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: Some(table),
            })
            .await?;
        resolved
            .driver
            .truncate_table(&resolved.params, table, schema)
            .await
    }

    pub async fn drop_table(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        database: Option<&str>,
        table: &str,
        schema: Option<&str>,
    ) -> Result<(), String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: Some(table),
            })
            .await?;
        resolved
            .driver
            .drop_table(&resolved.params, table, schema)
            .await
    }

    pub async fn get_tables(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        schema: Option<&str>,
        database: Option<&str>,
    ) -> Result<Vec<TableInfo>, String> {
        log::info!("Fetching tables for connection: {}", connection_id);
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: None,
            })
            .await?;
        let params = resolved.params;
        log::debug!(
            "Getting tables from {} database: {}",
            resolved.saved.params.driver,
            params.database
        );
        let result = resolved.driver.get_tables(&params, schema).await;
        match &result {
            Ok(tables) => log::info!("Retrieved {} tables from {}", tables.len(), params.database),
            Err(error) => log::error!("Failed to get tables from {}: {}", params.database, error),
        }
        result
    }

    pub async fn get_columns(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        database: Option<&str>,
    ) -> Result<Vec<TableColumn>, String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: Some(table_name),
            })
            .await?;
        resolved
            .driver
            .get_columns(&resolved.params, table_name, schema)
            .await
    }

    pub async fn get_foreign_keys(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        database: Option<&str>,
    ) -> Result<Vec<ForeignKey>, String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: Some(table_name),
            })
            .await?;
        resolved
            .driver
            .get_foreign_keys(&resolved.params, table_name, schema)
            .await
    }

    pub async fn get_indexes(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        database: Option<&str>,
    ) -> Result<Vec<Index>, String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: Some(table_name),
            })
            .await?;
        resolved
            .driver
            .get_indexes(&resolved.params, table_name, schema)
            .await
    }

    pub async fn get_schema_snapshot(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        schema: Option<&str>,
        database: Option<&str>,
    ) -> Result<Vec<TableSchema>, String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database,
                schema,
                table: None,
            })
            .await?;
        resolved
            .driver
            .get_schema_snapshot(&resolved.params, schema)
            .await
    }

    pub async fn get_ai_schema_context(
        resolver: &impl ConnectionContextResolver,
        connection_id: &str,
        schema: Option<&str>,
    ) -> Result<String, String> {
        let resolved = resolver
            .resolve(DatabaseContext {
                connection_id,
                database: None,
                schema,
                table: None,
            })
            .await?;
        let identifier_quote = resolved
            .driver
            .manifest()
            .capabilities
            .identifier_quote
            .as_str();
        let context = resolved
            .driver
            .get_ai_schema_context(&resolved.params, schema, DEFAULT_MAX_TABLES)
            .await?;
        Ok(format_for_prompt(&context, identifier_quote))
    }
}

#[cfg(test)]
mod tests;
