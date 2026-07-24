pub use crate::infrastructure::health::{
    active_connections, emit_active_changed, register_connection, restart_ping_loop,
    start_ping_loop, stop_ping_loop, unregister_connection, ACTIVE_CONNECTIONS_CHANGED_EVENT,
    DEFAULT_PING_INTERVAL,
};

#[cfg(test)]
mod tests;
