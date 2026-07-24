# @nexora/plugin-api

Public API surface for Nexora plugin UI extensions.

Plugin bundles import hooks, helpers and shared types from this package. The Nexora host injects the runtime implementation at load time.

## Install

```bash
npm install --save-dev @nexora/plugin-api
```

## Usage

```tsx
import { defineSlot, usePluginConnection } from "@nexora/plugin-api";
```

## Verification

`packages/plugin-api/` owns its runtime tests, compiler contracts, fresh `.tmp/build`, canonical staged tarball, checksum, and read-only package inspection. `check:sync` compares normalized host and package declarations with the reviewed contract baseline without rewriting declarations.

`pluginPackageVersion`, `pluginApiVersion`, and `hostApiVersion` remain separate compatibility values; desktop and root application release versions are excluded. New, changed, resolved, stale-allowlist, and version drift fail verification.

```bash
pnpm test:plugin-api
pnpm typecheck:plugin-api
pnpm build:plugin-api
pnpm check:plugin-api
pnpm pack:plugin-api
```

## License

Apache-2.0
