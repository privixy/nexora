use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::task::AbortHandle;

pub(crate) type AbortHandleMap = HashMap<String, Vec<Arc<AbortHandle>>>;

pub(crate) fn register_abort_handle(
    handles: &Mutex<AbortHandleMap>,
    key: String,
    handle: Arc<AbortHandle>,
) {
    let mut guard = handles.lock().unwrap();
    let entry = guard.entry(key).or_default();
    entry.retain(|h| !h.is_finished());
    entry.push(handle);
}

pub(crate) fn unregister_abort_handle(
    handles: &Mutex<AbortHandleMap>,
    key: &str,
    handle: &Arc<AbortHandle>,
) {
    let mut guard = handles.lock().unwrap();
    if let Some(entry) = guard.get_mut(key) {
        entry.retain(|h| !Arc::ptr_eq(h, handle));
        if entry.is_empty() {
            guard.remove(key);
        }
    }
}

pub(crate) fn abort_slot(handles: &Mutex<AbortHandleMap>, key: &str) -> Vec<Arc<AbortHandle>> {
    handles.lock().unwrap().remove(key).unwrap_or_default()
}

#[cfg(test)]
mod tests;
