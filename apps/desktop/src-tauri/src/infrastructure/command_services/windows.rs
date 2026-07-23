use tauri::{AppHandle, Manager};



#[tauri::command]
pub async fn set_window_title(app: AppHandle, title: String) -> Result<(), String> {
    // Get the main window
    let window = app
        .get_webview_window("main")
        .ok_or("Failed to get main window")?;

    // Set title using standard Tauri API (works on all platforms)
    window
        .set_title(&title)
        .map_err(|e| format!("Failed to set window title: {}", e))?;

    // Apply Wayland-specific workaround on Linux
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::{BinExt, Cast, GtkWindowExt, HeaderBarExt};
        use gtk::{EventBox, HeaderBar};

        // Get the GTK window
        let gtk_window = window
            .gtk_window()
            .map_err(|e| format!("Failed to get GTK window: {}", e))?;

        // Check if we have a custom titlebar (Wayland uses EventBox with HeaderBar)
        if let Some(titlebar) = gtk_window.titlebar() {
            // Try to downcast to EventBox (Wayland)
            if let Ok(event_box) = titlebar.downcast::<EventBox>() {
                // Get the HeaderBar child and set its title
                if let Some(child) = event_box.child() {
                    if let Ok(header_bar) = child.downcast::<HeaderBar>() {
                        header_bar.set_title(Some(&title));
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn open_er_diagram_window(
    app: AppHandle,
    connection_id: String,
    connection_name: String,
    database_name: String,
    focus_table: Option<String>,
    schema: Option<String>,
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let window = crate::domains::queries::build_er_window(
        &connection_id,
        &connection_name,
        &database_name,
        focus_table.as_deref(),
        schema.as_deref(),
    );
    let label = window.label;
    let url = window.url;
    let title = window.title;

    // If a diagram window for this exact database already exists, just focus it
    // instead of failing to build a second window with the same label.
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let _webview = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(1200.0, 800.0)
        .center()
        .build()
        .map_err(|e| format!("Failed to create ER Diagram window: {}", e))?;

    Ok(())
}
