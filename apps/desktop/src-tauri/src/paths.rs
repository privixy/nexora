use directories::ProjectDirs;
use std::path::{Path, PathBuf};

pub fn get_app_config_dir() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("", "", "nexora") {
        #[cfg(target_os = "windows")]
        {
            proj_dirs.config_dir().parent().unwrap().to_path_buf()
        }
        #[cfg(not(target_os = "windows"))]
        {
            proj_dirs.config_dir().to_path_buf()
        }
    } else {
        // Fallback for weird environments
        PathBuf::from(".config/nexora")
    }
}

/// Resolve the connections file inside `config_dir`.
///
/// In dev builds (`debug_assertions`) a `connections.dev.json` takes
/// precedence when it exists, so development can run against a separate
/// set of connections without touching the real `connections.json`.
/// Release builds always use `connections.json`.
pub fn resolve_connections_path(config_dir: &Path) -> PathBuf {
    if cfg!(debug_assertions) {
        let dev = config_dir.join("connections.dev.json");
        if dev.exists() {
            return dev;
        }
    }
    config_dir.join("connections.json")
}

#[cfg(test)]
mod tests;
