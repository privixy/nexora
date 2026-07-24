#[test]
fn setup_stage_is_present() {
    let source = include_str!("../setup.rs");
    assert!(source.contains("fn attach_setup"));
    assert!(source.contains("builder.setup(move |app|"));
}
