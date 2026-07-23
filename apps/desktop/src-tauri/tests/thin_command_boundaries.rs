use std::fs;
use std::path::{Path, PathBuf};

fn rust_files(directory: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            rust_files(&path, files);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            files.push(path.canonicalize().unwrap());
        }
    }
}

#[test]
fn command_modules_are_recursive_thin_adapters() {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let commands_root = source_root.join("commands").canonicalize().unwrap();
    let mut files = Vec::new();
    rust_files(&commands_root, &mut files);
    assert!(!files.is_empty());

    let mut violations = Vec::new();
    for file in files
        .into_iter()
        .filter(|file| !file.to_string_lossy().contains("/commands/tests/"))
    {
        let source = fs::read_to_string(&file).unwrap();
        let relative = file.strip_prefix(&commands_root).unwrap();
        if relative == Path::new("shared.rs") {
            violations.push("commands/shared.rs is a forbidden catch-all owner".to_string());
        }
        for forbidden in [
            "sqlx::",
            "crate::drivers::mysql",
            "crate::drivers::postgres",
            "crate::drivers::sqlite",
            "get_mysql_pool",
            "get_postgres_pool",
            "get_sqlite_pool",
        ] {
            if source.contains(forbidden) {
                violations.push(format!("{} contains {forbidden}", file.display()));
            }
        }
    }
    assert!(violations.is_empty(), "{}", violations.join("\n"));
}

#[test]
fn tauri_handlers_have_explicit_transport_owners() {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let commands_root = source_root.join("commands").canonicalize().unwrap();
    let approved_legacy = ["export.rs", "dump_commands.rs", "clipboard_import.rs"];
    let mut files = Vec::new();
    rust_files(&source_root, &mut files);

    let mut violations = Vec::new();
    for file in files {
        let source = fs::read_to_string(&file).unwrap();
        if !source.contains("#[tauri::command]") {
            continue;
        }
        let relative = file.strip_prefix(&source_root).unwrap();
        if !file.starts_with(&commands_root)
            && !approved_legacy
                .iter()
                .any(|owner| relative == Path::new(owner))
        {
            violations.push(format!(
                "{} owns a Tauri handler outside commands or an approved legacy root owner",
                relative.display()
            ));
        }
    }

    assert!(violations.is_empty(), "{}", violations.join("\n"));
}

#[test]
fn command_adapters_are_owned_by_their_focused_modules() {
    let commands_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/commands");
    let mut files = Vec::new();
    rust_files(&commands_root, &mut files);

    let mut violations = Vec::new();
    for file in files
        .into_iter()
        .filter(|file| !file.to_string_lossy().contains("/commands/tests/"))
    {
        let source = fs::read_to_string(&file).unwrap();
        let relative = file.strip_prefix(&commands_root).unwrap();
        if source.contains("pub use crate::infrastructure::command_services::") {
            violations.push(format!(
                "{} delegates command ownership through an infrastructure facade",
                relative.display()
            ));
        }
        if !matches!(relative, path if path == Path::new("mod.rs"))
            && source.contains("#[tauri::command]")
            && source.contains("pub use crate::")
        {
            violations.push(format!(
                "{} mixes focused command ownership with wildcard delegation",
                relative.display()
            ));
        }
    }

    assert!(violations.is_empty(), "{}", violations.join("\n"));
}

#[test]
fn connection_workflows_have_no_catch_all_module() {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let forbidden = source_root.join("infrastructure/connections/workflows/mod.rs");
    assert!(
        !forbidden.exists(),
        "infrastructure/connections/workflows/mod.rs is a forbidden catch-all workflow owner"
    );
}

#[test]
fn frozen_sql_has_exact_compatibility_owners() {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_files(&source_root, &mut files);
    for file in files.into_iter().filter(|file| {
        !file
            .strip_prefix(&source_root)
            .unwrap()
            .components()
            .any(|component| component.as_os_str().to_string_lossy().starts_with("tests"))
    }) {
        let source = fs::read_to_string(&file).unwrap();
        let relative = file.strip_prefix(&source_root).unwrap();
        if source.contains("SELECT COUNT(*) FROM ({}) as count_wrapper") {
            assert_eq!(relative, Path::new("count_query_compat.rs"));
        }
        if source.contains("SELECT datetime('now', 'localtime')") || source.contains("SELECT NOW()")
        {
            assert_eq!(relative, Path::new("server_time_compat.rs"));
        }
    }
}
