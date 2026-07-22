use super::*;

type PoolMap<T> = Arc<RwLock<HashMap<String, Pool<T>>>>;
type PgPoolMap = Arc<RwLock<HashMap<String, PgPool>>>;
pub(super) static MYSQL_POOLS: Lazy<PoolMap<MySql>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));
pub(super) static POSTGRES_POOLS: Lazy<PgPoolMap> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));
pub(super) static SQLITE_POOLS: Lazy<PoolMap<Sqlite>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));
pub async fn has_pool(params: &ConnectionParams, connection_id: Option<&str>) -> bool {
    has_pool_for_database(params, None, connection_id).await
}

/// Check whether a connection pool exists for the given params and database without creating one.
pub async fn has_pool_for_database(
    params: &ConnectionParams,
    override_db: Option<&str>,
    connection_id: Option<&str>,
) -> bool {
    let key = if let Some(db) = override_db {
        format!("{}:{}", build_connection_key(params, connection_id), db)
    } else {
        build_connection_key(params, connection_id)
    };
    match params.driver.as_str() {
        "mysql" => MYSQL_POOLS.read().await.contains_key(&key),
        "postgres" => POSTGRES_POOLS.read().await.contains_key(&key),
        "sqlite" => SQLITE_POOLS.read().await.contains_key(&key),
        _ => false,
    }
}

/// Close a specific connection pool
pub async fn close_pool(params: &ConnectionParams) {
    let connection_id = params.connection_id.as_deref();
    close_pool_with_id(params, connection_id).await;
}

/// Close a specific connection pool by connection_id
pub async fn close_pool_with_id(params: &ConnectionParams, connection_id: Option<&str>) {
    let key = build_connection_key(params, connection_id);

    match params.driver.as_str() {
        "mysql" => {
            let pools_to_close = {
                let mut pools = MYSQL_POOLS.write().await;
                if let Some(conn_id) = connection_id {
                    let prefix = format!("{}:conn:{}:", params.driver, conn_id);
                    let keys = pools
                        .keys()
                        .filter(|candidate| candidate.starts_with(&prefix))
                        .cloned()
                        .collect::<Vec<_>>();
                    keys.into_iter()
                        .filter_map(|key| pools.remove(&key).map(|pool| (key, pool)))
                        .collect::<Vec<_>>()
                } else {
                    pools
                        .remove(&key)
                        .map(|pool| vec![(key.clone(), pool)])
                        .unwrap_or_default()
                }
            };

            for (key, pool) in pools_to_close {
                log::info!(
                    "Closing MySQL connection pool for: {} (key: {})",
                    params.database,
                    key
                );
                pool.close().await;
                log::info!(
                    "MySQL connection pool closed for: {} (key: {})",
                    params.database,
                    key
                );
            }
        }
        "postgres" => {
            let pools_to_close = {
                let mut pools = POSTGRES_POOLS.write().await;
                if let Some(conn_id) = connection_id {
                    let prefix = format!("{}:conn:{}:", params.driver, conn_id);
                    let keys = pools
                        .keys()
                        .filter(|candidate| candidate.starts_with(&prefix))
                        .cloned()
                        .collect::<Vec<_>>();
                    keys.into_iter()
                        .filter_map(|key| pools.remove(&key).map(|pool| (key, pool)))
                        .collect::<Vec<_>>()
                } else {
                    pools
                        .remove(&key)
                        .map(|pool| vec![(key.clone(), pool)])
                        .unwrap_or_default()
                }
            };

            for (key, pool) in pools_to_close {
                log::info!(
                    "Closing PostgreSQL connection pool for: {} (key: {})",
                    params.database,
                    key
                );
                pool.close();
                log::info!(
                    "PostgreSQL connection pool closed for: {} (key: {})",
                    params.database,
                    key
                );
            }
        }
        "sqlite" => {
            let pools_to_close = {
                let mut pools = SQLITE_POOLS.write().await;
                if let Some(conn_id) = connection_id {
                    let prefix = format!("{}:conn:{}:", params.driver, conn_id);
                    let keys = pools
                        .keys()
                        .filter(|candidate| candidate.starts_with(&prefix))
                        .cloned()
                        .collect::<Vec<_>>();
                    keys.into_iter()
                        .filter_map(|key| pools.remove(&key).map(|pool| (key, pool)))
                        .collect::<Vec<_>>()
                } else {
                    pools
                        .remove(&key)
                        .map(|pool| vec![(key.clone(), pool)])
                        .unwrap_or_default()
                }
            };

            for (key, pool) in pools_to_close {
                log::info!(
                    "Closing SQLite connection pool for: {} (key: {})",
                    params.database,
                    key
                );
                pool.close().await;
                log::info!(
                    "SQLite connection pool closed for: {} (key: {})",
                    params.database,
                    key
                );
            }
        }
        _ => {}
    }
}

/// Close all connection pools (useful on app shutdown)
pub async fn close_all_pools() {
    {
        let mut pools = MYSQL_POOLS.write().await;
        for (_, pool) in pools.drain() {
            pool.close().await;
        }
    }
    {
        let mut pools = POSTGRES_POOLS.write().await;
        for (_, pool) in pools.drain() {
            pool.close();
        }
    }
    {
        let mut pools = SQLITE_POOLS.write().await;
        for (_, pool) in pools.drain() {
            pool.close().await;
        }
    }
}
