import type { PluginManifest } from "../../../src/features/plugins/contracts";

type ConfigManifestFixture = {
  id: string;
  name: string;
  version: string;
  description: string;
  executable?: string;
  capabilities: Record<string, unknown>;
  data_types?: unknown[];
  ui_extensions?: Array<{ slot: string; module: string; order?: number; driver?: string }>;
};

const rawUiOnly: ConfigManifestFixture = {
  id: "ui-only", name: "UI Only", version: "1.0.0", description: "UI", capabilities: {},
  ui_extensions: [{ slot: "unknown.slot", module: "ui.js" }],
};
void rawUiOnly;

const projected = {
  id: "ui-only",
  name: "UI Only",
  version: "1.0.0",
  description: "UI",
  default_port: null,
  capabilities: {
    schemas: false, views: false, routines: false, file_based: false, folder_based: false,
    identifier_quote: "\"", alter_primary_key: true,
  },
  ui_extensions: [{ slot: "unknown.slot", module: "ui.js" }],
} satisfies PluginManifest;
void projected;

// @ts-expect-error Rust config manifests are not frontend projected manifests
const invalidProjected: PluginManifest = rawUiOnly;
void invalidProjected;
