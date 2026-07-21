import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Settings } from "../../src/pages/Settings";
import { useDrivers } from "../../src/hooks/useDrivers";
import { useSettings } from "../../src/hooks/useSettings";
import { DEFAULT_SETTINGS } from "../../src/contexts/SettingsContext";

vi.mock("../../src/hooks/useDrivers", () => ({
  useDrivers: vi.fn(),
}));

vi.mock("../../src/hooks/useSettings", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../../src/components/modals/ConfigJsonModal", () => ({
  ConfigJsonModal: () => null,
}));

vi.mock("../../src/components/settings/GeneralTab", () => ({
  GeneralTab: () => <div>general tab</div>,
}));

vi.mock("../../src/components/settings/AppearanceTab", () => ({
  AppearanceTab: () => null,
}));

vi.mock("../../src/components/settings/LocalizationTab", () => ({
  LocalizationTab: () => null,
}));

vi.mock("../../src/components/settings/AiTab", () => ({
  AiTab: () => null,
}));

vi.mock("../../src/components/settings/LogsTab", () => ({
  LogsTab: () => null,
}));

vi.mock("../../src/components/settings/ShortcutsTab", () => ({
  ShortcutsTab: () => null,
}));

vi.mock("../../src/components/settings/PluginsTab", () => ({
  PluginsTab: () => null,
}));

vi.mock("../../src/components/settings/SshTab", () => ({
  SshTab: () => null,
}));

vi.mock("../../src/components/settings/AiActivityPanel", () => ({
  AiActivityPanel: () => null,
}));

vi.mock("../../src/components/settings/InfoTab", () => ({
  InfoTab: () => null,
}));

vi.mock("../../src/components/settings/PluginSettingsPage", () => ({
  PluginSettingsPage: () => null,
}));

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDrivers).mockReturnValue({
      drivers: [],
      allDrivers: [],
      installedPlugins: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    vi.mocked(useSettings).mockReturnValue({
      settings: DEFAULT_SETTINGS,
      updateSetting: vi.fn(),
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
    });
  });

  it("keeps the page wrapper fixed and scrolls only internal settings panes", () => {
    render(<Settings />);

    const root = screen.getByText("settings.title").closest(".h-full");
    const panes = root?.querySelectorAll(".custom-scrollbar");

    expect(root).toHaveClass("overflow-hidden");
    expect(panes?.length).toBe(2);
    panes?.forEach((pane) => {
      expect(pane).toHaveClass("min-h-0");
    });
  });
});
