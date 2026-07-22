use std::path::Path;

fn fixture_lines(source: &str) -> Vec<String> {
    source
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect()
}

fn extract_delimited(source: &str, start_marker: &str, end_marker: &str) -> String {
    let start = source
        .find(start_marker)
        .unwrap_or_else(|| panic!("missing marker: {start_marker}"))
        + start_marker.len();
    let end = source[start..]
        .find(end_marker)
        .map(|offset| start + offset)
        .unwrap_or_else(|| panic!("missing end marker: {end_marker}"));
    source[start..end].to_owned()
}

fn extract_generate_handler_paths(source: &str) -> Vec<String> {
    extract_delimited(source, "tauri::generate_handler![", "])")
        .lines()
        .filter_map(|line| {
            let normalized = line.split("//").next().unwrap_or_default().trim();
            let normalized = normalized.trim_end_matches(',').trim();
            (!normalized.is_empty()).then(|| normalized.to_owned())
        })
        .collect()
}

fn extract_managed_state_types(source: &str) -> Vec<String> {
    let setup = source.find(".setup(").expect("missing setup attachment");
    let builder = source[..setup]
        .rfind("tauri::Builder::default()")
        .expect("missing builder");
    let mut states = Vec::new();
    let mut cursor = builder;
    while let Some(offset) = source[cursor..setup].find(".manage(") {
        let start = cursor + offset + ".manage(".len();
        let mut depth = 1;
        let mut end = start;
        for (index, character) in source[start..setup].char_indices() {
            match character {
                '(' => depth += 1,
                ')' => {
                    depth -= 1;
                    if depth == 0 {
                        end = start + index;
                        break;
                    }
                }
                _ => {}
            }
        }
        let expression = source[start..end]
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        let normalized = match expression.as_str() {
            "log_buffer" => "SharedLogBuffer".to_owned(),
            value if value.contains("credential_cache::CredentialCache") => {
                "Arc<credential_cache::CredentialCache>".to_owned()
            }
            value if value.contains("connection_cache::ConnectionCache") => {
                "Arc<connection_cache::ConnectionCache>".to_owned()
            }
            _ => expression
                .strip_suffix("::default()")
                .unwrap_or(&expression)
                .to_owned(),
        };
        states.push(normalized);
        cursor = end + 1;
    }
    states
}

#[test]
fn tauri_handler_registration_matches_baseline() {
    let source = include_str!("../src/lib.rs");
    let actual = extract_generate_handler_paths(source);
    let expected = fixture_lines(include_str!("fixtures/tauri-command-registration.txt"));
    assert_eq!(actual, expected);
}

#[test]
fn managed_state_registration_matches_baseline() {
    let source = include_str!("../src/lib.rs");
    let actual = extract_managed_state_types(source);
    let expected = fixture_lines(include_str!("fixtures/managed-state-registration.txt"));
    assert_eq!(actual, expected, "actual: {actual:#?}");
}

#[test]
fn fragile_command_registration_is_preserved() {
    let handlers = extract_generate_handler_paths(include_str!("../src/lib.rs"));
    for handler in [
        "commands::execute_query_batch",
        "export::export_query_to_file",
        "dump_commands::import_database",
        "commands::register_active_connection",
        "commands::get_active_connections",
        "commands::disconnect_connection",
    ] {
        assert_eq!(handlers.iter().filter(|entry| *entry == handler).count(), 1);
    }
    assert_eq!(
        handlers
            .iter()
            .filter(|entry| entry.as_str() == "dump_commands::cancel_dump")
            .count(),
        2
    );
}

#[test]
#[ignore = "target contract activated by Task 3"]
fn target_app_builder_stages_match_frozen_sequence() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/app");
    let module = std::fs::read_to_string(root.join("mod.rs")).expect("missing src/app/mod.rs");
    let plugins = std::fs::read_to_string(root.join("plugins.rs")).expect("missing plugins.rs");
    let state = std::fs::read_to_string(root.join("state.rs")).expect("missing state.rs");
    let setup = std::fs::read_to_string(root.join("setup.rs")).expect("missing setup.rs");
    let commands = std::fs::read_to_string(root.join("commands.rs")).expect("missing commands.rs");

    let stages = ["attach_plugins", "manage_state", "attach_setup", "register_commands"];
    let positions: Vec<_> = stages
        .iter()
        .map(|stage| module.find(stage).unwrap_or_else(|| panic!("missing stage: {stage}")))
        .collect();
    assert!(positions.windows(2).all(|pair| pair[0] < pair[1]));
    assert_eq!(
        extract_generate_handler_paths(&commands),
        fixture_lines(include_str!("fixtures/tauri-command-registration.txt"))
    );
    assert_eq!(
        extract_managed_state_types(&state),
        fixture_lines(include_str!("fixtures/managed-state-registration.txt"))
    );
    for plugin in [
        "tauri_plugin_updater::Builder::new().build()",
        "tauri_plugin_clipboard_manager::init()",
        "tauri_plugin_opener::init()",
        "tauri_plugin_dialog::init()",
        "tauri_plugin_fs::init()",
        "tauri_plugin_notification::init()",
    ] {
        assert!(plugins.contains(plugin));
    }
    assert!(setup.contains(".setup(move |app|"));
}
