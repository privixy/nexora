import type { ComponentType } from "react";
import type { SqlDialect } from "../../shared/types/sql";
import type { ThemeColors } from "../../shared/types/theme";

export interface UsePluginThemeReturn {
  themeId: string | null;
  themeName: string | null;
  isDark: boolean;
  colors: ThemeColors | null;
}

export type PluginTranslator = (key: string, options?: Record<string, unknown>) => string;

export interface DriverCapabilities {
  schemas: boolean;
  views: boolean;
  routines: boolean;
  file_based: boolean;
  folder_based: boolean;
  multiple_databases?: boolean;
  connection_string?: boolean;
  connectionString?: boolean;
  connection_string_example?: string;
  connectionStringExample?: string;
  identifier_quote: string;
  alter_primary_key: boolean;
  auto_increment_keyword?: string;
  serial_type?: string;
  inline_pk?: boolean;
  alter_column?: boolean;
  create_database?: boolean;
  drop_database?: boolean;
  rename_database?: boolean;
  create_schema?: boolean;
  truncate_table?: boolean;
  create_foreign_keys?: boolean;
  no_connection_required?: boolean;
  manage_tables?: boolean;
  readonly?: boolean;
  triggers?: boolean;
  routine_management?: boolean;
  materialized_views?: boolean;
  supports_ssl?: boolean;
  sql_dialect?: SqlDialect;
}

export type PluginSettingType = "string" | "boolean" | "number" | "select";
export interface PluginSettingDefinition {
  key: string;
  label: string;
  type: PluginSettingType;
  default?: string | boolean | number;
  description?: string;
  required?: boolean;
  options?: string[];
}

export interface UIExtensionManifestEntry {
  slot: string;
  module: string;
  order?: number;
  driver?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  default_port: number | null;
  capabilities: DriverCapabilities;
  is_builtin?: boolean;
  default_username?: string;
  color?: string;
  icon?: string;
  settings?: PluginSettingDefinition[];
  ui_extensions?: UIExtensionManifestEntry[];
}

export interface RegistryReleaseWithStatus {
  version: string;
  min_nexora_version: string | null;
  platform_supported: boolean;
}
export interface RegistryPluginWithStatus {
  id: string;
  name: string;
  description: string;
  author: string;
  homepage: string;
  latest_version: string;
  releases: RegistryReleaseWithStatus[];
  installed_version: string | null;
  update_available: boolean;
  platform_supported: boolean;
}
export interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
}

export type SlotName =
  | "row-edit-modal.field.after"
  | "row-edit-modal.footer.before"
  | "row-editor-sidebar.field.after"
  | "row-editor-sidebar.header.actions"
  | "data-grid.toolbar.actions"
  | "data-grid.context-menu.items"
  | "sidebar.footer.actions"
  | "settings.plugin.actions"
  | "settings.plugin.before_settings"
  | "connection-modal.connection_content";
export const VALID_SLOTS: ReadonlySet<string> = new Set<SlotName>([
  "row-edit-modal.field.after",
  "row-edit-modal.footer.before",
  "row-editor-sidebar.field.after",
  "row-editor-sidebar.header.actions",
  "data-grid.toolbar.actions",
  "data-grid.context-menu.items",
  "sidebar.footer.actions",
  "settings.plugin.actions",
  "settings.plugin.before_settings",
  "connection-modal.connection_content",
]);

export interface SlotContext {
  connectionId?: string | null;
  database?: string | null;
  tableName?: string | null;
  schema?: string | null;
  driver?: string | null;
  rowData?: Record<string, unknown>;
  columnName?: string;
  rowIndex?: number;
  isInsertion?: boolean;
  targetPluginId?: string;
  [key: string]: unknown;
}
export interface SlotComponentProps {
  context: SlotContext;
  pluginId: string;
}
export interface SlotContribution {
  pluginId: string;
  slot: SlotName;
  component: ComponentType<SlotComponentProps>;
  order?: number;
  when?: (context: SlotContext) => boolean;
}
export interface UIExtensionDeclaration {
  slot: SlotName;
  module: string;
  order?: number;
  driver?: string;
}
export interface PluginSlotRegistryType {
  contributions: SlotContribution[];
  register: (contribution: SlotContribution) => () => void;
  registerAll: (contributions: SlotContribution[]) => () => void;
  getSlotContributions: (slot: SlotName, context: SlotContext) => SlotContribution[];
}
