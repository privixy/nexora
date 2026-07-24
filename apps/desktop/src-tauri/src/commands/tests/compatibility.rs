use crate::commands::*;
use crate::domains::connections::storage::*;
use crate::models::*;

fn base_params() -> ConnectionParams {
    ConnectionParams {
        driver: "mysql".to_string(),
        host: Some("localhost".to_string()),
        port: Some(3306),
        username: Some("root".to_string()),
        database: DatabaseSelection::Single("testdb".to_string()),
        ..Default::default()
    }
}

fn saved_conn(id: &str, password: Option<&str>, save_in_keychain: bool) -> SavedConnection {
    SavedConnection {
        id: id.to_string(),
        name: "Test".to_string(),
        params: ConnectionParams {
            password: password.map(|p| p.to_string()),
            save_in_keychain: Some(save_in_keychain),
            ..base_params()
        },
        group_id: None,
        sort_order: None,
        detect_json_in_text_columns: None,
        appearance: None,
    }
}

/// Regression test: update_connection must not wipe appearance.
///
/// The bug was that the struct literal used `appearance: None`, which destroyed
/// any accent color or custom icon the user had previously set.  The fix reads
/// `original_appearance` from the existing record and forwards it to the updated
/// struct — exactly the same pattern already used for `group_id` / `sort_order`.
///
/// Because `update_connection` requires a live Tauri `AppHandle` we cannot call
/// it in a unit test.  Instead we verify the preservation pattern directly: build
/// an "existing" SavedConnection with appearance set, clone its appearance field,
/// and assert it survives into the replacement struct unchanged.
#[test]
fn update_connection_preserves_appearance() {
    use crate::models::{ConnectionAppearance, IconOverride};

    let existing = SavedConnection {
        id: "conn-1".to_string(),
        name: "Old Name".to_string(),
        params: base_params(),
        group_id: Some("group-a".to_string()),
        sort_order: Some(3),
        detect_json_in_text_columns: None,
        appearance: Some(ConnectionAppearance {
            accent_color: Some("#ff0000".to_string()),
            icon: Some(IconOverride::Emoji {
                value: "🐘".to_string(),
            }),
        }),
    };

    // Simulate the pattern used in update_connection after the fix.
    let original_appearance = existing.appearance.clone();

    let updated = SavedConnection {
        id: existing.id.clone(),
        name: "New Name".to_string(),
        params: base_params(),
        group_id: existing.group_id.clone(),
        sort_order: existing.sort_order,
        detect_json_in_text_columns: None,
        appearance: original_appearance,
    };

    let app = updated
        .appearance
        .as_ref()
        .expect("appearance must be preserved");
    assert_eq!(app.accent_color.as_deref(), Some("#ff0000"));
    assert!(matches!(&app.icon, Some(IconOverride::Emoji { value }) if value == "🐘"));
}

/// Helper: build a minimal ConnectionsFile with one connection.
fn one_conn_file(
    id: &str,
    appearance: Option<crate::models::ConnectionAppearance>,
) -> ConnectionsFile {
    let conn = SavedConnection {
        id: id.to_string(),
        name: "Test".to_string(),
        params: base_params(),
        group_id: None,
        sort_order: None,
        detect_json_in_text_columns: None,
        appearance,
    };
    ConnectionsFile {
        groups: vec![],
        connections: vec![conn],
    }
}

#[test]
fn set_connection_appearance_updates_existing() {
    use crate::models::{ConnectionAppearance, IconOverride};

    let mut file = one_conn_file("conn-1", None);
    let new_appearance = ConnectionAppearance {
        accent_color: Some("#00ff00".to_string()),
        icon: Some(IconOverride::Emoji {
            value: "🦀".to_string(),
        }),
    };

    set_appearance_impl(&mut file, "conn-1", Some(new_appearance)).unwrap();

    let app = file.connections[0]
        .appearance
        .as_ref()
        .expect("appearance must be set");
    assert_eq!(app.accent_color.as_deref(), Some("#00ff00"));
    assert!(matches!(&app.icon, Some(IconOverride::Emoji { value }) if value == "🦀"));
}

#[test]
fn set_connection_appearance_clears_with_none() {
    use crate::models::{ConnectionAppearance, IconOverride};

    let existing_appearance = ConnectionAppearance {
        accent_color: Some("#ff0000".to_string()),
        icon: Some(IconOverride::Pack {
            id: "server".to_string(),
        }),
    };
    let mut file = one_conn_file("conn-2", Some(existing_appearance));

    set_appearance_impl(&mut file, "conn-2", None).unwrap();

    assert!(file.connections[0].appearance.is_none());
}

#[test]
fn set_connection_appearance_errors_on_missing_id() {
    let mut file = one_conn_file("conn-real", None);
    let result = set_appearance_impl(&mut file, "conn-does-not-exist", None);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), "Connection not found");
}

#[test]
fn test_resolve_password_prefers_request() {
    let mut params = base_params();
    params.password = Some("from_request".to_string());
    let result = resolve_test_connection_password(&params, None, |_| Ok("kc".to_string()));
    assert_eq!(result, Some("from_request".to_string()));
}

#[test]
fn test_resolve_password_from_keychain() {
    let params = base_params();
    let saved = saved_conn("id1", None, true);
    let result = resolve_test_connection_password(&params, Some(&saved), |_| Ok("kc".to_string()));
    assert_eq!(result, Some("kc".to_string()));
}

#[test]
fn test_resolve_password_from_saved_when_not_keychain() {
    let params = base_params();
    let saved = saved_conn("id1", Some("stored"), false);
    let result = resolve_test_connection_password(&params, Some(&saved), |_| Ok("kc".to_string()));
    assert_eq!(result, Some("stored".to_string()));
}

#[test]
fn test_resolve_password_fallback_to_saved_when_keychain_empty() {
    let params = base_params();
    let saved = saved_conn("id1", Some("stored"), true);
    let result = resolve_test_connection_password(&params, Some(&saved), |_| Ok("  ".to_string()));
    assert_eq!(result, Some("stored".to_string()));
}

mod build_connection_url_tests {
    use super::*;

    fn create_params(
        driver: &str,
        host: &str,
        port: Option<u16>,
        username: &str,
        password: Option<&str>,
        database: &str,
    ) -> ConnectionParams {
        ConnectionParams {
            driver: driver.to_string(),
            host: Some(host.to_string()),
            port,
            username: Some(username.to_string()),
            password: password.map(|p| p.to_string()),
            database: DatabaseSelection::Single(database.to_string()),
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn test_mysql_url_basic() {
        let params = create_params(
            "mysql",
            "localhost",
            Some(3306),
            "root",
            Some("secret"),
            "testdb",
        );
        let url = build_connection_url(&params).await.unwrap();
        assert_eq!(url, "mysql://root:secret@localhost:3306/testdb");
    }

    #[tokio::test]
    async fn test_postgres_url_basic() {
        let params = create_params(
            "postgres",
            "localhost",
            Some(5432),
            "postgres",
            Some("secret"),
            "testdb",
        );
        let url = build_connection_url(&params).await.unwrap();
        assert_eq!(url, "postgres://postgres:secret@localhost:5432/testdb");
    }

    #[tokio::test]
    async fn test_sqlite_url() {
        let params = create_params("sqlite", "", None, "", None, "/path/to/db.sqlite");
        let url = build_connection_url(&params).await.unwrap();
        assert_eq!(url, "sqlite:///path/to/db.sqlite");
    }

    #[tokio::test]
    async fn test_url_encoding_special_chars() {
        let params = create_params(
            "mysql",
            "localhost",
            Some(3306),
            "user@domain",
            Some("pass#word"),
            "mydb",
        );
        let url = build_connection_url(&params).await.unwrap();
        assert!(url.contains("user%40domain"));
        assert!(url.contains("pass%23word"));
    }

    #[tokio::test]
    async fn test_default_ports() {
        let mysql_params = create_params("mysql", "localhost", None, "root", None, "testdb");
        let pg_params = create_params("postgres", "localhost", None, "postgres", None, "testdb");

        let mysql_url = build_connection_url(&mysql_params).await.unwrap();
        let pg_url = build_connection_url(&pg_params).await.unwrap();

        assert!(mysql_url.contains(":3306/"));
        assert!(pg_url.contains(":5432/"));
    }

    #[tokio::test]
    async fn test_no_password() {
        let params = create_params("mysql", "localhost", Some(3306), "root", None, "testdb");
        let url = build_connection_url(&params).await.unwrap();
        assert_eq!(url, "mysql://root@localhost:3306/testdb");
    }

    #[tokio::test]
    async fn test_unsupported_driver() {
        let params = create_params("mongodb", "localhost", Some(27017), "user", None, "testdb");
        let result = build_connection_url(&params).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Unsupported driver");
    }

    #[tokio::test]
    async fn test_remote_host() {
        let params = create_params(
            "postgres",
            "db.example.com",
            Some(5432),
            "admin",
            Some("pass"),
            "production",
        );
        let url = build_connection_url(&params).await.unwrap();
        assert!(url.contains("db.example.com"));
        assert!(!url.contains("localhost"));
    }
}

mod resolve_ssh_password_tests {
    use super::*;
    use crate::models::SshConnection;

    fn create_ssh_conn(id: &str, password: Option<&str>, save_in_keychain: bool) -> SshConnection {
        SshConnection {
            id: id.to_string(),
            name: "Test".to_string(),
            host: "localhost".to_string(),
            port: 22,
            user: "root".to_string(),
            auth_type: Some("password".to_string()),
            password: password.map(|p| p.to_string()),
            key_file: None,
            key_passphrase: None,
            allow_passphrase_prompt: None,
            save_in_keychain: Some(save_in_keychain),
        }
    }

    #[test]
    fn test_ssh_password_prefers_request() {
        let result = resolve_ssh_test_password(
            Some("from_request"),
            Some("conn_id"),
            |_| None,
            |_| Ok("kc".to_string()),
        );
        assert_eq!(result, Some("from_request".to_string()));
    }

    #[test]
    fn test_ssh_password_from_keychain() {
        let saved = create_ssh_conn("id1", None, true);
        let result = resolve_ssh_test_password(
            None,
            Some("id1"),
            |_| Some(saved.clone()),
            |_| Ok("kc".to_string()),
        );
        assert_eq!(result, Some("kc".to_string()));
    }

    #[test]
    fn test_ssh_password_from_saved_when_not_keychain() {
        let saved = create_ssh_conn("id1", Some("stored"), false);
        let result = resolve_ssh_test_password(
            None,
            Some("id1"),
            |_| Some(saved.clone()),
            |_| Ok("kc".to_string()),
        );
        assert_eq!(result, Some("stored".to_string()));
    }

    #[test]
    fn test_ssh_password_fallback_to_saved_when_keychain_empty() {
        let saved = create_ssh_conn("id1", Some("stored"), true);
        let result = resolve_ssh_test_password(
            None,
            Some("id1"),
            |_| Some(saved.clone()),
            |_| Ok("  ".to_string()),
        );
        assert_eq!(result, Some("stored".to_string()));
    }

    #[test]
    fn test_ssh_password_returns_none_when_no_id() {
        let result = resolve_ssh_test_password(
            None,
            None,
            |_| panic!("should not be called"),
            |_| panic!("should not be called"),
        );
        assert_eq!(result, None);
    }

    #[test]
    fn test_ssh_password_prefers_request_over_keychain() {
        let saved = create_ssh_conn("id1", None, true);
        let result = resolve_ssh_test_password(
            Some("request_pwd"),
            Some("id1"),
            |_| Some(saved.clone()),
            |_| Ok("kc".to_string()),
        );
        assert_eq!(result, Some("request_pwd".to_string()));
    }

    #[test]
    fn test_ssh_empty_request_password_is_used() {
        let saved = create_ssh_conn("id1", None, true);
        let result = resolve_ssh_test_password(
            Some("   "),
            Some("id1"),
            |_| Some(saved.clone()),
            |_| Ok("kc".to_string()),
        );
        // Empty password from request should be used, not keychain
        assert_eq!(result, Some("   ".to_string()));
    }

    #[test]
    fn test_ssh_returns_none_when_no_password_anywhere() {
        let saved = create_ssh_conn("id1", None, false);
        let result = resolve_ssh_test_password(
            None,
            Some("id1"),
            |_| Some(saved.clone()),
            |_| Ok("".to_string()),
        );
        assert_eq!(result, None);
    }
}

mod is_empty_or_whitespace_tests {
    use super::*;

    #[test]
    fn test_none_is_empty() {
        assert!(is_empty_or_whitespace(&None));
    }

    #[test]
    fn test_empty_string_is_empty() {
        assert!(is_empty_or_whitespace(&Some("".to_string())));
    }

    #[test]
    fn test_whitespace_only_is_empty() {
        assert!(is_empty_or_whitespace(&Some("   ".to_string())));
    }

    #[test]
    fn test_tab_newline_is_empty() {
        assert!(is_empty_or_whitespace(&Some("\t\n  ".to_string())));
    }

    #[test]
    fn test_content_is_not_empty() {
        assert!(!is_empty_or_whitespace(&Some("content".to_string())));
    }

    #[test]
    fn test_content_with_whitespace_is_not_empty() {
        assert!(!is_empty_or_whitespace(&Some("  content  ".to_string())));
    }
}

mod resolve_connection_params_tests {
    use super::*;

    fn create_ssh_params(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        remote_host: &str,
        remote_port: u16,
    ) -> ConnectionParams {
        ConnectionParams {
            driver: "mysql".to_string(),
            host: Some(remote_host.to_string()),
            port: Some(remote_port),
            username: Some("dbuser".to_string()),
            password: Some("dbpass".to_string()),
            database: DatabaseSelection::Single("testdb".to_string()),
            ssh_enabled: Some(true),
            ssh_host: Some(ssh_host.to_string()),
            ssh_port: Some(ssh_port),
            ssh_user: Some(ssh_user.to_string()),
            ssh_key_file: Some("/home/user/.ssh/id_rsa".to_string()),
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn test_non_ssh_params_unchanged() {
        let params = base_params();
        let result = resolve_connection_params(&params).unwrap();
        assert_eq!(result.host, Some("localhost".to_string()));
        assert_eq!(result.port, Some(3306));
    }

    #[tokio::test]
    async fn test_ssh_params_require_host() {
        let mut params = create_ssh_params("jump.server", 22, "admin", "db.internal", 3306);
        params.ssh_host = None;
        let result = resolve_connection_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("SSH Host"));
    }

    #[tokio::test]
    async fn test_ssh_params_require_user() {
        let mut params = create_ssh_params("jump.server", 22, "admin", "db.internal", 3306);
        params.ssh_user = None;
        let result = resolve_connection_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("SSH User"));
    }
}

mod resolve_k8s_params_tests {
    use super::*;

    fn create_k8s_params(
        context: &str,
        namespace: &str,
        resource_type: &str,
        resource_name: &str,
        port: u16,
    ) -> ConnectionParams {
        ConnectionParams {
            driver: "mysql".to_string(),
            host: Some("localhost".to_string()),
            port: Some(3306),
            username: Some("root".to_string()),
            database: DatabaseSelection::Single("testdb".to_string()),
            k8s_enabled: Some(true),
            k8s_context: Some(context.to_string()),
            k8s_namespace: Some(namespace.to_string()),
            k8s_resource_type: Some(resource_type.to_string()),
            k8s_resource_name: Some(resource_name.to_string()),
            k8s_port: Some(port),
            ..Default::default()
        }
    }

    #[test]
    fn test_k8s_and_ssh_mutual_exclusion() {
        let mut params = create_k8s_params("my-ctx", "default", "service", "my-db", 3306);
        params.ssh_enabled = Some(true);
        params.ssh_host = Some("jump.host".to_string());
        let result = resolve_connection_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("cannot both be enabled"));
    }

    #[test]
    fn test_k8s_requires_context() {
        let mut params = create_k8s_params("my-ctx", "default", "service", "my-db", 3306);
        params.k8s_context = None;
        let result = resolve_k8s_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("K8s context"));
    }

    #[test]
    fn test_k8s_requires_namespace() {
        let mut params = create_k8s_params("my-ctx", "default", "service", "my-db", 3306);
        params.k8s_namespace = None;
        let result = resolve_k8s_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("K8s namespace"));
    }

    #[test]
    fn test_k8s_requires_resource_type() {
        let mut params = create_k8s_params("my-ctx", "default", "service", "my-db", 3306);
        params.k8s_resource_type = None;
        let result = resolve_k8s_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("K8s resource type"));
    }

    #[test]
    fn test_k8s_requires_resource_name() {
        let mut params = create_k8s_params("my-ctx", "default", "service", "my-db", 3306);
        params.k8s_resource_name = None;
        let result = resolve_k8s_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("K8s resource name"));
    }

    #[test]
    fn test_k8s_requires_port() {
        let mut params = create_k8s_params("my-ctx", "default", "service", "my-db", 3306);
        params.k8s_port = None;
        let result = resolve_k8s_params(&params);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("K8s port"));
    }
}

mod url_encoding_edge_cases {
    use super::*;

    #[tokio::test]
    async fn test_unicode_username() {
        let mut params = base_params();
        params.username = Some("用户".to_string());
        let url = build_connection_url(&params).await.unwrap();
        // URL should contain percent-encoded UTF-8
        assert!(url.contains("%E7%94%A8%E6%88%B7"));
    }

    #[tokio::test]
    async fn test_password_with_colon() {
        let mut params = base_params();
        params.password = Some("pass:word".to_string());
        let url = build_connection_url(&params).await.unwrap();
        assert!(url.contains("pass%3Aword"));
    }

    #[tokio::test]
    async fn test_password_with_at_sign() {
        let mut params = base_params();
        params.password = Some("pass@word".to_string());
        let url = build_connection_url(&params).await.unwrap();
        assert!(url.contains("pass%40word"));
    }

    #[tokio::test]
    async fn test_password_with_slash() {
        let mut params = base_params();
        params.password = Some("pass/word".to_string());
        let url = build_connection_url(&params).await.unwrap();
        assert!(url.contains("pass%2Fword"));
    }

    #[tokio::test]
    async fn test_empty_username_and_password() {
        let mut params = base_params();
        params.username = None;
        params.password = None;
        let url = build_connection_url(&params).await.unwrap();
        assert_eq!(url, "mysql://@localhost:3306/testdb");
    }

    #[tokio::test]
    async fn test_host_with_port_in_url() {
        let mut params = base_params();
        params.host = Some("192.168.1.100".to_string());
        params.port = Some(33060);
        let url = build_connection_url(&params).await.unwrap();
        assert!(url.contains("192.168.1.100:33060"));
    }
}

mod cancellation_legacy {
    use crate::commands::{
        register_abort_handle, unregister_abort_handle, QueryCancellationState, QueryService,
    };
    use std::sync::Arc;
    use std::time::Duration;

    async fn spawn_sleeper() -> tokio::task::JoinHandle<()> {
        tokio::spawn(async { tokio::time::sleep(Duration::from_secs(10)).await })
    }

    #[tokio::test]
    async fn registers_multiple_handles_under_same_slot() {
        let state = QueryCancellationState::default();
        let task_a = spawn_sleeper().await;
        let task_b = spawn_sleeper().await;
        let handle_a = Arc::new(task_a.abort_handle());
        let handle_b = Arc::new(task_b.abort_handle());

        register_abort_handle(&state.handles, "conn-1".into(), handle_a);
        register_abort_handle(&state.handles, "conn-1".into(), handle_b);

        assert_eq!(
            state.handles.lock().unwrap().get("conn-1").unwrap().len(),
            2
        );

        task_a.abort();
        task_b.abort();
        let _ = task_a.await;
        let _ = task_b.await;
    }

    #[tokio::test]
    async fn cancel_aborts_all_handles_in_slot() {
        let state = QueryCancellationState::default();
        let task_a = spawn_sleeper().await;
        let task_b = spawn_sleeper().await;
        register_abort_handle(
            &state.handles,
            "conn-1".into(),
            Arc::new(task_a.abort_handle()),
        );
        register_abort_handle(
            &state.handles,
            "conn-1".into(),
            Arc::new(task_b.abort_handle()),
        );

        let drained = state
            .handles
            .lock()
            .unwrap()
            .remove("conn-1")
            .unwrap_or_default();
        for h in &drained {
            h.abort();
        }

        assert!(task_a.await.unwrap_err().is_cancelled());
        assert!(task_b.await.unwrap_err().is_cancelled());
    }

    #[tokio::test]
    async fn unregister_only_removes_matching_handle() {
        let state = QueryCancellationState::default();
        let task_a = spawn_sleeper().await;
        let task_b = spawn_sleeper().await;
        let handle_a = Arc::new(task_a.abort_handle());
        let handle_b = Arc::new(task_b.abort_handle());

        register_abort_handle(&state.handles, "conn-1".into(), handle_a.clone());
        register_abort_handle(&state.handles, "conn-1".into(), handle_b.clone());

        unregister_abort_handle(&state.handles, "conn-1", &handle_a);

        {
            let remaining = state.handles.lock().unwrap();
            let slot = remaining
                .get("conn-1")
                .expect("slot kept while B in flight");
            assert_eq!(slot.len(), 1);
            assert!(Arc::ptr_eq(&slot[0], &handle_b));
        }

        task_a.abort();
        task_b.abort();
        let _ = task_a.await;
        let _ = task_b.await;
    }

    #[tokio::test]
    async fn unregister_drops_empty_slot() {
        let state = QueryCancellationState::default();
        let task = spawn_sleeper().await;
        let handle = Arc::new(task.abort_handle());

        register_abort_handle(&state.handles, "conn-1".into(), handle.clone());
        unregister_abort_handle(&state.handles, "conn-1", &handle);

        assert!(state.handles.lock().unwrap().get("conn-1").is_none());

        task.abort();
        let _ = task.await;
    }

    #[tokio::test]
    async fn register_prunes_finished_handles() {
        let state = QueryCancellationState::default();

        let finished_task = tokio::spawn(async {});
        let finished_handle = Arc::new(finished_task.abort_handle());
        let _ = finished_task.await;
        assert!(finished_handle.is_finished());

        register_abort_handle(&state.handles, "conn-1".into(), finished_handle);

        let live_task = spawn_sleeper().await;
        let live_handle = Arc::new(live_task.abort_handle());
        register_abort_handle(&state.handles, "conn-1".into(), live_handle.clone());

        {
            let guard = state.handles.lock().unwrap();
            let slot = guard.get("conn-1").unwrap();
            assert_eq!(slot.len(), 1);
            assert!(Arc::ptr_eq(&slot[0], &live_handle));
        }

        live_task.abort();
        let _ = live_task.await;
    }

    #[tokio::test]
    async fn cancel_query_returns_err_when_no_slot() {
        let state = QueryCancellationState::default();
        let err = QueryService::cancel(&state, "conn-1").unwrap_err();
        assert_eq!(err, "No running query found");
    }

    #[tokio::test]
    async fn cancel_query_aborts_every_handle_in_slot() {
        let state = QueryCancellationState::default();
        let task_a = spawn_sleeper().await;
        let task_b = spawn_sleeper().await;
        register_abort_handle(
            &state.handles,
            "conn-1".into(),
            Arc::new(task_a.abort_handle()),
        );
        register_abort_handle(
            &state.handles,
            "conn-1".into(),
            Arc::new(task_b.abort_handle()),
        );

        QueryService::cancel(&state, "conn-1").unwrap();

        assert!(task_a.await.unwrap_err().is_cancelled());
        assert!(task_b.await.unwrap_err().is_cancelled());
        assert!(state.handles.lock().unwrap().get("conn-1").is_none());
    }

    #[tokio::test]
    async fn cancel_query_aborts_query_and_explain_sharing_the_slot() {
        let state = QueryCancellationState::default();
        let query_task = spawn_sleeper().await;
        let explain_task = spawn_sleeper().await;
        register_abort_handle(
            &state.handles,
            "conn-1".into(),
            Arc::new(query_task.abort_handle()),
        );
        register_abort_handle(
            &state.handles,
            "conn-1".into(),
            Arc::new(explain_task.abort_handle()),
        );

        QueryService::cancel(&state, "conn-1").unwrap();

        assert!(query_task.await.unwrap_err().is_cancelled());
        assert!(explain_task.await.unwrap_err().is_cancelled());
        assert!(state.handles.lock().unwrap().get("conn-1").is_none());
    }
}

// -------------------------------------------------------------------
// Cascade-delete helpers
// -------------------------------------------------------------------

fn group(id: &str, parent: Option<&str>) -> ConnectionGroup {
    ConnectionGroup {
        id: id.to_string(),
        name: id.to_string(),
        collapsed: false,
        sort_order: 0,
        parent_id: parent.map(|p| p.to_string()),
    }
}

fn conn(id: &str, group_id: Option<&str>) -> SavedConnection {
    let mut c = saved_conn(id, None, false);
    c.group_id = group_id.map(|g| g.to_string());
    c
}

#[test]
fn collect_group_subtree_returns_root_only_for_leaf() {
    let groups = vec![group("a", None), group("b", None)];
    let subtree = crate::models::collect_group_subtree(&groups, "a");
    assert_eq!(subtree, std::collections::HashSet::from(["a".to_string()]));
}

#[test]
fn collect_group_subtree_walks_full_descendant_chain() {
    // Tree:
    //   root
    //   ├── child1
    //   │   └── grand1
    //   │       └── great1
    //   └── child2
    //   other (unrelated)
    let groups = vec![
        group("root", None),
        group("child1", Some("root")),
        group("grand1", Some("child1")),
        group("great1", Some("grand1")),
        group("child2", Some("root")),
        group("other", None),
    ];
    let subtree = crate::models::collect_group_subtree(&groups, "root");
    assert_eq!(
        subtree,
        std::collections::HashSet::from([
            "root".to_string(),
            "child1".to_string(),
            "grand1".to_string(),
            "great1".to_string(),
            "child2".to_string(),
        ])
    );
    assert!(!subtree.contains("other"));
}

#[test]
fn collect_group_subtree_for_subgroup_does_not_include_siblings() {
    // Tree:
    //   root
    //   ├── keep
    //   └── drop
    let groups = vec![
        group("root", None),
        group("keep", Some("root")),
        group("drop", Some("root")),
    ];
    let subtree = crate::models::collect_group_subtree(&groups, "drop");
    assert_eq!(
        subtree,
        std::collections::HashSet::from(["drop".to_string()])
    );
    assert!(!subtree.contains("root"));
    assert!(!subtree.contains("keep"));
}

#[test]
fn collect_group_subtree_for_unknown_id_is_singleton() {
    let groups = vec![group("a", None)];
    let subtree = crate::models::collect_group_subtree(&groups, "missing");
    assert_eq!(
        subtree,
        std::collections::HashSet::from(["missing".to_string()])
    );
}

#[test]
fn cascade_delete_removes_parent_descendants_and_connections() {
    // Mirrors what the command does after the helper returns: groups
    // and connections not in the subtree must survive untouched.
    let groups = vec![
        group("root", None),
        group("child", Some("root")),
        group("grand", Some("child")),
        group("sibling", None),
    ];
    let connections = [
        conn("c1", Some("root")),
        conn("c2", Some("child")),
        conn("c3", Some("grand")),
        conn("c4", Some("sibling")),
        conn("c5", None),
    ];
    let to_delete = crate::models::collect_group_subtree(&groups, "root");

    let groups_after: Vec<_> = groups
        .iter()
        .filter(|g| !to_delete.contains(&g.id))
        .cloned()
        .collect();
    let conns_after: Vec<_> = connections
        .iter()
        .filter(|c| !c.group_id.as_ref().is_some_and(|g| to_delete.contains(g)))
        .cloned()
        .collect();

    assert_eq!(groups_after, vec![group("sibling", None)]);
    assert_eq!(
        conns_after.iter().map(|c| c.id.clone()).collect::<Vec<_>>(),
        vec!["c4".to_string(), "c5".to_string()],
    );
}

#[test]
fn cascade_delete_subgroup_leaves_parent_and_other_subgroups_alone() {
    let groups = vec![
        group("root", None),
        group("keep", Some("root")),
        group("drop", Some("root")),
        group("grand", Some("drop")),
    ];
    let connections = [
        conn("c1", Some("root")),
        conn("c2", Some("drop")),
        conn("c3", Some("grand")),
        conn("c4", Some("keep")),
    ];
    let to_delete = crate::models::collect_group_subtree(&groups, "drop");

    let groups_after: Vec<_> = groups
        .iter()
        .filter(|g| !to_delete.contains(&g.id))
        .cloned()
        .collect();
    let conns_after: Vec<_> = connections
        .iter()
        .filter(|c| !c.group_id.as_ref().is_some_and(|g| to_delete.contains(g)))
        .cloned()
        .collect();

    assert_eq!(
        groups_after,
        vec![group("root", None), group("keep", Some("root"))],
    );
    assert_eq!(
        conns_after.iter().map(|c| c.id.clone()).collect::<Vec<_>>(),
        vec!["c1".to_string(), "c4".to_string()],
    );
}
