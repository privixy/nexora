use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;

use super::*;
use crate::domains::connections::{
    ConnectionContextResolver, DatabaseContext, QueryCancellationState, ResolvedConnection,
};
use crate::drivers::driver_trait::{
    BatchProgressFn, DatabaseDriver, DriverCapabilities, PluginManifest,
};
use crate::models::{
    ConnectionParams, DatabaseSelection, ExplainNode, ForeignKey, Index, QueryResult, RoutineInfo,
    RoutineParameter, SavedConnection, TableColumn, TableInfo, TableSchema, ViewInfo,
};

type ExecuteCall = (String, Option<u32>, u32, Option<String>, String);
type BatchCall = (Vec<String>, Option<u32>, u32, Option<String>, String);
type ExplainCall = (String, bool, Option<String>, String);
type ResolvedContext = (String, Option<String>, Option<String>, Option<String>);
type Shared<T> = Arc<Mutex<T>>;

#[derive(Default)]
struct DriverCalls {
    execute: Vec<ExecuteCall>,
    batch: Vec<BatchCall>,
    explain: Vec<ExplainCall>,
}

struct FakeDriver {
    manifest: PluginManifest,
    calls: Arc<Mutex<DriverCalls>>,
}

impl FakeDriver {
    fn new(calls: Arc<Mutex<DriverCalls>>) -> Self {
        Self {
            manifest: PluginManifest {
                id: "query-test".into(),
                name: "Query test".into(),
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
            calls,
        }
    }

    fn result(value: &str) -> QueryResult {
        QueryResult {
            columns: vec!["value".into()],
            rows: vec![vec![serde_json::json!(value)]],
            affected_rows: 0,
            truncated: false,
            pagination: None,
            additional_results: None,
        }
    }
}

#[async_trait]
impl DatabaseDriver for FakeDriver {
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

    async fn execute_query(
        &self,
        params: &ConnectionParams,
        query: &str,
        limit: Option<u32>,
        page: u32,
        schema: Option<&str>,
    ) -> Result<QueryResult, String> {
        self.calls.lock().unwrap().execute.push((
            query.into(),
            limit,
            page,
            schema.map(str::to_string),
            params.database.to_string(),
        ));
        Ok(Self::result(query))
    }

    async fn execute_batch(
        &self,
        params: &ConnectionParams,
        queries: &[String],
        limit: Option<u32>,
        page: u32,
        schema: Option<&str>,
        on_progress: Option<&BatchProgressFn>,
    ) -> Result<Vec<crate::models::BatchStatementResult>, String> {
        self.calls.lock().unwrap().batch.push((
            queries.to_vec(),
            limit,
            page,
            schema.map(str::to_string),
            params.database.to_string(),
        ));
        let results = queries
            .iter()
            .map(|query| crate::models::BatchStatementResult {
                result: Some(Self::result(query)),
                error: None,
                execution_time_ms: Some(1.0),
            })
            .collect::<Vec<_>>();
        if let Some(progress) = on_progress {
            for (index, result) in results.iter().enumerate() {
                progress(index, result);
            }
        }
        Ok(results)
    }

    async fn explain_query(
        &self,
        params: &ConnectionParams,
        query: &str,
        analyze: bool,
        schema: Option<&str>,
    ) -> Result<crate::models::ExplainPlan, String> {
        self.calls.lock().unwrap().explain.push((
            query.into(),
            analyze,
            schema.map(str::to_string),
            params.database.to_string(),
        ));
        Ok(crate::models::ExplainPlan {
            root: ExplainNode {
                id: "root".into(),
                node_type: "Scan".into(),
                relation: None,
                startup_cost: None,
                total_cost: None,
                plan_rows: None,
                actual_rows: None,
                actual_time_ms: None,
                actual_loops: None,
                buffers_hit: None,
                buffers_read: None,
                filter: None,
                index_condition: None,
                join_type: None,
                hash_condition: None,
                extra: HashMap::new(),
                children: Vec::new(),
            },
            planning_time_ms: None,
            execution_time_ms: None,
            original_query: query.into(),
            driver: "query-test".into(),
            has_analyze_data: analyze,
            raw_output: None,
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

struct FakeResolver {
    contexts: Shared<Vec<ResolvedContext>>,
    driver: Arc<dyn DatabaseDriver>,
}

#[async_trait]
impl ConnectionContextResolver for FakeResolver {
    async fn resolve(&self, context: DatabaseContext<'_>) -> Result<ResolvedConnection, String> {
        self.contexts.lock().unwrap().push((
            context.connection_id.into(),
            context.database.map(str::to_string),
            context.schema.map(str::to_string),
            context.table.map(str::to_string),
        ));
        let params = ConnectionParams {
            driver: "query-test".into(),
            database: DatabaseSelection::Single(context.database.unwrap_or("saved-db").into()),
            ..Default::default()
        };
        Ok(ResolvedConnection {
            saved: SavedConnection {
                id: context.connection_id.into(),
                name: "Query test".into(),
                params: params.clone(),
                group_id: None,
                sort_order: None,
                detect_json_in_text_columns: None,
                appearance: None,
            },
            params,
            driver: self.driver.clone(),
        })
    }
}

fn fixture() -> (
    FakeResolver,
    Shared<DriverCalls>,
    Shared<Vec<ResolvedContext>>,
) {
    let calls = Arc::new(Mutex::new(DriverCalls::default()));
    let contexts = Arc::new(Mutex::new(Vec::new()));
    (
        FakeResolver {
            contexts: contexts.clone(),
            driver: Arc::new(FakeDriver::new(calls.clone())),
        },
        calls,
        contexts,
    )
}

#[tokio::test]
async fn query_service_sanitizes_resolves_and_forwards_execution_context() {
    let (resolver, calls, contexts) = fixture();
    let state = QueryCancellationState::default();
    let result = QueryService::execute(
        &resolver,
        &state,
        "connection-1",
        "  SELECT “value”;;;  ",
        Some(25),
        None,
        Some("analytics"),
        Some("warehouse"),
    )
    .await
    .unwrap();

    assert_eq!(result.rows[0][0], serde_json::json!("SELECT \"value\""));
    assert_eq!(
        contexts.lock().unwrap().as_slice(),
        &[(
            "connection-1".into(),
            Some("warehouse".into()),
            Some("analytics".into()),
            None
        )]
    );
    assert_eq!(
        calls.lock().unwrap().execute.as_slice(),
        &[(
            "SELECT \"value\"".into(),
            Some(25),
            1,
            Some("analytics".into()),
            "warehouse".into()
        )]
    );
    assert!(state.handles.lock().unwrap().is_empty());
}

#[tokio::test]
async fn query_service_preserves_batch_progress_order_and_arguments() {
    let (resolver, calls, _) = fixture();
    let state = QueryCancellationState::default();
    let progress = Arc::new(Mutex::new(Vec::new()));
    let sink: Arc<BatchProgressFn> = {
        let progress = progress.clone();
        Arc::new(move |index, statement| {
            progress.lock().unwrap().push((
                index,
                statement.result.as_ref().unwrap().rows[0][0]
                    .as_str()
                    .unwrap()
                    .to_string(),
            ));
        })
    };

    QueryService::execute_batch(
        &resolver,
        &state,
        "connection-1",
        vec![" SELECT 1; ".into(), " SELECT 2;;; ".into()],
        None,
        Some(3),
        Some("public"),
        Some("db"),
        Some(sink),
    )
    .await
    .unwrap();

    assert_eq!(
        progress.lock().unwrap().as_slice(),
        &[(0, "SELECT 1".into()), (1, "SELECT 2".into())]
    );
    assert_eq!(
        calls.lock().unwrap().batch.as_slice(),
        &[(
            vec!["SELECT 1".into(), "SELECT 2".into()],
            None,
            3,
            Some("public".into()),
            "db".into()
        )]
    );
}

#[tokio::test]
async fn query_service_validates_explain_before_resolution_and_forwards_valid_queries() {
    let (resolver, calls, contexts) = fixture();
    let state = QueryCancellationState::default();
    let error = QueryService::explain(
        &resolver,
        &state,
        "connection-1",
        "CREATE TABLE no_plan(id int)",
        false,
        None,
        None,
    )
    .await
    .unwrap_err();
    assert!(error.starts_with("EXPLAIN is only supported for DML statements"));
    assert!(contexts.lock().unwrap().is_empty());

    let plan = QueryService::explain(
        &resolver,
        &state,
        "connection-1",
        " SELECT * FROM users; ",
        true,
        Some("public"),
        Some("app"),
    )
    .await
    .unwrap();
    assert_eq!(plan.original_query, "SELECT * FROM users");
    assert_eq!(
        calls.lock().unwrap().explain.as_slice(),
        &[(
            "SELECT * FROM users".into(),
            true,
            Some("public".into()),
            "app".into()
        )]
    );
}

#[tokio::test]
async fn query_service_routes_count_through_the_frozen_compatibility_owner() {
    let (resolver, calls, contexts) = fixture();
    let count = QueryService::count(
        &resolver,
        "connection-1",
        " SELECT * FROM users; ".into(),
        Some("public"),
        Some("app"),
    )
    .await
    .unwrap();
    assert_eq!(count, 0);
    assert_eq!(
        contexts.lock().unwrap().as_slice(),
        &[(
            "connection-1".into(),
            Some("app".into()),
            Some("public".into()),
            None
        )]
    );
    assert_eq!(
        calls.lock().unwrap().execute[0].0,
        "SELECT COUNT(*) FROM (SELECT * FROM users) as count_wrapper"
    );
}

#[tokio::test]
async fn query_service_cancels_every_registered_task_and_preserves_errors() {
    let state = QueryCancellationState::default();
    assert_eq!(
        QueryService::cancel(&state, "connection-1").unwrap_err(),
        "No running query found"
    );
    let first = tokio::spawn(std::future::pending::<()>());
    let second = tokio::spawn(std::future::pending::<()>());
    crate::infrastructure::cancellation::register_abort_handle(
        &state.handles,
        "connection-1".into(),
        Arc::new(first.abort_handle()),
    );
    crate::infrastructure::cancellation::register_abort_handle(
        &state.handles,
        "connection-1".into(),
        Arc::new(second.abort_handle()),
    );

    QueryService::cancel(&state, "connection-1").unwrap();
    assert!(first.await.unwrap_err().is_cancelled());
    assert!(second.await.unwrap_err().is_cancelled());
}

#[test]
fn target_query_services_are_available() {
    use super::{blob_wire_to_data_url, build_er_window, sanitize_user_query};

    let source = include_str!("mod.rs");
    assert!(!source.contains("tauri"));
    assert!(source.contains("table: None"));
    assert_eq!(sanitize_user_query(" SELECT “x”;;; "), "SELECT \"x\"");
    assert_eq!(
        blob_wire_to_data_url("BLOB:3:image/png:YWJj").unwrap(),
        "data:image/png;base64,YWJj"
    );
    let window = build_er_window("id", "name", "db", Some("table"), Some("public"));
    assert!(window.url.contains("focusTable=table"));
    assert!(window.url.contains("schema=public"));
}

#[test]
fn blob_service_preserves_wire_mime_and_file_stats_contracts() {
    use super::BlobService;
    use base64::Engine;

    let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    assert!(BlobService::detect_blob_mime(&encoded)
        .unwrap()
        .starts_with("BLOB:8:image/png:"));
    assert_eq!(
        BlobService::detect_mime_type(&encoded).unwrap(),
        "image/png"
    );

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("image.png");
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(
        BlobService::get_file_stats(&path).unwrap(),
        serde_json::json!({"size": 8, "mime": "image/png"})
    );
}

#[test]
fn blob_service_preserves_exact_open_and_read_errors() {
    use super::BlobService;

    let missing = std::path::Path::new("missing-blob-file");
    assert!(BlobService::get_file_stats(missing)
        .unwrap_err()
        .starts_with("Failed to open file: "));

    let dir = tempfile::tempdir().unwrap();
    let directory_error = BlobService::get_file_stats(dir.path()).unwrap_err();
    assert!(directory_error.starts_with("Failed to read file header: "));
}

#[tokio::test]
async fn blob_service_preserves_file_reference_and_data_url_workflow() {
    use super::BlobService;

    let dir = tempfile::tempdir().unwrap();
    let image = dir.path().join("image.png");
    let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    std::fs::write(&image, bytes).unwrap();
    assert_eq!(
        BlobService::load_from_file(image.clone(), 8).await.unwrap(),
        format!("BLOB_FILE_REF:8:image/png:{}", image.display())
    );
    assert_eq!(
        BlobService::read_file_as_data_url(image).await.unwrap(),
        "data:image/png;base64,iVBORw0KGgo="
    );
}
