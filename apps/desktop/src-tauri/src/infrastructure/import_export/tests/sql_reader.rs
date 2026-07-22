use super::super::{create_sql_reader, SqlStatementStream};
use std::fs::File;
use std::io::{Cursor, Read, Write};
use tempfile::tempdir;
use zip::write::FileOptions;

#[test]
fn statement_stream_preserves_comments_empty_lines_and_semicolons() {
    let input =
        b"-- comment\n\nCREATE TABLE test (id INT);\nINSERT INTO test\nVALUES (1);\nSELECT 1";
    let mut stream = SqlStatementStream::new(Cursor::new(input));
    assert_eq!(
        stream.next_statement().unwrap().as_deref(),
        Some("CREATE TABLE test (id INT);")
    );
    assert_eq!(
        stream.next_statement().unwrap().as_deref(),
        Some("INSERT INTO test\nVALUES (1);")
    );
    assert_eq!(
        stream.next_statement().unwrap().as_deref(),
        Some("SELECT 1")
    );
    assert_eq!(stream.next_statement().unwrap(), None);
}

#[test]
fn reader_preserves_regular_and_first_sql_zip_selection() {
    let dir = tempdir().unwrap();
    let sql_path = dir.path().join("data.sql");
    std::fs::write(&sql_path, "SELECT 1;").unwrap();
    let mut regular =
        create_sql_reader(File::open(&sql_path).unwrap(), sql_path.to_str().unwrap()).unwrap();
    let mut content = String::new();
    regular.read_to_string(&mut content).unwrap();
    assert_eq!(content, "SELECT 1;");

    let zip_path = dir.path().join("data.zip");
    let mut zip = zip::ZipWriter::new(File::create(&zip_path).unwrap());
    let options: FileOptions<()> = FileOptions::default();
    zip.start_file("ignored.txt", options).unwrap();
    zip.write_all(b"ignored").unwrap();
    zip.start_file("first.sql", options).unwrap();
    zip.write_all(b"SELECT 2;").unwrap();
    zip.start_file("second.sql", options).unwrap();
    zip.write_all(b"SELECT 3;").unwrap();
    zip.finish().unwrap();

    let mut zipped =
        create_sql_reader(File::open(&zip_path).unwrap(), zip_path.to_str().unwrap()).unwrap();
    content.clear();
    zipped.read_to_string(&mut content).unwrap();
    assert_eq!(content, "SELECT 2;");
}

#[test]
fn reader_preserves_zip_errors() {
    let dir = tempdir().unwrap();
    let zip_path = dir.path().join("empty.zip");
    let zip = zip::ZipWriter::new(File::create(&zip_path).unwrap());
    zip.finish().unwrap();
    let error = create_sql_reader(File::open(&zip_path).unwrap(), zip_path.to_str().unwrap())
        .err()
        .unwrap();
    assert_eq!(error, "No .sql file found in zip archive");
}
