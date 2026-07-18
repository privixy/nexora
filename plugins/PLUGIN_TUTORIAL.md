# Your first Nexora driver

Use the plugin scaffolder to create a driver plugin:

```bash
npm create @nexora/plugin@latest my-driver
```

Then build and install it into your local Nexora plugin directory:

```bash
cd my-driver
just dev-install
```

The generated project includes a Rust JSON-RPC driver skeleton, a manifest, and optional UI extension support.
