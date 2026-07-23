#[test]
fn target_interfaces_are_available() {
    use crate::infrastructure::health::{
        active_connections, emit_active_changed, register_connection, restart_ping_loop,
        start_ping_loop, stop_ping_loop, unregister_connection, ACTIVE_CONNECTIONS_CHANGED_EVENT,
        DEFAULT_PING_INTERVAL,
    };
    use crate::infrastructure::import_export::{
        create_sql_reader, parse_csv_delimiter, value_to_csv_string, CsvSink, ExportFormat,
        JsonSink, ProgressEmitter, RowSink, SqlStatementStream,
    };
    use crate::infrastructure::keybindings::{load_keybindings, save_keybindings};

    let _ = parse_csv_delimiter;
    let _ = value_to_csv_string;
    let _ = std::mem::size_of::<ExportFormat>();
    let _ = std::mem::size_of::<CsvSink<Vec<u8>>>();
    let _ = std::mem::size_of::<JsonSink<Vec<u8>>>();
    let _ = std::mem::size_of::<ProgressEmitter<fn(u64)>>();
    let _ = std::mem::size_of::<SqlStatementStream<std::io::Cursor<Vec<u8>>>>();
    type SqlReaderFactory =
        fn(std::fs::File, &str) -> Result<Box<dyn std::io::BufRead + Send>, String>;
    let _: SqlReaderFactory = create_sql_reader;
    let _ = load_keybindings;
    let _ = save_keybindings;
    let _ = register_connection;
    let _ = unregister_connection;
    let _ = active_connections;
    let _ = emit_active_changed::<tauri::Wry>;
    let _ = start_ping_loop;
    let _ = stop_ping_loop;
    let _ = restart_ping_loop;
    assert_eq!(
        ACTIVE_CONNECTIONS_CHANGED_EVENT,
        "connections:active-changed"
    );
    assert_eq!(DEFAULT_PING_INTERVAL, 30);

    fn requires_row_sink<T: RowSink>() {}
    requires_row_sink::<CsvSink<Vec<u8>>>();
    requires_row_sink::<JsonSink<Vec<u8>>>();
}
