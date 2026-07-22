use super::*;

/// Build a stable connection key that works with SSH tunnels.
/// If connection_id is provided (from saved connections), use it for stable pooling.
/// Otherwise fall back to host:port:database (for ad-hoc connections).
fn normalize_database_for_pool_key(params: &ConnectionParams) -> String {
    let primary = params.database.primary();
    match params.driver.as_str() {
        "postgres" if primary == "postgres" || primary == "template1" => {
            "__postgres_maintenance__".to_string()
        }
        _ => primary.to_string(),
    }
}

pub(crate) fn build_connection_key(
    params: &ConnectionParams,
    connection_id: Option<&str>,
) -> String {
    let database_key = normalize_database_for_pool_key(params);
    let tls_key = match params.driver.as_str() {
        "mysql" => Some(format!(
            // `clear` keeps cleartext and non-cleartext connections to the same
            // host in separate pools — they authenticate differently. `pipes`
            // likewise separates pools that force sql_mode from those that don't.
            "ssl:{}:{}:{}:{}:clear:{}:pipes:{}",
            params.ssl_mode.as_deref().unwrap_or("default"),
            params.ssl_ca.as_deref().unwrap_or(""),
            params.ssl_cert.as_deref().unwrap_or(""),
            params.ssl_key.as_deref().unwrap_or(""),
            params.enable_cleartext_plugin.unwrap_or(false),
            params.pipes_as_concat.unwrap_or(true)
        )),
        "postgres" => {
            let ssl_mode = params.ssl_mode.as_deref().unwrap_or("prefer");
            let ssl_ca = match ssl_mode {
                "verify-ca" | "verify-full" => params.ssl_ca.as_deref().unwrap_or(""),
                _ => "",
            };
            Some(format!("ssl:{ssl_mode}:{ssl_ca}"))
        }
        _ => None,
    };

    let base_key = if let Some(conn_id) = connection_id {
        // Include database in key so different databases on the same connection use separate pools
        format!("{}:conn:{}:{}", params.driver, conn_id, database_key)
    } else {
        // Fall back to host:port:user:database for ad-hoc connections (no saved
        // id). The username is essential: bastions like Warpgate multiplex many
        // targets behind a single host:port and pick the backend from the
        // username, so without it two different targets would share one pool and
        // serve each other's databases.
        format!(
            "{}:{}:{}:{}:{}",
            params.driver,
            params.host.as_deref().unwrap_or("localhost"),
            params.port.unwrap_or(0),
            params.username.as_deref().unwrap_or(""),
            database_key
        )
    };

    let key = if let Some(tls_key) = tls_key {
        format!("{base_key}:{tls_key}")
    } else {
        base_key
    };

    // Fold the startup script into the key so editing it forces a fresh pool
    // (whose new connections run the new script) instead of silently reusing
    // the cached pool keyed only by connection_id. Hashed to keep the key
    // bounded; only present when a script is set, so script-free connections
    // keep their existing keys.
    match startup_script(params) {
        Some(script) => {
            let digest = Sha256::digest(script.as_bytes());
            format!(
                "{key}:startup:{}",
                base64::Engine::encode(
                    &base64::engine::general_purpose::URL_SAFE_NO_PAD,
                    digest.as_slice()
                )
            )
        }
        None => key,
    }
}
