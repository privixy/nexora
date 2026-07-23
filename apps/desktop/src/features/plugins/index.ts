export type {
  DriverCapabilities,
  InstalledPluginInfo,
  PluginManifest,
  PluginSettingDefinition,
  PluginSettingType,
  PluginSlotRegistryType,
  RegistryPluginWithStatus,
  RegistryReleaseWithStatus,
  SlotComponentProps,
  SlotContext,
  SlotContribution,
  SlotName,
  UIExtensionDeclaration,
  UIExtensionManifestEntry,
} from "./contracts";

export { PluginModalProvider } from "./state/PluginModalProvider";
export { PluginSlotProvider } from "./state/PluginSlotProvider";
export { SlotAnchor } from "./components/SlotAnchor";
export { useDrivers } from "./hooks/useDrivers";
export { usePluginRegistry } from "./hooks/usePluginRegistry";
export { usePluginSlotRegistry } from "./hooks/usePluginSlotRegistry";
export {
  openUrl,
  usePluginConnection,
  usePluginModal,
  usePluginQuery,
  usePluginSetting,
  usePluginTheme,
  usePluginToast,
  usePluginTranslation,
} from "./hooks/usePluginApi";
export { PluginSettingsPage } from "./components/PluginSettingsPage";
export { PluginsTab } from "./components/PluginsTab";
export {
  getDatabaseList,
  getEffectiveDatabase,
  isMultiDatabaseCapable,
} from "./lib/databaseCapabilities";
export {
  getCapabilitiesForDriver,
  isLocalDriver,
  isReadonly,
  supportsAlterColumn,
  supportsCreateDatabase,
  supportsCreateForeignKeys,
  supportsCreateSchema,
  supportsDropDatabase,
  supportsManageTables,
  supportsRenameDatabase,
  supportsTruncateTable,
} from "./lib/driverCapabilities";
