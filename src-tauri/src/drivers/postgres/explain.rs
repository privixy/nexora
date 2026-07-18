use super::client::{format_pg_error, get_client};
use super::helpers::escape_identifier;
use crate::explain_import::parse_postgres_json;
use crate::models::{ConnectionParams, ExplainPlan};
use crate::pool_manager::get_postgres_pool;

pub async fn explain_query(
    params: &ConnectionParams,
    query: &str,
    analyze: bool,
    schema: Option<&str>,
) -> Result<ExplainPlan, String> {
    let pool = get_postgres_pool(params).await?;
    let client = get_client(&pool).await?;

    if let Some(s) = schema {
        let search_path = format!("SET search_path TO \"{}\"", escape_identifier(s));
        client
            .execute(&search_path, &[])
            .await
            .map_err(|e| format_pg_error(&e))?;
    }

    let explain_sql = if analyze {
        format!("EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) {}", query)
    } else {
        format!("EXPLAIN (FORMAT JSON) {}", query)
    };

    let rows = client
        .query(&explain_sql, &[])
        .await
        .map_err(|e| format_pg_error(&e));
    let reset_result = if schema.is_some() {
        client
            .execute("RESET search_path", &[])
            .await
            .map_err(|e| format_pg_error(&e))
            .map(|_| ())
    } else {
        Ok(())
    };
    let rows = match (rows, reset_result) {
        (Ok(rows), Ok(())) => rows,
        (Err(err), _) => return Err(err),
        (Ok(_), Err(err)) => return Err(err),
    };

    if rows.is_empty() {
        return Err("EXPLAIN returned no output".into());
    }

    // `EXPLAIN (FORMAT JSON)` on real PostgreSQL returns a column of type
    // `json` (not `text`), so reading it as `String` fails with
    // "error deserializing column 0". Read it as a `serde_json::Value` and
    // re-serialize. Some Postgres-compatible engines hand back a plain `text`
    // column instead, so fall back to reading the raw string in that case.
    let plan_json_str = match rows[0].try_get::<_, serde_json::Value>(0) {
        Ok(value) => value.to_string(),
        Err(json_err) => rows[0].try_get::<_, String>(0).map_err(|e| {
            log::debug!("EXPLAIN json read failed ({json_err}); text read also failed");
            format_pg_error(&e)
        })?,
    };

    let mut plan = parse_postgres_json(&plan_json_str)?;
    plan.original_query = query.to_string();
    Ok(plan)
}
