pub async fn register_all_drivers<F>(load_external_driver_config: F)
where
    F: FnOnce() -> (
        std::collections::HashMap<String, crate::config::PluginConfig>,
        Option<Vec<String>>,
    ),
{
    crate::drivers::registry::register_driver(crate::drivers::mysql::MysqlDriver::new()).await;
    crate::drivers::registry::register_driver(crate::drivers::postgres::PostgresDriver::new())
        .await;
    crate::drivers::registry::register_driver(crate::drivers::sqlite::SqliteDriver::new()).await;
    let (plugin_configs, enabled_ids) = load_external_driver_config();
    crate::plugins::manager::load_plugins_with_configs(plugin_configs, enabled_ids.as_deref())
        .await;
}

#[cfg(test)]
mod tests;
