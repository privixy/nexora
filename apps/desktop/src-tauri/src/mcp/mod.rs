mod audit;
mod connections;
pub mod install;
pub mod preflight;
pub mod protocol;
mod resources;
mod router;
mod server;
mod tools;

pub use server::run_mcp_server;

#[cfg(test)]
mod tests;
