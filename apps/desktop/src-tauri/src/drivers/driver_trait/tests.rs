use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;

use super::{DatabaseDriver, DriverCapabilities, PluginManifest};
use crate::models::{
    BatchStatementResult, ConnectionParams, ForeignKey, Index, QueryResult, RoutineInfo,
    RoutineParameter, TableColumn, TableInfo, TableSchema, ViewInfo,
};

struct CharacterizationDriver {
    manifest: PluginManifest,
    calls: Arc<Mutex<Vec<String>>>,
}

impl CharacterizationDriver {
    fn new() -> Self {
        Self {
            manifest: PluginManifest {
                id: "characterization".to_string(),
                name: "Characterization".to_string(),
                version: "1.0.0".to_string(),
                description: "Test driver".to_string(),
                default_port: None,
                capabilities: DriverCapabilities::default(),
                is_builtin: false,
                default_username: String::new(),
                color: String::new(),
                icon: String::new(),
                settings: Vec::new(),
                ui_extensions: None,
            },
            calls: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn calls(&self) -> Vec<String> {
        self.calls.lock().unwrap().clone()
    }
}

#[async_trait]
impl DatabaseDriver for CharacterizationDriver {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    fn get_data_types(&self) -> Vec<crate::models::DataTypeInfo> {
        Vec::new()
    }

    fn build_connection_url(&self, _params: &ConnectionParams) -> Result<String, String> {
        Ok("sqlite::memory:".to_string())
    }

    async fn test_connection(&self, _params: &ConnectionParams) -> Result<(), String> {
        self.calls
            .lock()
            .unwrap()
            .push("test_connection".to_string());
        Ok(())
    }

    async fn get_databases(&self, _params: &ConnectionParams) -> Result<Vec<String>, String> {
        Ok(Vec::new())
    }

    async fn get_schemas(&self, _params: &ConnectionParams) -> Result<Vec<String>, String> {
        Ok(Vec::new())
    }

    async fn get_tables(
        &self,
        _params: &ConnectionParams,
        _schema: Option<&str>,
    ) -> Result<Vec<TableInfo>, String> {
        Ok(Vec::new())
    }

    async fn get_columns(
        &self,
        _params: &ConnectionParams,
        _table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<TableColumn>, String> {
        Ok(Vec::new())
    }

    async fn get_foreign_keys(
        &self,
        _params: &ConnectionParams,
        _table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<ForeignKey>, String> {
        Ok(Vec::new())
    }

    async fn get_indexes(
        &self,
        _params: &ConnectionParams,
        _table: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<Index>, String> {
        Ok(Vec::new())
    }

    async fn get_views(
        &self,
        _params: &ConnectionParams,
        _schema: Option<&str>,
    ) -> Result<Vec<ViewInfo>, String> {
        Ok(Vec::new())
    }

    async fn get_view_definition(
        &self,
        _params: &ConnectionParams,
        _view_name: &str,
        _schema: Option<&str>,
    ) -> Result<String, String> {
        Ok(String::new())
    }

    async fn get_view_columns(
        &self,
        _params: &ConnectionParams,
        _view_name: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<TableColumn>, String> {
        Ok(Vec::new())
    }

    async fn create_view(
        &self,
        _params: &ConnectionParams,
        _view_name: &str,
        _definition: &str,
        _schema: Option<&str>,
    ) -> Result<(), String> {
        Ok(())
    }

    async fn alter_view(
        &self,
        _params: &ConnectionParams,
        _view_name: &str,
        _definition: &str,
        _schema: Option<&str>,
    ) -> Result<(), String> {
        Ok(())
    }

    async fn drop_view(
        &self,
        _params: &ConnectionParams,
        _view_name: &str,
        _schema: Option<&str>,
    ) -> Result<(), String> {
        Ok(())
    }

    async fn get_routines(
        &self,
        _params: &ConnectionParams,
        _schema: Option<&str>,
    ) -> Result<Vec<RoutineInfo>, String> {
        Ok(Vec::new())
    }

    async fn get_routine_parameters(
        &self,
        _params: &ConnectionParams,
        _routine_name: &str,
        _schema: Option<&str>,
    ) -> Result<Vec<RoutineParameter>, String> {
        Ok(Vec::new())
    }

    async fn get_routine_definition(
        &self,
        _params: &ConnectionParams,
        _routine_name: &str,
        _routine_type: &str,
        _schema: Option<&str>,
    ) -> Result<String, String> {
        Ok(String::new())
    }

    async fn execute_query(
        &self,
        _params: &ConnectionParams,
        query: &str,
        _limit: Option<u32>,
        _page: u32,
        _schema: Option<&str>,
    ) -> Result<QueryResult, String> {
        self.calls.lock().unwrap().push(query.to_string());
        if query == "bad" {
            return Err("statement failed".to_string());
        }
        Ok(QueryResult {
            columns: vec!["statement".to_string()],
            rows: vec![vec![serde_json::Value::String(query.to_string())]],
            affected_rows: 0,
            truncated: false,
            pagination: None,
            additional_results: None,
        })
    }

    async fn insert_record(
        &self,
        _params: &ConnectionParams,
        _table: &str,
        _data: HashMap<String, serde_json::Value>,
        _schema: Option<&str>,
        _max_blob_size: u64,
    ) -> Result<u64, String> {
        Ok(0)
    }

    async fn update_record(
        &self,
        _params: &ConnectionParams,
        _table: &str,
        _pk_map: &HashMap<String, serde_json::Value>,
        _col_name: &str,
        _new_val: serde_json::Value,
        _schema: Option<&str>,
        _max_blob_size: u64,
    ) -> Result<u64, String> {
        Ok(0)
    }

    async fn delete_record(
        &self,
        _params: &ConnectionParams,
        _table: &str,
        _pk_map: &HashMap<String, serde_json::Value>,
        _schema: Option<&str>,
    ) -> Result<u64, String> {
        Ok(0)
    }

    async fn get_schema_snapshot(
        &self,
        _params: &ConnectionParams,
        _schema: Option<&str>,
    ) -> Result<Vec<TableSchema>, String> {
        Ok(Vec::new())
    }

    async fn get_all_columns_batch(
        &self,
        _params: &ConnectionParams,
        _schema: Option<&str>,
    ) -> Result<HashMap<String, Vec<TableColumn>>, String> {
        Ok(HashMap::new())
    }

    async fn get_all_foreign_keys_batch(
        &self,
        _params: &ConnectionParams,
        _schema: Option<&str>,
    ) -> Result<HashMap<String, Vec<ForeignKey>>, String> {
        Ok(HashMap::new())
    }
}

#[test]
fn multiple_databases_serializes_explicitly() {
    let capabilities = DriverCapabilities {
        multiple_databases: true,
        ..Default::default()
    };

    let value = serde_json::to_value(capabilities).expect("serialize capabilities");

    assert_eq!(
        value.get("multiple_databases"),
        Some(&serde_json::json!(true))
    );
}

#[test]
fn legacy_plugin_capabilities_default_multiple_databases_to_false() {
    let capabilities: DriverCapabilities = serde_json::from_value(serde_json::json!({
        "schemas": true,
        "views": true,
        "routines": false,
        "file_based": false
    }))
    .expect("deserialize legacy capabilities");

    assert!(!capabilities.multiple_databases);
}

#[test]
fn legacy_plugin_capabilities_default_sidebar_ddl_to_false() {
    let capabilities: DriverCapabilities = serde_json::from_value(serde_json::json!({
        "schemas": true,
        "views": true,
        "routines": false,
        "file_based": false
    }))
    .expect("deserialize legacy capabilities");

    assert!(!capabilities.create_database);
    assert!(!capabilities.drop_database);
    assert!(!capabilities.rename_database);
    assert!(!capabilities.create_schema);
    assert!(!capabilities.truncate_table);
}

#[test]
fn sidebar_ddl_capabilities_accept_camel_case_aliases() {
    let capabilities: DriverCapabilities = serde_json::from_value(serde_json::json!({
        "schemas": true,
        "views": true,
        "routines": false,
        "file_based": false,
        "createDatabase": true,
        "dropDatabase": true,
        "renameDatabase": true,
        "createSchema": true,
        "truncateTable": true
    }))
    .expect("deserialize aliased capabilities");

    assert!(capabilities.create_database);
    assert!(capabilities.drop_database);
    assert!(capabilities.rename_database);
    assert!(capabilities.create_schema);
    assert!(capabilities.truncate_table);
}

#[test]
fn default_driver_capabilities_keep_external_features_disabled() {
    let capabilities = DriverCapabilities::default();

    assert!(!capabilities.schemas);
    assert!(!capabilities.multiple_databases);
    assert!(!capabilities.views);
    assert!(!capabilities.materialized_views);
    assert!(!capabilities.routines);
    assert!(!capabilities.file_based);
    assert!(!capabilities.folder_based);
    assert!(!capabilities.connection_string);
    assert_eq!(capabilities.identifier_quote, "");
    assert!(!capabilities.alter_primary_key);
    assert!(!capabilities.create_database);
    assert!(!capabilities.drop_database);
    assert!(!capabilities.rename_database);
    assert!(!capabilities.create_schema);
    assert!(!capabilities.truncate_table);
    assert!(!capabilities.create_foreign_keys);
    assert!(!capabilities.no_connection_required);
    assert!(!capabilities.manage_tables);
    assert!(!capabilities.triggers);
    assert!(!capabilities.routine_management);
    assert!(!capabilities.supports_ssl);
    assert!(!capabilities.readonly);
}

#[tokio::test]
async fn ping_default_delegates_to_test_connection() {
    let driver = CharacterizationDriver::new();

    driver.ping(&ConnectionParams::default()).await.unwrap();

    assert_eq!(driver.calls(), vec!["test_connection".to_string()]);
}

#[tokio::test]
async fn truncate_table_default_preserves_exact_unsupported_operation_error() {
    let driver = CharacterizationDriver::new();

    let error = driver
        .truncate_table(&ConnectionParams::default(), "events", Some("public"))
        .await
        .expect_err("truncate_table should be unsupported by default");

    assert_eq!(error, "Truncate table not supported by this driver");
}

#[tokio::test]
async fn ordered_operations_stop_after_the_first_error() {
    let driver = CharacterizationDriver::new();
    let params = ConnectionParams::default();
    let mut results = Vec::new();

    let outcome: Result<(), String> = async {
        let result = driver
            .execute_query(&params, "first", None, 1, Some("public"))
            .await
            .map(|_| ());
        results.push(result.clone());
        result?;

        let result = driver
            .truncate_table(&params, "events", Some("public"))
            .await;
        results.push(result.clone());
        result?;

        let result = driver
            .execute_query(&params, "third", None, 1, Some("public"))
            .await
            .map(|_| ());
        results.push(result.clone());
        result
    }
    .await;

    assert_eq!(
        outcome.unwrap_err(),
        "Truncate table not supported by this driver"
    );
    assert_eq!(driver.calls(), vec!["first"]);
    assert_eq!(results.len(), 2);
    assert!(results[0].is_ok());
    assert_eq!(
        results[1].as_ref().unwrap_err(),
        "Truncate table not supported by this driver"
    );
}

#[tokio::test]
async fn execute_batch_default_runs_all_statements_in_order() {
    let driver = CharacterizationDriver::new();
    let queries = vec!["first".to_string(), "bad".to_string(), "third".to_string()];
    let progress = Arc::new(Mutex::new(Vec::<(usize, bool)>::new()));
    let progress_cb = {
        let progress = progress.clone();
        move |index: usize, statement: &BatchStatementResult| {
            progress
                .lock()
                .unwrap()
                .push((index, statement.error.is_some()));
        }
    };

    let results = driver
        .execute_batch(
            &ConnectionParams::default(),
            &queries,
            Some(100),
            1,
            Some("public"),
            Some(&progress_cb),
        )
        .await
        .unwrap();

    assert_eq!(driver.calls(), vec!["first", "bad", "third"]);
    assert_eq!(results.len(), 3);
    assert!(results[0].result.is_some());
    assert_eq!(results[1].error.as_deref(), Some("statement failed"));
    assert!(results[2].result.is_some());
    assert_eq!(
        progress.lock().unwrap().clone(),
        vec![(0, false), (1, true), (2, false)]
    );
}
