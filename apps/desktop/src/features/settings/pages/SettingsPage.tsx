import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings as SettingsIcon,
  Palette,
  Languages,
  Sparkles,
  ScrollText,
  Keyboard,
  Plug,
  Info,
  FileJson,
  Shield,
  Cable,
} from "lucide-react";
import clsx from "clsx";
import { ConfigJsonModal } from "../../../shared/ui/ConfigJsonModal";
import { GeneralTab } from "../components/GeneralTab";
import { AppearanceTab } from "../components/AppearanceTab";
import { LocalizationTab } from "../components/LocalizationTab";
import { AiTab } from "../components/AiTab";
import { LogsTab } from "../components/LogsTab";
import { ShortcutsTab } from "../components/ShortcutsTab";
import { AiActivityPanel } from "../components/AiActivityPanel";
import { InfoTab } from "../components/InfoTab";
import { useSettings } from "../hooks/useSettings";

type SettingsTab =
  | "general"
  | "ssh"
  | "appearance"
  | "localization"
  | "ai"
  | "ai-activity"
  | "logs"
  | "shortcuts"
  | "plugins"
  | "info"
  | `plugin:${string}`;

interface PluginSidebarChange {
  type: "install" | "remove";
  pluginId: string;
  pluginName?: string;
}

interface PluginTab {
  id: string;
  name: string;
}

interface SettingsPageProps {
  pluginTabs?: PluginTab[];
  onPluginsChanged?: (change: PluginSidebarChange) => void;
  renderPluginTab?: (props: {
    onOpenPluginSettings: (pluginId: string) => void;
    onPluginsChanged: (change: PluginSidebarChange) => void;
  }) => React.ReactNode;
  renderPluginSettings?: (pluginId: string) => React.ReactNode;
  renderSshTab?: () => React.ReactNode;
  renderAiActivity?: () => React.ReactNode;
}

const TAB_ITEMS: Array<{
  id: SettingsTab;
  icon: React.ComponentType<{ size: number }>;
  labelKey: string;
}> = [
  { id: "general", icon: SettingsIcon, labelKey: "settings.general" },
  { id: "ssh", icon: Cable, labelKey: "sshConnections.title" },
  { id: "plugins", icon: Plug, labelKey: "settings.plugins.title" },
  { id: "appearance", icon: Palette, labelKey: "settings.appearance" },
  { id: "localization", icon: Languages, labelKey: "settings.localization" },
  { id: "ai", icon: Sparkles, labelKey: "settings.ai.tab" },
  { id: "ai-activity", icon: Shield, labelKey: "settings.aiActivity" },
  { id: "logs", icon: ScrollText, labelKey: "settings.logs" },
  { id: "shortcuts", icon: Keyboard, labelKey: "settings.shortcuts.title" },
  { id: "info", icon: Info, labelKey: "settings.info" },
];

const TAB_COMPONENTS: Partial<Record<SettingsTab, React.ComponentType>> = {
  general: GeneralTab,
  appearance: AppearanceTab,
  localization: LocalizationTab,
  ai: AiTab,
  "ai-activity": AiActivityPanel,
  logs: LogsTab,
  shortcuts: ShortcutsTab,
  info: InfoTab,
};

export const SettingsPage = ({
  pluginTabs: suppliedPluginTabs = [],
  onPluginsChanged,
  renderPluginTab,
  renderPluginSettings,
  renderSshTab,
  renderAiActivity,
}: SettingsPageProps) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const activeExternalDrivers = settings.activeExternalDrivers;
  const [requestedTab, setRequestedTab] = useState<SettingsTab>("general");
  const [isConfigJsonModalOpen, setIsConfigJsonModalOpen] = useState(false);
  const [pluginSidebarOverrides, setPluginSidebarOverrides] = useState<
    Record<string, string | null>
  >({});

  const handlePluginsChanged = useCallback(
    (change: PluginSidebarChange) => {
      setPluginSidebarOverrides((prev) => {
        const next = { ...prev };
        if (change.type === "install") {
          next[change.pluginId] = change.pluginName ?? change.pluginId;
        } else {
          next[change.pluginId] = null;
        }
        return next;
      });
      onPluginsChanged?.(change);
    },
    [onPluginsChanged],
  );

  const pluginSettingItems = new Map<string, { id: string; name: string }>();

  for (const plugin of suppliedPluginTabs) {
    if (pluginSidebarOverrides[plugin.id] === null) continue;
    pluginSettingItems.set(plugin.id, plugin);
  }

  for (const [pluginId, pluginName] of Object.entries(pluginSidebarOverrides)) {
    if (
      pluginName !== null &&
      !suppliedPluginTabs.some((plugin) => plugin.id === pluginId) &&
      (activeExternalDrivers === undefined ||
        activeExternalDrivers.includes(pluginId))
    ) {
      pluginSettingItems.set(pluginId, {
        id: pluginId,
        name: pluginName,
      });
    }
  }

  const pluginTabs = Array.from(pluginSettingItems.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const isRequestedPluginTab = requestedTab.startsWith("plugin:");
  const requestedPluginId = isRequestedPluginTab
    ? requestedTab.slice("plugin:".length)
    : null;
  const hasRequestedPluginTab =
    requestedPluginId !== null &&
    pluginTabs.some((plugin) => plugin.id === requestedPluginId);
  const activeTab =
    isRequestedPluginTab && !hasRequestedPluginTab
      ? "plugins"
      : requestedTab;
  const ActiveComponent = TAB_COMPONENTS[activeTab];
  const activeComposition =
    activeTab === "ai-activity" ? renderAiActivity?.() : undefined;
  const activePluginId = activeTab.startsWith("plugin:")
    ? activeTab.slice("plugin:".length)
    : null;

  return (
    <div className="h-full min-h-0 overflow-hidden bg-base">
      <div className="h-full min-h-0 px-6 py-6 lg:px-10 lg:py-8">
        <div className="relative mx-auto grid h-full min-h-0 w-full max-w-7xl grid-cols-[13rem_minmax(0,1fr)] overflow-hidden rounded-[2rem] border border-default bg-elevated/70 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-blue-600/12 via-purple-500/8 to-transparent pointer-events-none" />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <nav className="relative flex min-h-0 flex-col border-r border-default bg-base/35 shrink-0">
            <div className="border-b border-default px-4 py-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/20">
                <SettingsIcon size={18} />
              </div>
              <h1 className="text-lg font-bold text-primary tracking-tight">
                {t("settings.title")}
              </h1>
            </div>
            <div className="min-h-0 flex-1 py-3 px-2 overflow-y-auto space-y-0.5 custom-scrollbar">
          {TAB_ITEMS.map(({ id, icon: Icon, labelKey }) => (
            <div key={id} className="space-y-1">
              <button
                onClick={() => setRequestedTab(id)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left",
                  activeTab === id ||
                    (id === "plugins" && activePluginId !== null)
                    ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20"
                    : "text-muted hover:text-primary hover:bg-surface-secondary/50",
                )}
              >
                <Icon size={16} />
                <span className="truncate">{t(labelKey)}</span>
                {id === "plugins" && pluginTabs.length > 0 && (
                  <span className="ml-auto rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                    {pluginTabs.length}
                  </span>
                )}
              </button>

              {id === "plugins" && pluginTabs.length > 0 && (
                <div className="pl-4 space-y-0.5">
                  {pluginTabs.map((plugin) => {
                    const pluginTabId = `plugin:${plugin.id}` as const;
                    return (
                      <button
                        key={plugin.id}
                        onClick={() => setRequestedTab(pluginTabId)}
                        className={clsx(
                          "w-full px-3 py-1.5 rounded-lg text-xs text-left transition-colors truncate",
                          activeTab === pluginTabId
                            ? "bg-blue-500/10 text-blue-300"
                            : "text-muted hover:text-primary hover:bg-surface-secondary/50",
                        )}
                        title={plugin.name}
                      >
                        {plugin.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Config JSON button */}
        <div className="p-2 border-t border-default">
          <button
            onClick={() => setIsConfigJsonModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted hover:text-primary hover:bg-surface-secondary/50 transition-colors"
          >
            <FileJson size={14} />
            {t("settings.editConfigJson")}
          </button>
        </div>
      </nav>

          <div className="relative min-h-0 overflow-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto p-8">
          {activePluginId ? (
            renderPluginSettings?.(activePluginId)
          ) : activeTab === "ssh" ? (
            renderSshTab?.()
          ) : activeTab === "plugins" ? (
            renderPluginTab?.({
              onOpenPluginSettings: (pluginId) =>
                setRequestedTab(`plugin:${pluginId}`),
              onPluginsChanged: handlePluginsChanged,
            })
           ) : activeComposition !== undefined ? (
             activeComposition
           ) : (
             ActiveComponent && <ActiveComponent />
           )}

            </div>
          </div>
        </div>
      </div>

      <ConfigJsonModal
        isOpen={isConfigJsonModalOpen}
        onClose={() => setIsConfigJsonModalOpen(false)}
      />
    </div>
  );
};
