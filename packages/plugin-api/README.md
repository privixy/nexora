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

## License

Apache-2.0
