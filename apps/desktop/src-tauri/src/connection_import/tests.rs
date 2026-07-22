use super::*;

mod importers;

#[test]
fn registry_has_unique_ids() {
    let importers = all_importers();
    let mut ids: Vec<&str> = importers.iter().map(|i| i.id()).collect();
    ids.sort_unstable();
    let len = ids.len();
    ids.dedup();
    assert_eq!(ids.len(), len, "importer ids must be unique");
    assert!(importer_by_id("dbeaver").is_some());
}

#[test]
fn resolve_key_path_rules() {
    assert_eq!(resolve_key_path("/abs/key"), "/abs/key");
    assert_eq!(resolve_key_path("~/keys/id"), "~/keys/id");
    assert_eq!(resolve_key_path("id_rsa"), "~/.ssh/id_rsa");
    assert_eq!(resolve_key_path(""), "");
}
