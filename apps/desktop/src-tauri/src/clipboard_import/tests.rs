use super::*;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::drivers::driver_trait::{DriverCapabilities, PluginManifest};
use crate::models::{
    ConnectionParams, ForeignKey, Index, QueryResult, RoutineInfo, RoutineParameter, TableColumn,
    TableInfo, TableSchema, ViewInfo,
};

struct RecordingDriver {
    manifest: PluginManifest,
    calls: Mutex<Vec<(String, Option<String>)>>,
    create_sql: Result<Vec<String>, String>,
    execute_error: Option<(String, String)>,
}

impl RecordingDriver {
    fn new(create_sql: Result<Vec<String>, String>) -> Self {
        Self {
            manifest: PluginManifest {
                id: "clipboard-test".into(),
                name: "Clipboard test".into(),
                version: "1.0.0".into(),
                description: String::new(),
                default_port: None,
                capabilities: DriverCapabilities::default(),
                is_builtin: false,
                default_username: String::new(),
                color: String::new(),
                icon: String::new(),
                settings: Vec::new(),
                ui_extensions: None,
            },
            calls: Mutex::new(Vec::new()),
            create_sql,
            execute_error: None,
        }
    }

    fn failing(mut self, prefix: &str, error: &str) -> Self {
        self.execute_error = Some((prefix.into(), error.into()));
        self
    }

    fn calls(&self) -> Vec<(String, Option<String>)> {
        self.calls.lock().unwrap().clone()
    }
}

#[async_trait]
impl DatabaseDriver for RecordingDriver {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }

    fn get_data_types(&self) -> Vec<crate::models::DataTypeInfo> {
        Vec::new()
    }

    fn build_connection_url(&self, _params: &ConnectionParams) -> Result<String, String> {
        Ok(String::new())
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

    async fn get_create_table_sql(
        &self,
        _table: &str,
        _columns: Vec<ColumnDefinition>,
        _schema: Option<&str>,
    ) -> Result<Vec<String>, String> {
        self.create_sql.clone()
    }

    async fn execute_query(
        &self,
        _params: &ConnectionParams,
        query: &str,
        _page_size: Option<u32>,
        _page: u32,
        schema: Option<&str>,
    ) -> Result<QueryResult, String> {
        self.calls
            .lock()
            .unwrap()
            .push((query.to_string(), schema.map(str::to_string)));
        if let Some((prefix, error)) = &self.execute_error {
            if query.starts_with(prefix) {
                return Err(error.clone());
            }
        }
        Ok(QueryResult {
            columns: Vec::new(),
            rows: Vec::new(),
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

fn params() -> ConnectionParams {
    ConnectionParams {
        driver: "clipboard-test".into(),
        ..Default::default()
    }
}

fn column(name: &str, data_type: &str, is_nullable: bool) -> ColumnDefinition {
    ColumnDefinition {
        name: name.into(),
        data_type: data_type.into(),
        is_nullable,
        is_pk: false,
        is_auto_increment: false,
        default_value: None,
    }
}

fn request(rows: Vec<Vec<Option<String>>>) -> ClipboardImportRequest {
    ClipboardImportRequest {
        connection_id: "connection-1".into(),
        table_name: "people".into(),
        schema: Some("custom".into()),
        columns: vec![column("name", "TEXT", true)],
        rows,
        create_table: false,
        if_exists: IfExistsStrategy::Fail,
        add_columns: Vec::new(),
    }
}

#[tokio::test]
async fn create_replace_orders_drop_create_and_insert_with_current_tuple() {
    let driver = RecordingDriver::new(Ok(vec!["CREATE TABLE generated".into()]));
    let mut req = request(vec![vec![Some("O'Reilly".into())]]);
    req.create_table = true;
    req.if_exists = IfExistsStrategy::Replace;
    let result = execute_with_driver(&driver, &params(), &req).await.unwrap();
    assert_eq!(result.rows_inserted, 1);
    assert!(result.table_created);
    assert_eq!(
        driver.calls(),
        vec![
            (
                "DROP TABLE IF EXISTS \"custom\".\"people\"".into(),
                Some("custom".into())
            ),
            ("CREATE TABLE generated".into(), Some("custom".into())),
            (
                "INSERT INTO \"custom\".\"people\" (\"name\") VALUES ('O''Reilly')".into(),
                Some("custom".into())
            ),
        ]
    );
}

#[tokio::test]
async fn append_adds_columns_before_insert_without_creating_table() {
    let driver = RecordingDriver::new(Ok(Vec::new()));
    let mut req = request(vec![vec![Some("Ada".into())]]);
    req.create_table = true;
    req.if_exists = IfExistsStrategy::Append;
    req.add_columns = vec![column("age", "INTEGER", false)];
    let result = execute_with_driver(&driver, &params(), &req).await.unwrap();
    assert!(!result.table_created);
    assert_eq!(
        driver.calls(),
        vec![
            (
                "ALTER TABLE \"custom\".\"people\" ADD COLUMN \"age\" INTEGER NOT NULL".into(),
                Some("custom".into())
            ),
            (
                "INSERT INTO \"custom\".\"people\" (\"name\") VALUES ('Ada')".into(),
                Some("custom".into())
            ),
        ]
    );
}

#[tokio::test]
async fn empty_rows_succeed_without_insert_and_batches_at_five_hundred() {
    let driver = RecordingDriver::new(Ok(Vec::new()));
    let empty = execute_with_driver(&driver, &params(), &request(Vec::new()))
        .await
        .unwrap();
    assert_eq!(empty.rows_inserted, 0);
    assert!(driver.calls().is_empty());

    let rows = (0..501).map(|i| vec![Some(i.to_string())]).collect();
    let result = execute_with_driver(&driver, &params(), &request(rows))
        .await
        .unwrap();
    assert_eq!(result.rows_inserted, 501);
    let calls = driver.calls();
    assert_eq!(calls.len(), 2);
    assert!(calls[0].0.contains("('499')"));
    assert!(!calls[0].0.contains("('500')"));
    assert!(calls[1].0.ends_with("('500')"));
}

#[tokio::test]
async fn exact_errors_identify_create_add_and_insert_failures() {
    let mut req = request(Vec::new());
    req.create_table = true;
    let generation = RecordingDriver::new(Err("generator failed".into()));
    assert_eq!(
        execute_with_driver(&generation, &params(), &req)
            .await
            .unwrap_err(),
        "Failed to generate CREATE TABLE SQL: generator failed"
    );

    let adding = RecordingDriver::new(Ok(Vec::new())).failing("ALTER TABLE", "alter failed");
    let mut req = request(Vec::new());
    req.add_columns = vec![column("age", "INTEGER", true)];
    assert_eq!(
        execute_with_driver(&adding, &params(), &req)
            .await
            .unwrap_err(),
        "Failed to add column 'age': alter failed"
    );

    let inserting = RecordingDriver::new(Ok(Vec::new())).failing("INSERT INTO", "insert failed");
    assert_eq!(
        execute_with_driver(
            &inserting,
            &params(),
            &request(vec![vec![Some("x".into())]])
        )
        .await
        .unwrap_err(),
        "Failed to insert rows (batch starting at 0): insert failed"
    );
}
