pub const APP_NAME: &str = "Nexora";

pub fn format_window_title(detail: Option<&str>) -> String {
    match detail {
        Some(detail) => format!("{} - {}", APP_NAME, detail),
        None => APP_NAME.to_string(),
    }
}
