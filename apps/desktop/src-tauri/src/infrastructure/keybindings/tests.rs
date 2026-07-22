use super::*;
use serde_json::json;
use tempfile::tempdir;

#[test]
fn missing_file_returns_empty_object() {
    let dir = tempdir().unwrap();
    assert_eq!(load_keybindings(dir.path()).unwrap(), json!({}));
}

#[test]
fn save_creates_directory_and_pretty_json_round_trips() {
    let dir = tempdir().unwrap();
    let config_dir = dir.path().join("nested");
    let value = json!({"editor.save": ["Ctrl", "S"]});
    save_keybindings(&config_dir, &value).unwrap();
    assert_eq!(load_keybindings(&config_dir).unwrap(), value);
    assert_eq!(
        std::fs::read_to_string(config_dir.join("keybindings.json")).unwrap(),
        serde_json::to_string_pretty(&value).unwrap()
    );
}

#[test]
fn malformed_json_and_io_errors_are_returned() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("keybindings.json"), "{").unwrap();
    assert!(load_keybindings(dir.path()).is_err());

    let not_directory = dir.path().join("file");
    std::fs::write(&not_directory, "content").unwrap();
    assert!(save_keybindings(&not_directory, &json!({})).is_err());
}
