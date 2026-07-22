mod active;
mod events;
mod ping;

pub use active::{active_connections, register_connection, unregister_connection};
pub use events::{emit_active_changed, ACTIVE_CONNECTIONS_CHANGED_EVENT};
pub use ping::{restart_ping_loop, start_ping_loop, stop_ping_loop, DEFAULT_PING_INTERVAL};

#[cfg(test)]
mod tests;
