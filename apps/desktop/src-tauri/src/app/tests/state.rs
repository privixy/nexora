#[test]
fn state_stage_is_present() {
    let source = include_str!("../state.rs");
    assert!(source.contains("fn manage_state"));
    assert_eq!(source.matches(".manage(").count(), 11);
}
