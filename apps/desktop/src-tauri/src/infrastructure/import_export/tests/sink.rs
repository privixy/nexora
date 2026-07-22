use super::super::{CsvSink, JsonSink, RowSink};
use serde_json::{json, Value};

#[test]
fn csv_and_json_bytes_are_preserved() {
    let headers = vec!["id".to_string(), "name".to_string()];

    let mut csv = Vec::new();
    {
        let mut sink = CsvSink::new(&mut csv, b',');
        sink.write_row(&headers, &[json!(1), json!("alice")])
            .unwrap();
        sink.finish().unwrap();
    }
    assert_eq!(String::from_utf8(csv).unwrap(), "id,name\n1,alice\n");

    let mut json_output = Vec::new();
    {
        let mut sink = JsonSink::new(&mut json_output);
        sink.write_row(&headers, &[json!(1)]).unwrap();
        sink.finish().unwrap();
    }
    let parsed: Value = serde_json::from_slice(&json_output).unwrap();
    assert_eq!(parsed, json!([{"id": 1, "name": null}]));
}

#[test]
fn empty_json_stream_is_an_empty_array() {
    let mut output = Vec::new();
    JsonSink::new(&mut output).finish().unwrap();
    assert_eq!(output, b"[]");
}
