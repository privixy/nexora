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
fn command_modules_do_not_own_sql_filesystem_keychain_or_builtin_drivers() {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_files(&source_root.join("commands"), &mut files);
    assert!(!files.is_empty());

    for file in files
        .into_iter()
        .filter(|file| !file.to_string_lossy().contains("/commands/tests/"))
    {
        let source = fs::read_to_string(&file).unwrap();
        for forbidden in [
            "sqlx::",
            "crate::drivers::mysql",
            "crate::drivers::postgres",
            "crate::drivers::sqlite",
            "get_mysql_pool",
            "get_postgres_pool",
            "get_sqlite_pool",
        ] {
            assert!(
                !source.contains(forbidden),
                "{} contains {forbidden}",
                file.display()
            );
        }
    }
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
