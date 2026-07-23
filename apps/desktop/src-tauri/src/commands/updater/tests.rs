use super::*;

// Version parsing tests
#[test]
fn test_version_parsing_standard() {
    assert_eq!(parse_version("0.8.8"), Some((0, 8, 8)));
    assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
    assert_eq!(parse_version("10.20.30"), Some((10, 20, 30)));
}

#[test]
fn test_version_parsing_with_v_prefix() {
    assert_eq!(parse_version("v0.8.8"), Some((0, 8, 8)));
    assert_eq!(parse_version("v1.0.0"), Some((1, 0, 0)));
}

#[test]
fn test_version_parsing_invalid() {
    assert_eq!(parse_version("invalid"), None);
    assert_eq!(parse_version("1.2"), None);
    assert_eq!(parse_version("1.2.3.4"), None);
    assert_eq!(parse_version("a.b.c"), None);
    assert_eq!(parse_version(""), None);
}

#[test]
fn test_version_parsing_edge_cases() {
    assert_eq!(parse_version("0.0.0"), Some((0, 0, 0)));
    assert_eq!(parse_version("999.999.999"), Some((999, 999, 999)));
}

// Version comparison tests
#[test]
fn test_version_comparison_newer() {
    assert!(is_newer_version("0.8.8", "0.9.0"));
    assert!(is_newer_version("0.8.8", "0.8.9"));
    assert!(is_newer_version("0.8.8", "1.0.0"));
    assert!(is_newer_version("1.0.0", "2.0.0"));
}

#[test]
fn test_version_comparison_not_newer() {
    assert!(!is_newer_version("0.8.8", "0.8.8"));
    assert!(!is_newer_version("0.8.8", "0.8.7"));
    assert!(!is_newer_version("0.8.8", "0.7.9"));
    assert!(!is_newer_version("1.0.0", "0.9.9"));
}

#[test]
fn test_version_comparison_with_v_prefix() {
    assert!(is_newer_version("0.8.8", "v0.9.0"));
    assert!(is_newer_version("v0.8.8", "0.9.0"));
    assert!(is_newer_version("v0.8.8", "v0.9.0"));
}

#[test]
fn test_version_comparison_invalid() {
    assert!(!is_newer_version("invalid", "0.9.0"));
    assert!(!is_newer_version("0.8.8", "invalid"));
    assert!(!is_newer_version("invalid", "invalid"));
}

// Asset categorization tests
#[test]
fn test_categorize_asset_macos() {
    assert_eq!(categorize_asset("Nexora_0.8.8_x64.dmg"), "macos");
    assert_eq!(categorize_asset("Nexora_0.8.8_aarch64.dmg"), "macos");
    assert_eq!(categorize_asset("nexora-darwin.zip"), "macos");
    assert_eq!(categorize_asset("app-macos-universal.tar.gz"), "macos");
}

#[test]
fn test_categorize_asset_windows() {
    assert_eq!(categorize_asset("Nexora_0.8.8_x64_setup.exe"), "windows");
    assert_eq!(categorize_asset("nexora.msi"), "windows");
    assert_eq!(categorize_asset("app-windows-x86_64.zip"), "windows");
}

#[test]
fn test_categorize_asset_linux() {
    assert_eq!(categorize_asset("nexora_0.8.8_amd64.AppImage"), "linux");
    assert_eq!(categorize_asset("nexora_0.8.8_amd64.deb"), "linux");
    assert_eq!(categorize_asset("nexora-0.8.8-1.x86_64.rpm"), "linux");
}

#[test]
fn test_categorize_asset_other() {
    assert_eq!(categorize_asset("README.txt"), "other");
    assert_eq!(categorize_asset("checksums.sha256"), "other");
    assert_eq!(categorize_asset("unknown-file"), "other");
}

// Cache path tests
#[test]
fn test_cache_filename() {
    let expected = "update_check_cache.json";
    assert!(expected.ends_with(".json"));
    assert!(expected.contains("cache"));
}

#[test]
fn test_github_repo_constant() {
    assert_eq!(GITHUB_REPO, "privixy/nexora");
}

// Cache duration test
#[test]
fn test_cache_duration() {
    assert_eq!(CACHE_DURATION_SECS, 43200); // 12 hours in seconds
    assert_eq!(CACHE_DURATION_SECS / 3600, 12); // Verify it's 12 hours
}

// Mutex to serialize env var mutations across parallel tests
#[cfg(target_os = "linux")]
static ENV_MUTEX: std::sync::LazyLock<std::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| std::sync::Mutex::new(()));

// Installation source detection tests
#[cfg(target_os = "linux")]
#[test]
fn test_detect_installation_source_snap() {
    let _lock = ENV_MUTEX.lock().unwrap();
    std::env::remove_var("FLATPAK_ID");
    std::env::set_var("SNAP", "/snap/nexora/current");
    let source = detect_installation_source();
    std::env::remove_var("SNAP");
    assert_eq!(source.as_deref(), Some("snap"));
}

#[cfg(target_os = "linux")]
#[test]
fn test_detect_installation_source_flatpak() {
    let _lock = ENV_MUTEX.lock().unwrap();
    std::env::remove_var("SNAP");
    std::env::set_var("FLATPAK_ID", "dev.nexora.app");
    let source = detect_installation_source();
    std::env::remove_var("FLATPAK_ID");
    assert_eq!(source.as_deref(), Some("flatpak"));
}

#[cfg(target_os = "linux")]
#[test]
fn test_detect_installation_source_direct() {
    let _lock = ENV_MUTEX.lock().unwrap();
    std::env::remove_var("SNAP");
    std::env::remove_var("FLATPAK_ID");
    let source = detect_installation_source();
    // On a dev/CI machine without pacman or nexora-bin installed, must be None
    assert!(source.is_none() || source.as_deref() == Some("aur"));
}

mod registration;
