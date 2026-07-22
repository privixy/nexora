import type { ComponentProps } from "react";
import { PluginSettingsPage } from "../../components/settings/PluginSettingsPage";
import { PluginsTab } from "../../components/settings/PluginsTab";
import { useDrivers } from "../../hooks/useDrivers";

export function useLegacyPluginSettingsComposition() {
  const { allDrivers, installedPlugins, refresh } = useDrivers();
  const pluginTabs = new Map<string, { id: string; name: string }>();

  for (const driver of allDrivers) {
    if (driver.is_builtin && (driver.settings?.length ?? 0) === 0) continue;
    pluginTabs.set(driver.id, { id: driver.id, name: driver.name });
  }

  for (const plugin of installedPlugins) {
    pluginTabs.set(plugin.id, { id: plugin.id, name: plugin.name });
  }

  return {
    pluginTabs: Array.from(pluginTabs.values()),
    onPluginsChanged: refresh,
    renderPluginTab: (props: ComponentProps<typeof PluginsTab>) => (
      <PluginsTab {...props} />
    ),
    renderPluginSettings: (pluginId: string) => (
      <PluginSettingsPage key={pluginId} pluginId={pluginId} />
    ),
  };
}
