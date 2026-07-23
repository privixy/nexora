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
            "std::fs",
            "fs::",
            "keychain_utils",
            "persistence::",
            "credential_cache",
            "crate::drivers::mysql",
            "crate::drivers::postgres",
            "crate::drivers::sqlite",
            "get_mysql_pool",
            "get_postgres_pool",
            "get_sqlite_pool",
            "tokio::spawn",
            "spawn_blocking",
            ".execute_query(",
            ".execute_batch(",
            "drivers::registry::get_driver",
        ] {
            if source.contains(forbidden) {
                violations.push(format!("{} contains {forbidden}", file.display()));
            }
        }

        for raw_sql in [
            "SELECT ",
            "INSERT ",
            "UPDATE ",
            "DELETE ",
            "CREATE ",
            "DROP ",
            "ALTER ",
            "TRUNCATE ",
        ] {
            if source.contains(raw_sql) {
                violations.push(format!(
                    "{} contains raw SQL marker {raw_sql}",
                    file.display()
                ));
            }
        }
    }
    assert!(violations.is_empty(), "{}", violations.join("\n"));
}

#[test]
fn command_modules_do_not_process_workflows_directly() {
    let commands_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("src/commands")
        .canonicalize()
        .unwrap();
    let mut files = Vec::new();
    rust_files(&commands_root, &mut files);

    let mut violations = Vec::new();
    for file in files
        .into_iter()
        .filter(|file| !file.to_string_lossy().contains("/commands/tests/"))
    {
        let source = fs::read_to_string(&file).unwrap();
        for forbidden in [
            "read_to_string(",
            "write(",
            "read_dir(",
            "create_dir_all(",
            "serde_json::from_str(",
            "serde_json::to_string_pretty(",
            "for connection in",
            "for statement in",
            "while let Some(",
        ] {
            if source.contains(forbidden) {
                violations.push(format!(
                    "{} directly processes a workflow via {forbidden}",
                    file.display()
                ));
            }
        }
    }
    assert!(violations.is_empty(), "{}", violations.join("\n"));
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
