use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use zip::ZipArchive;

pub(crate) struct SqlStatementStream<R: BufRead> {
    reader: R,
    current_statement: String,
    line_buffer: String,
}

impl<R: BufRead> SqlStatementStream<R> {
    pub(crate) fn new(reader: R) -> Self {
        Self {
            reader,
            current_statement: String::new(),
            line_buffer: String::new(),
        }
    }

    pub(crate) fn next_statement(&mut self) -> Result<Option<String>, String> {
        loop {
            self.line_buffer.clear();
            let bytes_read = self
                .reader
                .read_line(&mut self.line_buffer)
                .map_err(|e| e.to_string())?;

            if bytes_read == 0 {
                if self.current_statement.trim().is_empty() {
                    return Ok(None);
                }
                let stmt = self.current_statement.trim().to_string();
                self.current_statement.clear();
                return Ok(Some(stmt));
            }

            let trimmed = self.line_buffer.trim();
            if trimmed.starts_with("--") || trimmed.is_empty() {
                continue;
            }

            self.current_statement.push_str(&self.line_buffer);
            if trimmed.ends_with(';') {
                let stmt = self.current_statement.trim().to_string();
                self.current_statement.clear();
                if !stmt.is_empty() {
                    return Ok(Some(stmt));
                }
            }
        }
    }
}

pub(crate) fn create_sql_reader(
    file: File,
    file_path: &str,
) -> Result<Box<dyn BufRead + Send>, String> {
    if file_path.ends_with(".zip") {
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to open zip: {}", e))?;

        for i in 0..archive.len() {
            let mut zipped_file = archive.by_index(i).map_err(|e| e.to_string())?;
            if zipped_file.name().ends_with(".sql") {
                let mut content = String::new();
                zipped_file
                    .read_to_string(&mut content)
                    .map_err(|e| e.to_string())?;
                let cursor = std::io::Cursor::new(content.into_bytes());
                return Ok(Box::new(BufReader::new(cursor)));
            }
        }
        Err("No .sql file found in zip archive".into())
    } else {
        let reader = BufReader::with_capacity(8192 * 16, file);
        Ok(Box::new(reader))
    }
}
