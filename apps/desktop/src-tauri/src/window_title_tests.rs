#[cfg(test)]
mod tests {
    use crate::window_title::format_window_title;

    #[test]
    fn capitalizes_the_base_window_title() {
        assert_eq!(format_window_title(None), "Nexora");
    }

    #[test]
    fn capitalizes_a_detailed_window_title() {
        assert_eq!(
            format_window_title(Some("Task Manager")),
            "Nexora - Task Manager"
        );
    }
}
