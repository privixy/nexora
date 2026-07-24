/// Returns a properly quoted, schema-qualified table identifier for SQL output.
///
/// - MySQL: `table` (backtick-quoted, no schema prefix)
/// - PostgreSQL: "schema"."table" (double-quote-quoted, schema-qualified)
/// - SQLite / other: "table" (double-quote-quoted)
pub fn format_table_ref(driver: &str, schema: &str, table: &str) -> String {
    match driver {
        "mysql" => format!("`{}`", table),
        "postgres" => format!(r#""{}"."{}""#, schema, table),
        _ => format!(r#""{}""#, table),
    }
}

/// Returns a DROP TABLE IF EXISTS statement using driver-specific quoting.
pub fn drop_table_if_exists(driver: &str, schema: &str, table: &str) -> String {
    format!(
        "DROP TABLE IF EXISTS {};",
        format_table_ref(driver, schema, table)
    )
}

/// Returns an INSERT INTO ... VALUES ... statement using driver-specific quoting.
pub fn insert_into_statement(driver: &str, schema: &str, table: &str, values: &str) -> String {
    format!(
        "INSERT INTO {} VALUES {};",
        format_table_ref(driver, schema, table),
        values
    )
}

#[cfg(test)]
mod tests;
