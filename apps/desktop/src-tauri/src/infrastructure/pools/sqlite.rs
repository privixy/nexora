use super::*;

const SQLITE_STARTUP_SCRIPT_TIMEOUT_MS: u64 = 30_000;

fn build_sqlite_connectoptions(params: &ConnectionParams) -> SqliteConnectOptions {
    SqliteConnectOptions::new().filename(params.database.to_string())
}

pub async fn get_sqlite_pool(params: &ConnectionParams) -> Result<Pool<Sqlite>, String> {
    let connection_id = params.connection_id.as_deref();
    get_sqlite_pool_with_id(params, connection_id).await
}

pub async fn get_sqlite_pool_with_id(
    params: &ConnectionParams,
    connection_id: Option<&str>,
) -> Result<Pool<Sqlite>, String> {
    let key = build_connection_key(params, connection_id);

    // Try to get existing pool
    {
        let pools = SQLITE_POOLS.read().await;
        if let Some(pool) = pools.get(&key) {
            log::debug!(
                "Using existing SQLite connection pool for: {} (key: {})",
                params.database,
                key
            );
            return Ok(pool.clone());
        }
    }

    // Create new pool
    log::info!(
        "Creating new SQLite connection pool for database: {} (key: {})",
        params.database,
        key
    );
    let options = build_sqlite_connectoptions(params);
    let mut pool_options = sqlx::sqlite::SqlitePoolOptions::new().max_connections(5); // SQLite has lower concurrency needs
    if let Some(script) = startup_script(params) {
        let timeout = Duration::from_millis(SQLITE_STARTUP_SCRIPT_TIMEOUT_MS);
        tokio::time::timeout(timeout, run_sqlite_startup_script(&options, &script))
            .await
            .map_err(|_| {
                format!(
                    "Timed out running SQLite startup script after {} ms",
                    timeout.as_millis()
                )
            })??;
        pool_options = pool_options.after_connect(move |conn, _meta| {
            let script = script.clone();
            Box::pin(async move {
                conn.execute(script.as_str()).await?;
                Ok(())
            })
        });
    }
    let pool = pool_options.connect_with(options).await.map_err(|e| {
        log::error!("Failed to create SQLite connection pool: {}", e);
        e.to_string()
    })?;

    log::info!(
        "SQLite connection pool created successfully for: {} (key: {})",
        params.database,
        key
    );

    // Store pool
    {
        let mut pools = SQLITE_POOLS.write().await;
        pools.insert(key, pool.clone());
    }

    Ok(pool)
}
