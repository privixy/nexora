use std::sync::atomic::{AtomicBool, Ordering};

static DEBUG_MODE: AtomicBool = AtomicBool::new(false);

pub(crate) fn set_debug_mode(debug: bool) {
    DEBUG_MODE.store(debug, Ordering::Relaxed);
}

#[tauri::command]
pub(crate) fn is_debug_mode() -> bool {
    DEBUG_MODE.load(Ordering::Relaxed)
}

#[tauri::command]
pub(crate) fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
    log::info!("DevTools opened");
}

#[tauri::command]
pub(crate) fn close_devtools(window: tauri::WebviewWindow) {
    window.close_devtools();
    log::info!("DevTools closed");
}
