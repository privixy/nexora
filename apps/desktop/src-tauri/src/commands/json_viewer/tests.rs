use super::*;
use serde_json::json;

#[test]
fn insert_and_retrieve_session() {
    let store = JsonViewerStore::default();
    {
        let mut guard = store.sessions.lock().unwrap();
        guard.insert(
            "sess-1".into(),
            JsonViewerSession {
                value: json!({"key": "value"}),
                original_value: json!({"key": "value"}),
                col_name: "metadata".into(),
                read_only: false,
                cell_key: None,
            },
        );
    }
    let guard = store.sessions.lock().unwrap();
    let session = guard.get("sess-1").unwrap();
    assert_eq!(session.col_name, "metadata");
    assert_eq!(session.value, json!({"key": "value"}));
    assert!(!session.read_only);
}

#[test]
fn cell_index_tracks_active_session() {
    let store = JsonViewerStore::default();
    {
        let mut sessions = store.sessions.lock().unwrap();
        sessions.insert(
            "sess-2".into(),
            JsonViewerSession {
                value: json!([1, 2, 3]),
                original_value: json!([1, 2, 3]),
                col_name: "tags".into(),
                read_only: false,
                cell_key: Some("pk:42:tags".into()),
            },
        );
        let mut index = store.cell_index.lock().unwrap();
        index.insert("pk:42:tags".into(), "sess-2".into());
    }
    let index = store.cell_index.lock().unwrap();
    assert_eq!(index.get("pk:42:tags"), Some(&"sess-2".to_string()));
}

#[test]
fn bounds_round_trip() {
    let store = JsonViewerStore::default();
    {
        let mut bounds = store.last_bounds.lock().unwrap();
        *bounds = Some(WindowBounds {
            x: 100,
            y: 200,
            width: 800,
            height: 600,
        });
    }
    let bounds = store.last_bounds.lock().unwrap();
    let b = bounds.unwrap();
    assert_eq!(b.x, 100);
    assert_eq!(b.y, 200);
    assert_eq!(b.width, 800);
    assert_eq!(b.height, 600);
}

#[test]
fn missing_session_returns_none() {
    let store = JsonViewerStore::default();
    let guard = store.sessions.lock().unwrap();
    assert!(guard.get("no-such-session").is_none());
}
