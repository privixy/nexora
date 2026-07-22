pub mod install;
pub mod preflight;
pub mod protocol;
mod audit;
mod connections;
mod resources;
mod router;
mod server;
mod tools;

pub use server::run_mcp_server;

#[cfg(test)]
mod tests;
