#![allow(unused_imports)]

use nexora_lib::commands::{
    apply_export_payload, build_routine_call_sql, cancel_query, count_query,
    create_connection_group, create_database, create_group_path, create_schema, create_trigger,
    create_view, decrypt_export_payload, delete_connection, delete_connection_group, delete_record,
    delete_ssh_connection, disconnect_connection, drop_database, drop_foreign_key_action,
    drop_index_action, drop_routine, drop_table, drop_trigger, drop_view, duplicate_connection,
    encrypt_export_payload, execute_query, execute_query_batch, explain_query_plan,
    export_connections_payload, fetch_blob_as_data_url, find_connection_by_id,
    get_active_connections, get_add_column_sql, get_ai_schema_context, get_alter_column_sql,
    get_available_databases, get_columns, get_connection_by_id, get_connection_groups,
    get_connections, get_connections_with_groups, get_create_foreign_key_sql, get_create_index_sql,
    get_create_table_sql, get_data_types, get_driver_manifest, get_file_stats, get_foreign_keys,
    get_indexes, get_k8s_connections, get_k8s_contexts_cmd, get_k8s_namespaces_cmd,
    get_k8s_resource_ports_cmd, get_k8s_resources_cmd, get_keybindings,
    get_materialized_view_columns, get_materialized_view_definition, get_materialized_views,
    get_registered_drivers, get_routine_create_template, get_routine_definition,
    get_routine_edit_script, get_routine_parameters, get_routines, get_schema_snapshot,
    get_schemas, get_server_now, get_ssh_connections, get_tables, get_trigger_definition,
    get_triggers, get_view_columns, get_view_definition, get_views, import_connections_payload,
    insert_record, list_databases, load_blob_from_file, map_inferred_column_types,
    move_connection_to_group, move_group_to_parent, open_er_diagram_window, read_file_as_data_url,
    refresh_materialized_view, register_active_connection, rename_database,
    reorder_connections_in_group, reorder_groups, resolve_connection_params,
    resolve_connection_params_with_id, save_blob_to_file, save_connection, save_keybindings,
    save_ssh_connection, set_connection_appearance, set_window_title, test_connection,
    test_k8s_connection_cmd, test_ssh_connection, truncate_table, update_connection,
    update_connection_group, update_record, update_ssh_connection, QueryCancellationState,
};

#[test]
fn public_command_imports_remain_available() {}

#[test]
fn command_families_have_exact_single_owners() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/commands");
    let families = [
        "connection_store.rs",
        "ssh.rs",
        "kubernetes.rs",
        "connection_groups.rs",
        "connection_transfer.rs",
        "catalog.rs",
        "routines.rs",
        "views.rs",
        "triggers.rs",
        "records.rs",
        "blobs.rs",
        "queries.rs",
        "connection_lifecycle.rs",
        "ddl.rs",
        "drivers.rs",
        "keybindings.rs",
        "windows.rs",
    ];
    let module = std::fs::read_to_string(root.join("mod.rs")).expect("missing commands/mod.rs");
    for family in families {
        let source = std::fs::read_to_string(root.join(family))
            .unwrap_or_else(|_| panic!("missing command family: {family}"));
        assert!(source.contains("pub use crate::infrastructure::command_services::"));
        let owner = std::fs::read_to_string(
            root.parent()
                .unwrap()
                .join("infrastructure/command_services")
                .join(family),
        )
        .unwrap_or_else(|_| panic!("missing command service owner: {family}"));
        assert!(owner.contains("#[tauri::command]"));
        let module_name = family.trim_end_matches(".rs");
        assert!(module.contains(&format!("mod {module_name};")));
        assert!(module.contains(&format!("pub use {module_name}::*;")));
    }
}
