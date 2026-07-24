pub(crate) async fn run(
    driver: std::sync::Arc<dyn crate::drivers::driver_trait::DatabaseDriver>,
    params: crate::models::ConnectionParams,
    query: String,
    schema: Option<String>,
) -> Result<u64, String> {
    let sanitized = query.trim().trim_end_matches(';').to_string();
    let count_q = format!("SELECT COUNT(*) FROM ({}) as count_wrapper", sanitized);
    let result = driver
        .execute_query(&params, &count_q, None, 1, schema.as_deref())
        .await?;
    let total = result
        .rows
        .first()
        .and_then(|row| row.first())
        .and_then(|value| value.as_i64())
        .map(|value| value as u64)
        .unwrap_or(0);
    Ok(total)
}

#[cfg(test)]
mod tests;
