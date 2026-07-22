use super::*;
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;
use zip::write::FileOptions;

#[test]
fn legacy_dump_import_orchestration_contract_is_preserved() {
    let source =
        fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/dump_commands.rs")).unwrap();
    assert!(source.contains("database: database.as_deref()"));
    assert!(source.contains("schema.unwrap_or_else(|| \"public\".to_string())"));
    assert!(source.contains("writeln!(writer, \"-- Nexora Dump\")"));
    assert!(source.contains("-- Structure for table {}"));
    assert!(source.contains("drop_table_if_exists"));
    assert!(source.contains("-- Data for table {}"));
    assert!(source.contains("insert_into_statement"));
    assert!(source.contains("if zipped_file.name().ends_with(\".sql\")"));
    assert!(source.contains("Error at statement {}: {}\\nQuery: {}"));
    assert!(source.contains("const PROGRESS_EMIT_INTERVAL: usize = 500"));
    assert!(source.contains("\"Starting import...\".to_string()"));
    assert!(source.contains("\"Import completed\".to_string()"));
    assert!(source.contains("fn import_slot_key(connection_id: &str)"));
    assert!(source.contains("format!(\"{}_import\", connection_id)"));
    assert!(source.contains("for handle in entries {\n        handle.abort();"));
    assert!(source.contains("No active dump process found"));
    assert!(source.contains("No active import process found"));
    assert!(source.contains("Err(_) => Err(\"Dump cancelled\".into())"));
    assert!(source.contains("Err(_) => Err(\"Import cancelled\".into())"));
}

#[test]
fn test_zip_import_logic() {
    // This test simulates creating a zip file and verifying we can read it using the same logic as the command
    let dir = tempdir().unwrap();
    let zip_path = dir.path().join("test.zip");
    let file = File::create(&zip_path).unwrap();

    let mut zip = zip::ZipWriter::new(file);
    let options: FileOptions<()> =
        FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("data.sql", options).unwrap();
    zip.write_all(b"INSERT INTO test VALUES (1);").unwrap();
    zip.finish().unwrap();

    // Now try to read it back
    let file = File::open(&zip_path).unwrap();
    let mut archive = zip::ZipArchive::new(file).unwrap();

    let mut sql_file_index = None;
    for i in 0..archive.len() {
        let file = archive.by_index(i).unwrap();
        if file.name().ends_with(".sql") {
            sql_file_index = Some(i);
            break;
        }
    }

    assert!(sql_file_index.is_some());

    let mut content = Vec::new();
    let mut file = archive.by_index(sql_file_index.unwrap()).unwrap();
    std::io::Read::read_to_end(&mut file, &mut content).unwrap();

    let sql = String::from_utf8(content).unwrap();
    assert_eq!(sql, "INSERT INTO test VALUES (1);");
}

#[test]
fn test_escape_sql_value() {
    assert_eq!(escape_sql_value(json!(null)), "NULL");
    assert_eq!(escape_sql_value(json!(123)), "123");
    assert_eq!(escape_sql_value(json!(12.34)), "12.34");
    assert_eq!(escape_sql_value(json!(true)), "1");
    assert_eq!(escape_sql_value(json!(false)), "0");
    assert_eq!(escape_sql_value(json!("hello")), "'hello'");
    assert_eq!(escape_sql_value(json!("O'Reilly")), "'O''Reilly'");
    assert_eq!(escape_sql_value(json!("Back\\slash")), "'Back\\\\slash'");
    assert_eq!(escape_sql_value(json!("Multi\nLine")), "'Multi\nLine'");
}
