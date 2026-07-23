use crate::models::{
    single_db_before_multi_transition, ConnectionAppearance, DatabaseSelection, IconOverride,
    SavedConnection,
};

#[test]
fn single_to_multi_returns_previous_name() {
    let previous = DatabaseSelection::Single("app".into());
    let new = DatabaseSelection::Multiple(vec!["app".into(), "logs".into()]);
    assert_eq!(
        single_db_before_multi_transition(&previous, &new),
        Some("app".into())
    );
}

#[test]
fn multiple_with_one_element_treated_as_single() {
    let previous = DatabaseSelection::Multiple(vec!["app".into()]);
    let new = DatabaseSelection::Multiple(vec!["app".into(), "logs".into()]);
    assert_eq!(
        single_db_before_multi_transition(&previous, &new),
        Some("app".into())
    );
}

#[test]
fn multi_to_multi_returns_none() {
    let previous = DatabaseSelection::Multiple(vec!["a".into(), "b".into()]);
    let new = DatabaseSelection::Multiple(vec!["a".into(), "b".into(), "c".into()]);
    assert_eq!(single_db_before_multi_transition(&previous, &new), None);
}

#[test]
fn single_to_single_returns_none() {
    let previous = DatabaseSelection::Single("a".into());
    let new = DatabaseSelection::Single("b".into());
    assert_eq!(single_db_before_multi_transition(&previous, &new), None);
}

#[test]
fn single_to_multiple_with_one_item_returns_none() {
    let previous = DatabaseSelection::Single("app".into());
    let new = DatabaseSelection::Multiple(vec!["app".into()]);
    assert_eq!(single_db_before_multi_transition(&previous, &new), None);
}

#[test]
fn empty_previous_name_returns_none() {
    let previous = DatabaseSelection::Single("".into());
    let new = DatabaseSelection::Multiple(vec!["a".into(), "b".into()]);
    assert_eq!(single_db_before_multi_transition(&previous, &new), None);
}

#[test]
fn whitespace_previous_name_is_ignored() {
    let previous = DatabaseSelection::Single("   ".into());
    let new = DatabaseSelection::Multiple(vec!["a".into(), "b".into()]);
    assert_eq!(single_db_before_multi_transition(&previous, &new), None);
}

#[test]
fn icon_override_pack_roundtrip() {
    let value = IconOverride::Pack { id: "server".into() };
    let json = serde_json::to_string(&value).unwrap();
    assert_eq!(json, r#"{"type":"pack","id":"server"}"#);
    let roundtrip: IconOverride = serde_json::from_str(&json).unwrap();
    assert!(matches!(roundtrip, IconOverride::Pack { id } if id == "server"));
}

#[test]
fn icon_override_emoji_roundtrip() {
    let value = IconOverride::Emoji { value: "🐘".into() };
    let json = serde_json::to_string(&value).unwrap();
    assert_eq!(json, r#"{"type":"emoji","value":"🐘"}"#);
    let roundtrip: IconOverride = serde_json::from_str(&json).unwrap();
    assert!(matches!(roundtrip, IconOverride::Emoji { value } if value == "🐘"));
}

#[test]
fn icon_override_image_roundtrip() {
    let value = IconOverride::Image { path: "connection-icons/abc.png".into() };
    let json = serde_json::to_string(&value).unwrap();
    assert_eq!(json, r#"{"type":"image","path":"connection-icons/abc.png"}"#);
    let roundtrip: IconOverride = serde_json::from_str(&json).unwrap();
    assert!(matches!(roundtrip, IconOverride::Image { path } if path == "connection-icons/abc.png"));
}

#[test]
fn saved_connection_without_appearance_deserializes() {
    let json = r#"{"id":"1","name":"x","params":{"driver":"mysql","database":""}}"#;
    let connection: SavedConnection = serde_json::from_str(json).unwrap();
    assert!(connection.appearance.is_none());
}

#[test]
fn connection_appearance_with_only_color_serializes_compactly() {
    let appearance = ConnectionAppearance { icon: None, accent_color: Some("#ff0000".into()) };
    assert_eq!(serde_json::to_string(&appearance).unwrap(), r##"{"accentColor":"#ff0000"}"##);
}
