use crate::commands::{detect_blob_mime, detect_mime_type, get_file_stats, read_file_as_data_url};
use base64::Engine;

#[test]
fn detects_blob_wire_format_without_database_access() {
    let encoded = base64::engine::general_purpose::STANDARD.encode([0x89, b'P', b'N', b'G']);
    let wire = detect_blob_mime(encoded).unwrap();
    assert!(wire.starts_with("BLOB:4:"));
}

#[test]
fn rejects_invalid_blob_base64() {
    assert!(detect_blob_mime("not-base64".into())
        .unwrap_err()
        .starts_with("Invalid base64:"));
}

#[test]
fn detects_png_mime_and_reports_file_stats() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("image.png");
    let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    std::fs::write(&path, bytes).unwrap();

    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    assert_eq!(detect_mime_type(encoded).unwrap(), "image/png");
    assert_eq!(
        get_file_stats(path.to_string_lossy().into_owned()).unwrap(),
        serde_json::json!({"size": 8, "mime": "image/png"})
    );
}

#[tokio::test]
async fn reads_images_as_data_urls_and_rejects_other_files() {
    let dir = tempfile::tempdir().unwrap();
    let image = dir.path().join("image.png");
    let image_bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    std::fs::write(&image, image_bytes).unwrap();
    let expected = base64::engine::general_purpose::STANDARD.encode(image_bytes);
    assert_eq!(
        read_file_as_data_url(image.to_string_lossy().into_owned())
            .await
            .unwrap(),
        format!("data:image/png;base64,{expected}")
    );

    let text = dir.path().join("notes.txt");
    std::fs::write(&text, b"not an image").unwrap();
    assert_eq!(
        read_file_as_data_url(text.to_string_lossy().into_owned())
            .await
            .unwrap_err(),
        "Not an image file: application/octet-stream"
    );
}
