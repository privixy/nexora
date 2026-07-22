pub fn sanitize_user_query(query: &str) -> String {
    query
        .trim()
        .trim_end_matches(';')
        .trim()
        .replace(['‘', '’'], "'")
        .replace(['“', '”'], "\"")
}

pub fn blob_wire_to_data_url(wire: &str) -> Result<String, String> {
    if !wire.starts_with("BLOB:") {
        return Err("Invalid BLOB wire format".into());
    }
    let after_prefix = &wire[5..];
    let size_end = after_prefix.find(':').ok_or("Invalid BLOB wire format")?;
    let after_size = &after_prefix[size_end + 1..];
    let mime_end = after_size.find(':').ok_or("Invalid BLOB wire format")?;
    let mime = &after_size[..mime_end];
    if !mime.starts_with("image/") {
        return Err(format!("Not an image: {}", mime));
    }
    let base64_payload = &after_size[mime_end + 1..];
    Ok(format!("data:{};base64,{}", mime, base64_payload))
}

pub struct ErWindowSpec {
    pub label: String,
    pub url: String,
    pub title: String,
}

pub fn build_er_window(
    connection_id: &str,
    connection_name: &str,
    database_name: &str,
    focus_table: Option<&str>,
    schema: Option<&str>,
) -> ErWindowSpec {
    let schema_suffix = schema.map(|s| format!("/{}", s)).unwrap_or_default();
    let title = crate::window_title::format_window_title(Some(&format!(
        "{} ({}{})",
        database_name, connection_name, schema_suffix
    )));
    let mut url = format!(
        "/schema-diagram?connectionId={}&connectionName={}&databaseName={}",
        urlencoding::encode(connection_id),
        urlencoding::encode(connection_name),
        urlencoding::encode(database_name)
    );
    if let Some(table) = focus_table {
        url.push_str(&format!("&focusTable={}", urlencoding::encode(table)));
    }
    if let Some(schema) = schema {
        url.push_str(&format!("&schema={}", urlencoding::encode(schema)));
    }
    let raw_label = format!(
        "er-diagram:{}:{}:{}",
        connection_id,
        database_name,
        schema.unwrap_or("")
    );
    let label = raw_label
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();

    ErWindowSpec { label, url, title }
}

#[cfg(test)]
mod tests;
