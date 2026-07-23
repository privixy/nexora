use super::*;

const POSTGRES_STARTUP_SCRIPT_TIMEOUT_MS: u64 = 30_000;

pub(crate) fn build_postgres_configurations(params: &ConnectionParams) -> PgConfig {
    let mut cfg = PgConfig::new();
    cfg.user(params.username.as_deref().unwrap_or_default())
        .password(params.password.as_deref().unwrap_or_default())
        .port(params.port.unwrap_or(5432))
        .host(params.host.as_deref().unwrap_or_default())
        .dbname(format!("{}", params.database));

    if let Some(ssl_mode) = params.ssl_mode.as_deref() {
        match ssl_mode {
            "disable" => {
                cfg.ssl_mode(PgSslMode::Disable);
            }
            // tokio_postgres does not have SslMode::Allow.
            // "allow" (try non-SSL first, fallback to SSL) requires application-level
            // logic that this codebase does not implement. For now, map to Prefer
            // which at least allows both SSL and non-SSL connections.
            "allow" => {
                cfg.ssl_mode(PgSslMode::Prefer);
            }
            "prefer" => {
                cfg.ssl_mode(PgSslMode::Prefer);
            }
            "require" | "verify-ca" | "verify-full" => {
                cfg.ssl_mode(PgSslMode::Require);
            }
            _ => {}
        };
    }

    cfg
}

pub async fn get_postgres_pool(params: &ConnectionParams) -> Result<PgPool, String> {
    let connection_id = params.connection_id.as_deref();
    get_postgres_pool_with_id(params, connection_id).await
}

pub async fn get_postgres_pool_with_id(
    params: &ConnectionParams,
    connection_id: Option<&str>,
) -> Result<PgPool, String> {
    let key = build_connection_key(params, connection_id);

    // Try to get existing pool
    {
        let pools = POSTGRES_POOLS.read().await;
        if let Some(pool) = pools.get(&key) {
            log::debug!(
                "Using existing PostgreSQL connection pool for: {} (key: {})",
                params.database,
                key
            );
            return Ok(pool.clone());
        }
    }

    // Create new pool
    log::info!(
        "Creating new PostgreSQL connection pool for: {}@{:?} (key: {})",
        params.username.as_deref().unwrap_or("unknown"),
        params.host,
        key
    );

    let cfg = build_postgres_configurations(params);

    let tls_connector = build_postgres_tls_connector(params).map_err(|e| {
        log::error!("Failed to create TLS connector for PostgreSQL pool: {}", e);
        e
    })?;

    if let Some(script) = startup_script(params) {
        let timeout = Duration::from_millis(POSTGRES_STARTUP_SCRIPT_TIMEOUT_MS);
        tokio::time::timeout(
            timeout,
            run_postgres_startup_script(&cfg, tls_connector.clone(), &script),
        )
        .await
        .map_err(|_| {
            format!(
                "Timed out running PostgreSQL startup script after {} ms",
                timeout.as_millis()
            )
        })??;
    }

    let mut builder = PgPool::builder(PgPoolManager::new(cfg, tls_connector)).max_size(10);
    if let Some(script) = startup_script(params) {
        builder = builder.post_create(PgHook::async_fn(move |client, _metrics| {
            let script = script.clone();
            Box::pin(async move {
                client.batch_execute(&script).await.map_err(|e| {
                    PgHookError::message(startup_script_error(format_error_chain(&e)))
                })?;
                Ok(())
            })
        }));
    }
    let pool = builder.build().map_err(|e| {
        let detail = format_error_chain(&e);
        log::error!("Failed to create PostgreSQL connection pool: {}", detail);
        detail
    })?;

    log::info!(
        "PostgreSQL connection pool created successfully for: {} (key: {})",
        params.database,
        key
    );

    // Store pool
    {
        let mut pools = POSTGRES_POOLS.write().await;
        pools.insert(key, pool.clone());
    }

    Ok(pool)
}
