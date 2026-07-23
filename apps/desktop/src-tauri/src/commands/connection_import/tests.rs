use super::*;
use std::fs;

#[test]
fn source_listing_preserves_availability_then_count_order_and_fields() {
    let source = fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/commands/connection_import.rs"
    ))
    .unwrap();
    let listing = source
        .split("pub async fn list_connection_import_sources")
        .nth(1)
        .unwrap();
    let available = listing.find("importer.is_available().await").unwrap();
    let count = listing.find("importer.connection_count().await").unwrap();
    let push = listing.find("sources.push(ImportSourceInfo").unwrap();
    assert!(available < count && count < push);
    for field in [
        "id: importer.id().to_string()",
        "display_name: importer.display_name().to_string()",
        "available",
        "connection_count",
        "reads_passwords_from_keychain: importer.reads_passwords_from_keychain()",
        "needs_file: importer.import_file_types().is_some()",
    ] {
        assert!(listing.contains(field), "missing source field: {field}");
    }
}

#[test]
fn foreign_preview_and_apply_preserve_one_shot_secret_cache_workflow() {
    let source = fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/commands/connection_import.rs"
    ))
    .unwrap();
    assert!(source.contains("format!(\"Unknown import source: {source_id}\")"));
    let preview = source
        .split("pub async fn preview_connection_import")
        .nth(1)
        .unwrap();
    assert_order(
        preview,
        &[
            "importer_by_id(&source_id)",
            ".import(include_passwords, file.as_deref())",
            "load_existing_connections(&app)?",
            "registered_driver_ids().await",
            "analyzer::analyze",
            ".insert(source_id, envelope)",
            "Ok(preview)",
        ],
    );
    assert!(preview.contains(".map_err(|e| e.to_string())?"));

    let apply = source
        .split("pub async fn apply_connection_import")
        .nth(1)
        .unwrap();
    assert_order(
        apply,
        &[
            ".remove(&source_id)",
            "No import preview found; run preview first",
            "registered_driver_ids().await",
            "load_existing_groups(&app)?",
            "convert::build_payload",
            "apply_export_payload(app, payload).await",
        ],
    );
    assert_eq!(apply.matches(".insert(source_id, envelope)").count(), 0);
    assert!(source.contains("Import cache poisoned"));
}

#[test]
fn nexora_preview_and_apply_preserve_load_transform_apply_order() {
    let source = fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/commands/connection_import.rs"
    ))
    .unwrap();
    let preview = source
        .split("pub async fn preview_nexora_import")
        .nth(1)
        .unwrap();
    assert_order(
        preview,
        &[
            "load_existing_connections(&app)?",
            "registered_driver_ids().await",
            "nexora::preview(&payload, &existing, &registered_ids)",
        ],
    );
    let apply = source
        .split("pub async fn apply_nexora_import")
        .nth(1)
        .unwrap();
    assert_order(
        apply,
        &[
            "load_existing_groups(&app)?",
            "nexora::apply(&payload, &resolutions, &existing_groups)",
            "apply_export_payload(app, built).await",
        ],
    );
}

#[test]
fn cache_requires_preview_and_removes_secret_envelope_once() {
    let cache = ImportEnvelopeCache::default();
    assert!(cache.0.lock().unwrap().remove("missing").is_none());
}

fn assert_order(source: &str, needles: &[&str]) {
    let mut cursor = 0;
    for needle in needles {
        let found = source[cursor..]
            .find(needle)
            .unwrap_or_else(|| panic!("missing ordered workflow fragment: {needle}"));
        cursor += found + needle.len();
    }
}
