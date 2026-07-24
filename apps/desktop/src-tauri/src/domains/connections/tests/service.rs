use super::super::ConnectionService;
use std::sync::{Arc, Mutex};

#[tokio::test]
async fn disconnect_preserves_unregister_resolve_close_emit_order() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let unregister_calls = calls.clone();
    let resolve_calls = calls.clone();
    let close_calls = calls.clone();
    let emit_calls = calls.clone();

    ConnectionService::disconnect(
        "connection-id",
        move |id| {
            unregister_calls
                .lock()
                .unwrap()
                .push(format!("unregister:{id}"));
            async {}
        },
        move |id| {
            resolve_calls.lock().unwrap().push(format!("resolve:{id}"));
            async { Ok("resolved") }
        },
        move |resolved, id| {
            close_calls
                .lock()
                .unwrap()
                .push(format!("close:{resolved}:{id}"));
            async {}
        },
        move || async move {
            emit_calls.lock().unwrap().push("emit".to_string());
        },
    )
    .await
    .unwrap();

    assert_eq!(
        *calls.lock().unwrap(),
        vec![
            "unregister:connection-id",
            "resolve:connection-id",
            "close:resolved:connection-id",
            "emit",
        ]
    );
}

#[tokio::test]
async fn disconnect_propagates_resolution_errors_without_closing_or_emitting() {
    let calls = Arc::new(Mutex::new(Vec::new()));
    let unregister_calls = calls.clone();
    let resolve_calls = calls.clone();
    let close_calls = calls.clone();
    let emit_calls = calls.clone();

    let error = ConnectionService::disconnect(
        "connection-id",
        move |_| {
            unregister_calls
                .lock()
                .unwrap()
                .push("unregister".to_string());
            async {}
        },
        move |_| {
            resolve_calls.lock().unwrap().push("resolve".to_string());
            async { Err::<(), _>("resolve failed".to_string()) }
        },
        move |_, _| {
            close_calls.lock().unwrap().push("close".to_string());
            async {}
        },
        move || async move {
            emit_calls.lock().unwrap().push("emit".to_string());
        },
    )
    .await
    .unwrap_err();

    assert_eq!(error, "resolve failed");
    assert_eq!(*calls.lock().unwrap(), vec!["unregister", "resolve"]);
}
