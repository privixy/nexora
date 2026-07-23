# Plugin Manifest Compatibility Baseline

Shared fixtures under `plugins/fixtures/manifests/` characterize each manifest-facing layer independently. They are neutral inputs, not globally valid or invalid examples.

| Fixture | JSON Schema | Rust configuration | Frontend projection/runtime | create-plugin |
|---|---|---|---|---|
| `minimal-driver` | rejects undeclared `$schema` | accepts and defaults omitted fields | projected canonical fields are assignable | matches the generated driver shape after substitution |
| `full-driver` | reports every unsupported root/capability property | accepts unknown fields and all supported fields | consumes Rust-projected canonical fields | not applicable |
| `ui-only` | requires driver fields and rejects `ui_extensions` | accepts missing executable/data types | supports projected UI entries | not applicable |
| `aliases` | accepts two connection aliases and rejects Rust-only aliases | applies Serde aliases | receives canonical projected names | not applicable |
| `unknown-capability` | rejects the isolated capability | ignores it | safe defaults remain | not applicable |
| `unknown-slot` | rejects unsupported `ui_extensions` root only | preserves the slot string | utility warns before loading; provider executes then silently filters | not applicable |
