use super::*;

pub(super) fn startup_script(params: &ConnectionParams) -> Option<String> {
    params
        .startup_script
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// Format a startup-script execution failure so the surfaced error clearly
/// names the startup script as the cause, instead of reading like a bad host
/// or wrong credentials.
pub(super) fn startup_script_error(err: impl std::fmt::Display) -> String {
    format!("Startup script failed: {err}")
}

/// Validate the startup script on a throwaway connection so a broken script
/// fails fast with a clearly attributed error, **without** applying its side
/// effects. The statements run inside a transaction that is rolled back, so a
/// side-effecting script (`INSERT`, counters, …) is not executed twice on the
/// first pooled connection — the per-connection hooks (`after_connect`/
/// `post_create`) remain the single place the script actually takes effect.
///
/// This preflight exists only for early, well-labelled failures: sqlx swallows
/// `after_connect` errors and retries until the acquire timeout, which would
/// otherwise report a misleading "pool timed out". A failure to open the
/// connection is returned verbatim so genuine connectivity problems are not
/// mislabelled as startup-script errors.
pub(super) async fn run_mysql_startup_script(
    options: &sqlx::mysql::MySqlConnectOptions,
    script: &str,
) -> Result<(), String> {
    let mut conn = options.connect().await.map_err(|e| e.to_string())?;
    let outcome: Result<(), sqlx::Error> = async {
        let mut tx = conn.begin().await?;
        tx.execute(script).await?;
        tx.rollback().await
    }
    .await;
    let _ = conn.close().await;
    outcome.map_err(startup_script_error)
}

/// SQLite counterpart to [`run_mysql_startup_script`].
pub(super) async fn run_sqlite_startup_script(
    options: &SqliteConnectOptions,
    script: &str,
) -> Result<(), String> {
    let mut conn = options.connect().await.map_err(|e| e.to_string())?;
    let outcome: Result<(), sqlx::Error> = async {
        let mut tx = conn.begin().await?;
        tx.execute(script).await?;
        tx.rollback().await
    }
    .await;
    let _ = conn.close().await;
    outcome.map_err(startup_script_error)
}

/// PostgreSQL counterpart to [`run_mysql_startup_script`]. deadpool surfaces a
/// failing `post_create` hook as a raw `PoolError::PostCreateHook(..)` debug
/// struct on first use; this preflight instead fails fast at pool-creation time
/// with the same clean `Startup script failed: …` attribution as the other
/// drivers. The script is validated inside a transaction that is rolled back,
/// so side effects are applied only by the per-connection `post_create` hook.
pub(super) async fn run_postgres_startup_script(
    cfg: &PgConfig,
    tls: MakeRustlsConnect,
    script: &str,
) -> Result<(), String> {
    let (mut client, connection) = cfg.connect(tls).await.map_err(|e| format_error_chain(&e))?;
    // tokio_postgres needs the connection future polled on its own task.
    let driver = tokio::spawn(async move {
        let _ = connection.await;
    });
    let outcome: Result<(), tokio_postgres::Error> = async {
        let tx = client.transaction().await?;
        tx.batch_execute(script).await?;
        tx.rollback().await
    }
    .await;
    drop(client);
    driver.abort();
    outcome.map_err(|e| startup_script_error(format_error_chain(&e)))
}
