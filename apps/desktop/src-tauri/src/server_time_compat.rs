pub(crate) async fn run(
    driver: std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>,
    params: crate::models::ConnectionParams,
    driver_id: String,
) -> Result<String, String> {
    let query = match driver_id.as_str() {
        "sqlite" => "SELECT datetime('now', 'localtime')",
        _ => "SELECT NOW()",
    };
    let result = driver
        .execute_query(&params, query, Some(1), 1, None)
        .await?;
    result
        .rows
        .first()
        .and_then(|row| row.first())
        .map(|value| match value {
            serde_json::Value::String(string) => string.clone(),
            other => other.to_string(),
        })
        .ok_or_else(|| "No timestamp returned from server".to_string())
}

#[cfg(test)]
mod tests;
