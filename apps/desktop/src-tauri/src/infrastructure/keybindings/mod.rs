use std::fs;
use std::path::Path;

const KEYBINDINGS_FILE: &str = "keybindings.json";

pub fn load_keybindings(config_dir: &Path) -> Result<serde_json::Value, String> {
    let path = config_dir.join(KEYBINDINGS_FILE);
    if !path.exists() {
        return Ok(serde_json::Value::Object(serde_json::Map::new()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_keybindings(config_dir: &Path, keybindings: &serde_json::Value) -> Result<(), String> {
    fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    let path = config_dir.join(KEYBINDINGS_FILE);
    let content = serde_json::to_string_pretty(keybindings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests;
