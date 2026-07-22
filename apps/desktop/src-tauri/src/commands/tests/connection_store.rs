use crate::commands::set_appearance_impl;
use crate::models::{
    ConnectionAppearance, ConnectionParams, ConnectionsFile, DatabaseSelection, IconOverride,
    SavedConnection,
};

fn connection(appearance: Option<ConnectionAppearance>) -> SavedConnection {
    SavedConnection {
        id: "conn-1".into(),
        name: "Connection".into(),
        params: ConnectionParams {
            driver: "mysql".into(),
            database: DatabaseSelection::Single("database".into()),
            ..Default::default()
        },
        group_id: None,
        sort_order: None,
        detect_json_in_text_columns: None,
        appearance,
    }
}

#[test]
fn appearance_updates_and_clears_existing_connection() {
    let mut file = ConnectionsFile {
        groups: Vec::new(),
        connections: vec![connection(None)],
    };
    let appearance = ConnectionAppearance {
        accent_color: Some("#00ff00".into()),
        icon: Some(IconOverride::Pack {
            id: "server".into(),
        }),
    };

    set_appearance_impl(&mut file, "conn-1", Some(appearance)).unwrap();
    let stored = file.connections[0].appearance.as_ref().unwrap();
    assert_eq!(stored.accent_color.as_deref(), Some("#00ff00"));
    assert!(matches!(&stored.icon, Some(IconOverride::Pack { id }) if id == "server"));
    set_appearance_impl(&mut file, "conn-1", None).unwrap();
    assert!(file.connections[0].appearance.is_none());
}

#[test]
fn appearance_rejects_unknown_connection() {
    let mut file = ConnectionsFile {
        groups: Vec::new(),
        connections: vec![connection(None)],
    };
    assert_eq!(
        set_appearance_impl(&mut file, "missing", None).unwrap_err(),
        "Connection not found"
    );
}
