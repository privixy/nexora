use super::*;

#[test]
fn window_label_is_tab_scoped() {
    assert_eq!(window_label("abc"), "results-window-abc");
    assert_eq!(window_label("tab-123"), "results-window-tab-123");
    // Distinct tabs must map to distinct labels (each gets its own window).
    assert_ne!(window_label("a"), window_label("b"));
}

#[test]
fn bounds_are_remembered_per_tab() {
    let store = ResultsWindowStore::default();
    {
        let mut bounds = store.bounds.lock().unwrap();
        bounds.insert(
            "tab-a".to_string(),
            WindowBounds {
                x: 100,
                y: 200,
                width: 800,
                height: 600,
            },
        );
        bounds.insert(
            "tab-b".to_string(),
            WindowBounds {
                x: 10,
                y: 20,
                width: 400,
                height: 300,
            },
        );
    }
    let bounds = store.bounds.lock().unwrap();
    let a = bounds.get("tab-a").unwrap();
    assert_eq!((a.x, a.y, a.width, a.height), (100, 200, 800, 600));
    let b = bounds.get("tab-b").unwrap();
    assert_eq!((b.x, b.y, b.width, b.height), (10, 20, 400, 300));
}

#[test]
fn bounds_default_is_empty() {
    let store = ResultsWindowStore::default();
    assert!(store.bounds.lock().unwrap().is_empty());
}
