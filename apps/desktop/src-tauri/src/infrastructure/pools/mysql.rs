use super::*;

const DEFAULT_MYSQL_CONNECT_TIMEOUT_MS: u64 = 60_000;
const DEFAULT_MYSQL_TIMEZONE: &str = "SYSTEM";
fn mysql_setting_value(key: &str) -> Option<serde_json::Value> {
    crate::config::get_cached_config()
        .plugins
        .and_then(|plugins| plugins.get("mysql").cloned())
        .and_then(|plugin| plugin.settings.get(key).cloned())
}

fn mysql_string_setting(key: &str, default: &str) -> String {
    mysql_setting_value(key)
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default.to_string())
}

fn mysql_numeric_setting(key: &str, default: u64) -> u64 {
    mysql_setting_value(key)
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_i64().and_then(|item| u64::try_from(item).ok()))
                .or_else(|| value.as_str().and_then(|item| item.parse::<u64>().ok()))
        })
        .unwrap_or(default)
}
pub(crate) fn build_mysql_options(
    params: &ConnectionParams,
    override_db: Option<&str>,
) -> Result<sqlx::mysql::MySqlConnectOptions, String> {
    use sqlx::mysql::{MySqlConnectOptions, MySqlSslMode};

    let username = params.username.as_deref().unwrap_or_default();
    let password = params.password.as_deref().unwrap_or_default();
    let host = params.host.as_deref().unwrap_or("localhost");
    let port = params.port.unwrap_or(3306);
    let database = override_db.unwrap_or_else(|| params.database.primary());
    let timezone = mysql_string_setting("timezone", DEFAULT_MYSQL_TIMEZONE);

    let mut options = MySqlConnectOptions::new()
        .host(host)
        .port(port)
        .username(username)
        .database(database)
        .timezone(timezone);

    if !password.is_empty() {
        options = options.password(password);
    }

    // Configure SSL mode based on params.ssl_mode
    let ssl_mode = match params.ssl_mode.as_deref().unwrap_or("required") {
        "disabled" | "disable" => MySqlSslMode::Disabled,
        "preferred" | "prefer" => MySqlSslMode::Preferred,
        "required" | "require" => MySqlSslMode::Required,
        "verify_ca" => MySqlSslMode::VerifyCa,
        "verify_identity" => MySqlSslMode::VerifyIdentity,
        _ => MySqlSslMode::Required,
    };
    options = options.ssl_mode(ssl_mode);

    // Apply SSL certificates if provided in params
    if let Some(ca) = &params.ssl_ca {
        options = options.ssl_ca(ca);
    }
    if let Some(cert) = &params.ssl_cert {
        options = options.ssl_client_cert(cert);
    }
    if let Some(key) = &params.ssl_key {
        options = options.ssl_client_key(key);
    }

    // Optionally enable the mysql_clear_password (cleartext) auth plugin, used by
    // bastions like Warpgate. Cleartext credentials must never be sent over an
    // unencrypted link, so require a TLS mode that actually guarantees
    // encryption. `Preferred` only attempts TLS and silently falls back to
    // plaintext, so it is rejected alongside `Disabled`.
    if params.enable_cleartext_plugin.unwrap_or(false) {
        if !matches!(
            ssl_mode,
            MySqlSslMode::Required | MySqlSslMode::VerifyCa | MySqlSslMode::VerifyIdentity
        ) {
            return Err(
                "Cleartext password plugin requires an enforced TLS/SSL mode \
                (Required, Verify CA, or Verify Identity). Preferred is not enough \
                because it can silently fall back to an unencrypted connection. \
                Refusing to send the password in cleartext."
                    .to_string(),
            );
        }
        options = options.enable_cleartext_plugin(true);
    }

    // By default sqlx forces `SET sql_mode=(... ',PIPES_AS_CONCAT,NO_ENGINE_SUBSTITUTION')`
    // on every connection. Vitess/PlanetScale reject altering these modes, so allow
    // opting out per connection. When disabled, no `SET sql_mode` is issued at all.
    let force_sql_mode = params.pipes_as_concat.unwrap_or(true);
    options = options
        .pipes_as_concat(force_sql_mode)
        .no_engine_substitution(force_sql_mode);

    Ok(options)
}

/// Build MySQL options, run the optional startup-script preflight, and open the
/// pool with the connect timeout applied. Factored out so the auto-fallback path
/// can retry with a different sql_mode by simply calling it again with adjusted
/// params. Returns the error message on failure so callers can inspect it for an
/// auto-fallback retry.
async fn build_and_connect_mysql_pool(
    params: &ConnectionParams,
    override_db: Option<&str>,
    connect_timeout: Duration,
    script: Option<&str>,
) -> Result<Pool<MySql>, String> {
    let options = build_mysql_options(params, override_db)?;

    // Validate the startup script up front so a broken script fails fast with a
    // clearly attributed error (see `run_mysql_startup_script`). This uses the
    // same `options`, so a server that rejects the forced sql_mode surfaces the
    // error here too and the caller's auto-fallback path can catch it.
    if let Some(script) = script {
        tokio::time::timeout(connect_timeout, run_mysql_startup_script(&options, script))
            .await
            .map_err(|_| {
                format!(
                    "Timed out running MySQL startup script after {} ms",
                    connect_timeout.as_millis()
                )
            })??;
    }

    let mut pool_options = sqlx::mysql::MySqlPoolOptions::new().max_connections(10);
    if let Some(script) = script {
        let script = script.to_owned();
        pool_options = pool_options.after_connect(move |conn, _meta| {
            let script = script.clone();
            Box::pin(async move {
                conn.execute(script.as_str()).await?;
                Ok(())
            })
        });
    }

    tokio::time::timeout(connect_timeout, pool_options.connect_with(options))
        .await
        .map_err(|_| {
            format!(
                "Timed out creating MySQL connection pool after {} ms",
                connect_timeout.as_millis()
            )
        })?
        .map_err(|e| e.to_string())
}

/// Whether a connection error means the server refuses sqlx's forced sql_mode
/// (`PIPES_AS_CONCAT` / `NO_ENGINE_SUBSTITUTION`), as Vitess/PlanetScale do.
pub(crate) fn is_pipes_as_concat_unsupported(err: &str) -> bool {
    let err = err.to_ascii_lowercase();
    err.contains("pipes_as_concat") || err.contains("no_engine_substitution")
}

pub async fn get_mysql_pool(params: &ConnectionParams) -> Result<Pool<MySql>, String> {
    let connection_id = params.connection_id.as_deref();
    get_mysql_pool_with_id(params, connection_id).await
}

pub async fn get_mysql_pool_with_id(
    params: &ConnectionParams,
    connection_id: Option<&str>,
) -> Result<Pool<MySql>, String> {
    get_mysql_pool_for_database_with_id(params, None, connection_id).await
}

pub async fn get_mysql_pool_for_database(
    params: &ConnectionParams,
    override_db: Option<&str>,
) -> Result<Pool<MySql>, String> {
    let connection_id = params.connection_id.as_deref();
    get_mysql_pool_for_database_with_id(params, override_db, connection_id).await
}

async fn get_mysql_pool_for_database_with_id(
    params: &ConnectionParams,
    override_db: Option<&str>,
    connection_id: Option<&str>,
) -> Result<Pool<MySql>, String> {
    let key = if let Some(db) = override_db {
        format!("{}:{}", build_connection_key(params, connection_id), db)
    } else {
        build_connection_key(params, connection_id)
    };

    // Try to get existing pool
    {
        let pools = MYSQL_POOLS.read().await;
        if let Some(pool) = pools.get(&key) {
            log::debug!(
                "Using existing MySQL connection pool for: {} (key: {})",
                override_db.unwrap_or_else(|| params.database.primary()),
                key
            );
            return Ok(pool.clone());
        }
    }

    // Create new pool
    log::info!(
        "Creating new MySQL connection pool for: {}@{:?} (key: {})",
        params.username.as_deref().unwrap_or("unknown"),
        params.host,
        key
    );
    let connect_timeout = Duration::from_millis(mysql_numeric_setting(
        "connectTimeout",
        DEFAULT_MYSQL_CONNECT_TIMEOUT_MS,
    ));
    let script = startup_script(params);

    let pool = match build_and_connect_mysql_pool(
        params,
        override_db,
        connect_timeout,
        script.as_deref(),
    )
    .await
    {
        Ok(pool) => pool,
        // Auto mode (`pipes_as_concat` unset): the first attempt forces the
        // sql_mode like sqlx does by default. Vitess/PlanetScale reject that, so
        // transparently retry without it — matching how native MySQL clients
        // (TablePlus, DataGrip) "just work" against PlanetScale.
        Err(e) if params.pipes_as_concat.is_none() && is_pipes_as_concat_unsupported(&e) => {
            log::warn!(
                "Server rejected the PIPES_AS_CONCAT sql_mode; retrying without it (Vitess/PlanetScale): {e}"
            );
            let mut fallback = params.clone();
            fallback.pipes_as_concat = Some(false);
            build_and_connect_mysql_pool(&fallback, override_db, connect_timeout, script.as_deref())
                .await
                .map_err(|e| {
                    log::error!("Failed to create MySQL connection pool: {}", e);
                    e
                })?
        }
        Err(e) => {
            log::error!("Failed to create MySQL connection pool: {}", e);
            return Err(e);
        }
    };

    log::info!(
        "MySQL connection pool created successfully for: {} (key: {})",
        override_db.unwrap_or_else(|| params.database.primary()),
        key
    );

    // Store pool
    {
        let mut pools = MYSQL_POOLS.write().await;
        pools.insert(key, pool.clone());
    }

    Ok(pool)
}
