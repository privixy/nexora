#[test]
fn target_query_services_are_available() {
    use super::{blob_wire_to_data_url, build_er_window, sanitize_user_query};

    assert_eq!(sanitize_user_query(" SELECT “x”;;; "), "SELECT \"x\"");
    assert_eq!(
        blob_wire_to_data_url("BLOB:3:image/png:YWJj").unwrap(),
        "data:image/png;base64,YWJj"
    );
    let window = build_er_window("id", "name", "db", Some("table"), Some("public"));
    assert!(window.url.contains("focusTable=table"));
    assert!(window.url.contains("schema=public"));
}

#[test]
fn blob_service_preserves_wire_mime_and_file_stats_contracts() {
    use super::BlobService;
    use base64::Engine;

    let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    assert!(BlobService::detect_blob_mime(&encoded)
        .unwrap()
        .starts_with("BLOB:8:image/png:"));
    assert_eq!(
        BlobService::detect_mime_type(&encoded).unwrap(),
        "image/png"
    );

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("image.png");
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(
        BlobService::get_file_stats(&path).unwrap(),
        serde_json::json!({"size": 8, "mime": "image/png"})
    );
}

#[test]
fn blob_service_preserves_exact_open_and_read_errors() {
    use super::BlobService;

    let missing = std::path::Path::new("missing-blob-file");
    assert!(BlobService::get_file_stats(missing)
        .unwrap_err()
        .starts_with("Failed to open file: "));

    let dir = tempfile::tempdir().unwrap();
    let directory_error = BlobService::get_file_stats(dir.path()).unwrap_err();
    assert!(directory_error.starts_with("Failed to read file header: "));
}

#[tokio::test]
async fn blob_service_preserves_file_reference_and_data_url_workflow() {
    use super::BlobService;

    let dir = tempfile::tempdir().unwrap();
    let image = dir.path().join("image.png");
    let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    std::fs::write(&image, bytes).unwrap();
    assert_eq!(
        BlobService::load_from_file(image.clone(), 8).await.unwrap(),
        format!("BLOB_FILE_REF:8:image/png:{}", image.display())
    );
    assert_eq!(
        BlobService::read_file_as_data_url(image).await.unwrap(),
        "data:image/png;base64,iVBORw0KGgo="
    );
}
