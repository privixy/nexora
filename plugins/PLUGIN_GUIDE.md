# Nexora Plugin Guide

Nexora driver plugins are standalone executables that communicate with the host over JSON-RPC 2.0 via stdin/stdout.

## Manifest

A plugin folder contains a `manifest.json` file and one or more executable releases. Core fields include:

- `id`
- `name`
- `version`
- `driver`
- `entry`
- `capabilities`

## Runtime methods

Common driver methods include:

- `initialize`
- `test_connection`
- `list_databases`
- `list_schemas`
- `list_tables`
- `describe_table`
- `run_query`

Drivers should expose capabilities only for features they actually implement. The host gates UI by capabilities.

## Local install paths

- Linux: `~/.local/share/Nexora/plugins/`
- macOS: `~/Library/Application Support/Nexora/plugins/`
- Windows: `%APPDATA%\Nexora\plugins\`

## UI extensions

UI extensions are optional. Keep host interaction behind the plugin API package and avoid direct access to internal app state.
