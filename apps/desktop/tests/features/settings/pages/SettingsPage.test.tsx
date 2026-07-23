import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SettingsPage } from "../../../../src/features/settings/pages/SettingsPage";
import { useSettings } from "../../../../src/features/settings/hooks/useSettings";
import { DEFAULT_SETTINGS } from "../../../../src/features/settings/state/SettingsContext";

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../../../../src/features/settings/components/ConfigJsonModal", () => ({
  ConfigJsonModal: () => null,
}));

vi.mock("../../../../src/features/settings/components/GeneralTab", () => ({
  GeneralTab: () => <div>general tab</div>,
}));

vi.mock("../../../../src/features/settings/components/AppearanceTab", () => ({
  AppearanceTab: () => null,
}));

vi.mock("../../../../src/features/settings/components/LocalizationTab", () => ({
  LocalizationTab: () => null,
}));

vi.mock("../../../../src/features/settings/components/AiTab", () => ({
  AiTab: () => null,
}));

vi.mock("../../../../src/features/settings/components/LogsTab", () => ({
  LogsTab: () => null,
}));

vi.mock("../../../../src/features/settings/components/ShortcutsTab", () => ({
  ShortcutsTab: () => null,
}));

vi.mock("../../../../src/features/plugins/components/PluginsTab", () => ({
  PluginsTab: ({
    onOpenPluginSettings,
    onPluginsChanged,
  }: {
    onOpenPluginSettings: (pluginId: string) => void;
    onPluginsChanged: (change: {
      type: "install" | "remove";
      pluginId: string;
      pluginName?: string;
    }) => void;
  }) => (
    <div>
      <button onClick={() => onOpenPluginSettings("plugin-b")}>open plugin settings</button>
      <button
        onClick={() =>
          onPluginsChanged({
            type: "install",
            pluginId: "plugin-c",
            pluginName: "Charlie Plugin",
          })
        }
      >
        install plugin
      </button>
      <button
        onClick={() =>
          onPluginsChanged({ type: "remove", pluginId: "plugin-b" })
        }
      >
        remove plugin
      </button>
    </div>
  ),
}));

vi.mock("../../../../src/features/settings/components/SshTab", () => ({
  SshTab: () => null,
}));

vi.mock("../../../../src/features/settings/components/AiActivityPanel", () => ({
  AiActivityPanel: () => null,
}));

vi.mock("../../../../src/features/settings/components/InfoTab", () => ({
  InfoTab: () => null,
}));

vi.mock("../../../../src/features/plugins/components/PluginSettingsPage", () => ({
  PluginSettingsPage: ({ pluginId }: { pluginId: string }) => (
    <div>plugin settings: {pluginId}</div>
  ),
}));

describe("Settings page", () => {
  it("renders the injected SSH settings composition", async () => {
    render(<SettingsPage appVersion="1.0.3" renderSshTab={() => <div>ssh composition</div>} />);

    fireEvent.click(screen.getByText("sshConnections.title"));

    expect(screen.getByText("ssh composition")).toBeInTheDocument();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSettings).mockReturnValue({
      settings: DEFAULT_SETTINGS,
      updateSetting: vi.fn(),
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
    });
  });

  it("keeps the page wrapper fixed and scrolls only internal settings panes", () => {
    render(<SettingsPage appVersion="1.0.3" />);

    const root = screen.getByText("settings.title").closest(".h-full");
    const panes = root?.querySelectorAll(".custom-scrollbar");

    expect(root).toHaveClass("overflow-hidden");
    expect(panes?.length).toBe(2);
    panes?.forEach((pane) => {
      expect(pane).toHaveClass("min-h-0");
    });
  });

  it("opens a plugin settings page from the plugin tab", () => {
    render(
      <SettingsPage appVersion="1.0.3"
        pluginTabs={[{ id: "plugin-b", name: "Bravo Plugin" }]}
        renderPluginTab={(props) => (
          <button onClick={() => props.onOpenPluginSettings("plugin-b")}>
            open plugin settings
          </button>
        )}
        renderPluginSettings={(pluginId) => (
          <div>plugin settings: {pluginId}</div>
        )}
      />,
    );

    fireEvent.click(screen.getByText("settings.plugins.title"));
    fireEvent.click(screen.getByText("open plugin settings"));

    expect(screen.getByText("plugin settings: plugin-b")).toBeInTheDocument();
  });

  it("updates plugin sidebar tabs after installation and removal", () => {
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        ...DEFAULT_SETTINGS,
        activeExternalDrivers: ["plugin-b", "plugin-c"],
      },
      updateSetting: vi.fn(),
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
    });

    const onPluginsChanged = vi.fn();
    render(
      <SettingsPage appVersion="1.0.3"
        pluginTabs={[{ id: "plugin-b", name: "Bravo Plugin" }]}
        onPluginsChanged={onPluginsChanged}
        renderPluginTab={(props) => (
          <div>
            <button
              onClick={() =>
                props.onPluginsChanged({
                  type: "install",
                  pluginId: "plugin-c",
                  pluginName: "Charlie Plugin",
                })
              }
            >
              install plugin
            </button>
            <button
              onClick={() =>
                props.onPluginsChanged({ type: "remove", pluginId: "plugin-b" })
              }
            >
              remove plugin
            </button>
          </div>
        )}
      />,
    );

    expect(screen.getByText("Bravo Plugin")).toBeInTheDocument();
    fireEvent.click(screen.getByText("settings.plugins.title"));
    fireEvent.click(screen.getByText("install plugin"));
    expect(screen.getByText("Charlie Plugin")).toBeInTheDocument();
    expect(onPluginsChanged).toHaveBeenCalledWith({
      type: "install",
      pluginId: "plugin-c",
      pluginName: "Charlie Plugin",
    });

    fireEvent.click(screen.getByText("remove plugin"));
    expect(screen.queryByText("Bravo Plugin")).not.toBeInTheDocument();
    expect(onPluginsChanged).toHaveBeenLastCalledWith({
      type: "remove",
      pluginId: "plugin-b",
    });
  });
});
