use super::super::{parse_csv_delimiter, value_to_csv_string, ExportFormat, DEFAULT_CSV_DELIMITER};
use serde_json::{json, Value};

#[test]
fn format_and_delimiter_behavior_is_preserved() {
    assert_eq!(ExportFormat::parse("CSV").unwrap(), ExportFormat::Csv);
    assert_eq!(ExportFormat::parse(" json ").unwrap(), ExportFormat::Json);
    assert!(ExportFormat::parse("xml").unwrap_err().contains("xml"));
    assert_eq!(parse_csv_delimiter(None), DEFAULT_CSV_DELIMITER);
    assert_eq!(parse_csv_delimiter(Some("")), DEFAULT_CSV_DELIMITER);
    assert_eq!(parse_csv_delimiter(Some("|extra")), b'|');
}

#[test]
fn csv_value_conversion_is_preserved() {
    assert_eq!(value_to_csv_string(&json!("hello")), "hello");
    assert_eq!(value_to_csv_string(&Value::Null), "NULL");
    assert_eq!(value_to_csv_string(&json!(true)), "true");
    assert_eq!(value_to_csv_string(&json!({"a": 1})), r#"{"a":1}"#);
}
