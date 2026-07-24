pub mod ai;
pub mod ai_commands;
pub mod askpass;
pub mod connection_appearance;
pub mod connection_import;
pub mod connection_window;
pub mod debug;
pub mod explain_import;
pub mod json_viewer;
pub mod logs;
pub mod mcp_install;
pub mod notebooks;
pub mod plugin_commands;
pub mod plugin_manager;
pub mod preferences;
pub mod query_history;
pub mod results_window;
pub mod saved_queries;
pub mod task_manager;
pub mod theme;
pub mod updater;

pub use crate::infrastructure::connections::{
    expand_k8s_connection_params, expand_ssh_connection_params, find_connection_by_id,
    get_config_path, get_ssh_config_path, resolve_connection_params,
    resolve_connection_params_with_id, resolve_k8s_params, TauriConnectionContextResolver,
};

pub mod config;
pub use self::config::*;
mod connection_store;
pub use connection_store::*;
mod ssh;
pub use ssh::*;
mod kubernetes;
pub use kubernetes::*;
mod connection_groups;
pub use connection_groups::*;
mod connection_transfer;
pub use connection_transfer::*;
mod catalog;
pub use catalog::*;
mod routines;
pub use routines::*;
mod views;
pub use views::*;
mod triggers;
pub use triggers::*;
mod records;
pub use records::*;
mod blobs;
pub use blobs::*;
mod queries;
pub use queries::*;
mod connection_lifecycle;
pub use connection_lifecycle::*;
mod ddl;
pub use ddl::*;
mod drivers;
pub use drivers::*;
mod keybindings;
pub use keybindings::*;
mod windows;
pub use windows::*;

#[cfg(test)]
pub(crate) use crate::domains::connections::queries::{sanitize_user_query, QueryService};
pub use crate::domains::connections::{apply_export_payload, QueryCancellationState};
#[cfg(test)]
pub(crate) use crate::domains::connections::{
    build_connection_url, find_child_group, merge_groups, parse_group_path,
    reject_if_would_create_cycle, resolve_ssh_test_credential, resolve_ssh_test_password,
    resolve_test_connection_password, set_appearance_impl,
};
pub(crate) use crate::infrastructure::cancellation::{
    register_abort_handle, unregister_abort_handle, AbortHandleMap,
};

#[cfg(test)]
mod tests;
