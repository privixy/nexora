use super::super::manager::ConfigManifest;

fn parse(fixture: &str) -> ConfigManifest {
    let parsed = serde_json::from_str::<ConfigManifest>(fixture);
    if let Err(error) = &parsed {
        panic!("fixture should deserialize in Rust: {error}");
    }
    serde_json::from_str(fixture).unwrap()
}

#[test]
fn records_manifest_fixture_deserialization_and_defaults() {
    let fixtures = [
        (
            include_str!("../../../../../../plugins/fixtures/manifests/minimal-driver.json"),
            true,
        ),
        (
            include_str!("../../../../../../plugins/fixtures/manifests/full-driver.json"),
            true,
        ),
        (
            include_str!("../../../../../../plugins/fixtures/manifests/ui-only.json"),
            false,
        ),
        (
            include_str!("../../../../../../plugins/fixtures/manifests/aliases.json"),
            true,
        ),
        (
            include_str!("../../../../../../plugins/fixtures/manifests/unknown-capability.json"),
            true,
        ),
        (
            include_str!("../../../../../../plugins/fixtures/manifests/unknown-slot.json"),
            false,
        ),
    ];
    for (fixture, accepted) in fixtures {
        assert_eq!(
            serde_json::from_str::<ConfigManifest>(fixture).is_ok(),
            accepted
        );
    }

    let minimal = parse(fixtures[0].0);
    assert_eq!(minimal.id, "fixture-driver");
    assert_eq!(minimal.capabilities.connection_string, true);
    assert!(minimal.ui_extensions.is_none());

    assert!(serde_json::from_str::<ConfigManifest>(fixtures[2].0).is_err());
}

#[test]
fn records_alias_and_unknown_field_behavior() {
    let aliases = parse(include_str!(
        "../../../../../../plugins/fixtures/manifests/aliases.json"
    ));
    assert!(!aliases.capabilities.connection_string);
    assert_eq!(
        aliases.capabilities.connection_string_example,
        "alias://example"
    );
    assert!(aliases.capabilities.create_database);
    assert!(aliases.capabilities.drop_database);
    assert!(aliases.capabilities.rename_database);
    assert!(aliases.capabilities.create_schema);
    assert!(aliases.capabilities.truncate_table);
    assert!(aliases.capabilities.routine_management);
    assert!(aliases.capabilities.supports_ssl);

    let unknown = parse(include_str!(
        "../../../../../../plugins/fixtures/manifests/unknown-capability.json"
    ));
    assert_eq!(unknown.id, "unknown-capability");
    assert!(serde_json::from_str::<ConfigManifest>(include_str!(
        "../../../../../../plugins/fixtures/manifests/unknown-slot.json"
    ))
    .is_err());
}
