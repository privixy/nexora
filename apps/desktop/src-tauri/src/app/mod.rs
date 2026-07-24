pub(crate) mod commands;
pub(crate) mod debug;
pub(crate) mod plugins;
pub(crate) mod setup;
pub(crate) mod state;

#[cfg(test)]
mod tests;

use commands::register_commands;
use plugins::attach_plugins;
use setup::attach_setup;
use state::manage_state;

pub fn run_desktop(args: crate::cli::Args, log_buffer: crate::logger::SharedLogBuffer) {
    sqlx::any::install_default_drivers();
    let builder = attach_plugins(tauri::Builder::default());
    let builder = manage_state(builder, log_buffer);
    let builder = attach_setup(builder, args);
    let builder = register_commands(builder);
    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                log::info!("Application exiting, stopping all active SSH tunnels...");
                crate::ssh_tunnel::stop_all_tunnels();
            }
        });
}
