# Contributing to Nexora

Thanks for your interest in contributing.

## Development setup

```bash
pnpm install
pnpm tauri dev
```

## Checks

Run the relevant checks before opening changes:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

For Rust/backend changes, also run:

```bash
pnpm test:rust
```

## Pull requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Follow the existing TypeScript, React and Rust style.
- Do not include secrets, credentials or private connection details.

## Reporting issues

Use the GitHub issue tracker for reproducible bugs and include steps to reproduce, expected behavior, actual behavior, environment details and relevant logs.
