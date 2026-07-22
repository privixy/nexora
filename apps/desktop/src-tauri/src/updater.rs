use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

// Strutture dati
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub release_url: String,
    pub published_at: String,
    pub download_urls: Vec<DownloadAsset>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadAsset {
    pub name: String,
    pub url: String,
    pub size: u64,
    pub platform: String,
}

// Cache structure
#[derive(Serialize, Deserialize, Debug, Clone)]
struct UpdateCheckCache {
    last_checked: u64,
    last_result: Option<UpdateCheckResult>,
}

// GitHub API response
#[derive(Deserialize, Debug)]
struct GitHubRelease {
    tag_name: String,
    body: String,
    html_url: String,
    published_at: String,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize, Debug)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

// Constants
const GITHUB_REPO: &str = "privixy/nexora";
const CACHE_DURATION_SECS: u64 = 43200; // 12 hours
/// Returns the installation source: "snap", "aur", or None for direct installs.
/// Only meaningful on Linux; always returns None on other platforms.
fn detect_installation_source() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        // Snap sets the SNAP env var when running inside a snap sandbox
        if std::env::var("SNAP").is_ok() {
            return Some("snap".to_string());
        }

        // Flatpak sets FLATPAK_ID when running inside a Flatpak sandbox
        if std::env::var("FLATPAK_ID").is_ok() {
            return Some("flatpak".to_string());
        }

        // AUR: check if pacman's local database has a nexora-bin entry
        if let Ok(entries) = std::fs::read_dir("/var/lib/pacman/local") {
            let is_aur = entries
                .filter_map(|e| e.ok())
                .any(|e| e.file_name().to_string_lossy().starts_with("nexora-bin-"));
            if is_aur {
                return Some("aur".to_string());
            }
        }
    }

    None
}

/// Returns true when updates should not be managed by the app itself.
fn is_managed_package() -> bool {
    detect_installation_source().is_some()
}

#[tauri::command]
pub fn get_installation_source() -> Option<String> {
    detect_installation_source()
}

// Helper functions
fn get_cache_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|p| p.join("update_check_cache.json"))
}

fn parse_version(version: &str) -> Option<(u32, u32, u32)> {
    let clean = version.trim_start_matches('v');
    let parts: Vec<&str> = clean.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    let major = parts[0].parse().ok()?;
    let minor = parts[1].parse().ok()?;
    let patch = parts[2].parse().ok()?;

    Some((major, minor, patch))
}

fn is_newer_version(current: &str, latest: &str) -> bool {
    match (parse_version(current), parse_version(latest)) {
        (Some(c), Some(l)) => l > c,
        _ => false,
    }
}

async fn fetch_latest_release() -> Result<GitHubRelease, String> {
    if GITHUB_REPO.is_empty() {
        return Err("Update checks require a configured release repository".to_string());
    }

    let client = Client::new();
    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );

    let res = client
        .get(&url)
        .header("User-Agent", "Nexora")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("GitHub API error: {}", res.status()));
    }

    res.json::<GitHubRelease>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}

fn categorize_asset(name: &str) -> String {
    if name.ends_with(".dmg") || name.contains("darwin") || name.contains("macos") {
        "macos".to_string()
    } else if name.ends_with(".exe") || name.ends_with(".msi") || name.contains("windows") {
        "windows".to_string()
    } else if name.ends_with(".AppImage") || name.ends_with(".deb") || name.ends_with(".rpm") {
        "linux".to_string()
    } else {
        "other".to_string()
    }
}

// Tauri commands
#[tauri::command]
pub async fn check_for_updates(app: AppHandle, force: bool) -> Result<UpdateCheckResult, String> {
    // Managed packages (AUR, Snap) should not use the built-in updater
    if is_managed_package() {
        return Err("Updates are managed by the package manager".to_string());
    }

    let config = crate::config::load_config_internal(&app);

    // Check if updates are disabled
    if !force && config.check_for_updates == Some(false) {
        return Err("Update checks disabled".to_string());
    }

    // Check cache if not forced
    if !force {
        if let Some(cache_path) = get_cache_path(&app) {
            if cache_path.exists() {
                if let Ok(content) = fs::read_to_string(&cache_path) {
                    if let Ok(cache) = serde_json::from_str::<UpdateCheckCache>(&content) {
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();

                        if now - cache.last_checked < CACHE_DURATION_SECS {
                            if let Some(result) = cache.last_result {
                                // Invalidate cache if the app was updated since it was written
                                if result.current_version == env!("CARGO_PKG_VERSION") {
                                    return Ok(result);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fetch latest release from GitHub
    let release = fetch_latest_release().await?;

    let current_version = env!("CARGO_PKG_VERSION");
    let latest_version = release.tag_name.trim_start_matches('v');

    let download_urls = release
        .assets
        .into_iter()
        .map(|asset| DownloadAsset {
            name: asset.name.clone(),
            url: asset.browser_download_url,
            size: asset.size,
            platform: categorize_asset(&asset.name),
        })
        .collect();

    let result = UpdateCheckResult {
        has_update: is_newer_version(current_version, &release.tag_name),
        current_version: current_version.to_string(),
        latest_version: latest_version.to_string(),
        release_notes: release.body,
        release_url: release.html_url,
        published_at: release.published_at,
        download_urls,
    };

    // Save to cache
    if let Some(cache_path) = get_cache_path(&app) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let cache = UpdateCheckCache {
            last_checked: timestamp,
            last_result: Some(result.clone()),
        };

        if let Ok(content) = serde_json::to_string(&cache) {
            let _ = fs::write(cache_path, content);
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;

    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        let mut downloaded = 0;

        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    let progress = if let Some(total) = content_length {
                        (downloaded as f64 / total as f64 * 100.0) as u32
                    } else {
                        0
                    };

                    let _ = app.emit("update-progress", progress);
                },
                || {
                    let _ = app.emit("update-installing", ());
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        app.restart();
    } else {
        Err("No update available".to_string())
    }
}

#[cfg(test)]
mod tests;
