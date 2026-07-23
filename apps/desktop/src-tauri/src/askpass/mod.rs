mod client;
mod protocol;
mod server;

pub use crate::commands::askpass::{respond_ssh_askpass, set_app_handle, start_frontend_server};
pub use client::maybe_run_askpass_client;
pub use protocol::PromptKind;
pub use server::{AskpassServer, AskpassUi};

#[cfg(test)]
mod tests;
