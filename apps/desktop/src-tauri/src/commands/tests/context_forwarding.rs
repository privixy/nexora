use crate::commands::{resolve_connection_params, resolve_connection_params_with_id};
use crate::domains::connections::{ConnectionContextResolver, DatabaseContext, ResolvedConnection};
use crate::models::{ConnectionParams, DatabaseSelection};

fn params() -> ConnectionParams {
    ConnectionParams {
        driver: "mysql".into(),
        host: Some("db.example.com".into()),
        port: Some(3306),
        database: DatabaseSelection::Single("original".into()),
        ..Default::default()
    }
}

#[test]
fn resolution_preserves_explicit_context_without_tunnels() {
    let original = params();
    let resolved = resolve_connection_params(&original).unwrap();
    assert_eq!(resolved.host, original.host);
    assert_eq!(resolved.port, original.port);
    assert_eq!(resolved.database.primary(), "original");
    assert_eq!(resolved.connection_id, None);
}

#[test]
fn resolution_with_id_preserves_database_and_sets_pool_identity() {
    let resolved = resolve_connection_params_with_id(&params(), "conn-1").unwrap();
    assert_eq!(resolved.database.primary(), "original");
    assert_eq!(resolved.connection_id.as_deref(), Some("conn-1"));
}

#[derive(Default)]
struct CapturingResolver {
    contexts: std::sync::Mutex<Vec<(String, Option<String>, Option<String>, Option<String>)>>,
}

#[async_trait::async_trait]
impl ConnectionContextResolver for CapturingResolver {
    async fn resolve(&self, context: DatabaseContext<'_>) -> Result<ResolvedConnection, String> {
        self.contexts.lock().unwrap().push((
            context.connection_id.to_string(),
            context.database.map(str::to_string),
            context.schema.map(str::to_string),
            context.table.map(str::to_string),
        ));
        Err("captured".into())
    }
}

#[tokio::test]
async fn resolver_receives_exact_record_context_tuple() {
    let resolver = CapturingResolver::default();
    let result = resolver
        .resolve(DatabaseContext {
            connection_id: "conn-2",
            database: Some("analytics"),
            schema: Some("reporting"),
            table: Some("monthly_sales"),
        })
        .await;
    assert!(matches!(result, Err(error) if error == "captured"));
    assert_eq!(
        resolver.contexts.into_inner().unwrap(),
        vec![(
            "conn-2".into(),
            Some("analytics".into()),
            Some("reporting".into()),
            Some("monthly_sales".into()),
        )]
    );
}

#[test]
fn command_owners_route_exact_context_through_shared_resolver() {
    let source_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    assert!(!source_root.join("commands/legacy.rs").exists());

    for (file, fields) in [
        (
            "commands/catalog.rs",
            ["database.as_deref()", "schema.as_deref()", "None"],
        ),
        (
            "commands/queries.rs",
            ["database.as_deref()", "schema.as_deref()", "None"],
        ),
        (
            "commands/records.rs",
            [
                "database.as_deref()",
                "schema.as_deref()",
                "Some(table.as_str())",
            ],
        ),
        (
            "commands/blobs.rs",
            [
                "database.as_deref()",
                "schema.as_deref()",
                "Some(table.as_str())",
            ],
        ),
        (
            "commands/ddl.rs",
            [
                "database.as_deref()",
                "schema.as_deref()",
                "Some(table.as_str())",
            ],
        ),
        (
            "commands/routines.rs",
            ["database.as_deref()", "schema.as_deref()", "None"],
        ),
        (
            "commands/triggers.rs",
            ["database.as_deref()", "schema.as_deref()", "None"],
        ),
        (
            "commands/views.rs",
            ["database.as_deref()", "schema.as_deref()", "None"],
        ),
        ("commands/connection_lifecycle.rs", ["None", "None", "None"]),
        ("export.rs", ["database.as_deref()", "None", "None"]),
        (
            "dump_commands.rs",
            ["database.as_deref()", "schema.as_deref()", "None"],
        ),
        (
            "clipboard_import.rs",
            [
                "None",
                "req.schema.as_deref()",
                "Some(req.table_name.as_str())",
            ],
        ),
    ] {
        let source = std::fs::read_to_string(source_root.join(file)).unwrap();
        assert!(source.contains("TauriConnectionContextResolver"), "{file}");
        if file != "commands/connection_lifecycle.rs" {
            assert!(
                !source.contains("expand_ssh_connection_params"),
                "{file} must not retain the repeated connection resolution chain"
            );
            assert!(
                !source.contains("resolve_connection_params_with_id"),
                "{file} must not retain the repeated connection resolution chain"
            );
        }
        for field in fields {
            assert!(source.contains(field), "{file} must forward {field}");
        }
    }
}

#[tokio::test]
async fn resolver_does_not_infer_missing_fields_or_stale_database() {
    let resolver = CapturingResolver::default();
    let _ = resolver
        .resolve(DatabaseContext {
            connection_id: "conn-2",
            database: Some("selected"),
            schema: None,
            table: None,
        })
        .await;
    let _ = resolver
        .resolve(DatabaseContext {
            connection_id: "conn-2",
            database: None,
            schema: Some("reporting"),
            table: Some("monthly_sales"),
        })
        .await;
    assert_eq!(
        resolver.contexts.into_inner().unwrap(),
        vec![
            ("conn-2".into(), Some("selected".into()), None, None),
            (
                "conn-2".into(),
                None,
                Some("reporting".into()),
                Some("monthly_sales".into()),
            ),
        ]
    );
}
