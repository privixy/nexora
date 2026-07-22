use super::*;
use std::time::Duration;

async fn sleeper() -> tokio::task::JoinHandle<()> {
    tokio::spawn(async { tokio::time::sleep(Duration::from_secs(10)).await })
}

#[tokio::test]
async fn cancellation_interface_preserves_slot_semantics() {
    let handles = Mutex::new(AbortHandleMap::new());
    let task_a = sleeper().await;
    let task_b = sleeper().await;
    let handle_a = Arc::new(task_a.abort_handle());
    let handle_b = Arc::new(task_b.abort_handle());

    register_abort_handle(&handles, "slot".into(), handle_a.clone());
    register_abort_handle(&handles, "slot".into(), handle_b.clone());
    unregister_abort_handle(&handles, "slot", &handle_a);

    let drained = abort_slot(&handles, "slot");
    assert_eq!(drained.len(), 1);
    assert!(Arc::ptr_eq(&drained[0], &handle_b));
    assert!(abort_slot(&handles, "missing").is_empty());

    task_a.abort();
    task_b.abort();
    let _ = task_a.await;
    let _ = task_b.await;
}
