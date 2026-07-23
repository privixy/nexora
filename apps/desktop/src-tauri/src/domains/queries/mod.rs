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

pub struct BlobService;

impl BlobService {
    pub fn detect_blob_mime(base64_data: &str) -> Result<String, String> {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|error| format!("Invalid base64: {}", error))?;
        Ok(crate::drivers::common::encode_blob_full(&bytes))
    }

    pub fn detect_mime_type(header_base64: &str) -> Result<String, String> {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(header_base64)
            .map_err(|error| format!("Invalid base64: {}", error))?;
        Ok(Self::mime(&bytes).to_string())
    }

    pub fn get_file_stats(file_path: &std::path::Path) -> Result<serde_json::Value, String> {
        let (file_size, mime) = Self::file_header(file_path)?;
        Ok(serde_json::json!({"size": file_size, "mime": mime}))
    }

    pub async fn load_from_file(
        file_path: std::path::PathBuf,
        max_blob_size: u64,
    ) -> Result<String, String> {
        tokio::task::spawn_blocking(move || {
            let (file_size, mime) = Self::file_header(&file_path)?;
            if file_size > max_blob_size {
                return Err(format!(
                    "File size ({} bytes / {:.2}MB) exceeds maximum allowed size ({} bytes / {}MB). Please choose a smaller file.",
                    file_size,
                    file_size as f64 / (1024.0 * 1024.0),
                    max_blob_size,
                    max_blob_size / (1024 * 1024)
                ));
            }
            Ok(format!(
                "BLOB_FILE_REF:{}:{}:{}",
                file_size,
                mime,
                file_path.display()
            ))
        })
        .await
        .map_err(|error| format!("Task join error: {}", error))?
    }

    pub async fn read_file_as_data_url(file_path: std::path::PathBuf) -> Result<String, String> {
        tokio::task::spawn_blocking(move || {
            use base64::Engine;
            let bytes = std::fs::read(&file_path)
                .map_err(|error| format!("Failed to read file: {}", error))?;
            let mime = Self::mime(&bytes);
            if !mime.starts_with("image/") {
                return Err(format!("Not an image file: {}", mime));
            }
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(format!("data:{};base64,{}", mime, encoded))
        })
        .await
        .map_err(|error| format!("Task join error: {}", error))?
    }

    fn file_header(file_path: &std::path::Path) -> Result<(u64, String), String> {
        use std::io::Read;
        let mut file = std::fs::File::open(file_path)
            .map_err(|error| format!("Failed to open file: {}", error))?;
        let file_size = file
            .metadata()
            .map_err(|error| format!("Failed to get file metadata: {}", error))?
            .len();
        let mut header = vec![0; std::cmp::min(8192, file_size as usize)];
        file.read_exact(&mut header)
            .map_err(|error| format!("Failed to read file header: {}", error))?;
        Ok((file_size, Self::mime(&header).to_string()))
    }

    fn mime(bytes: &[u8]) -> &str {
        infer::get(bytes)
            .map(|kind| kind.mime_type())
            .unwrap_or("application/octet-stream")
    }
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
