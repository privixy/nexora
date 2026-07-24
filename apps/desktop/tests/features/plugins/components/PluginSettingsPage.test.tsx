import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { PluginSettingsPage } from "../../../../src/features/plugins/components/PluginSettingsPage";

vi.mock("../../../../src/features/connections", () => ({
  useDatabase: () => ({ openConnectionIds: [], connectionDataMap: {}, disconnect: vi.fn() }),
}));

vi.mock("../../../../src/features/settings", () => ({
  SettingSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  SettingRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSettings: () => ({ settings: { plugins: {} }, updateSetting: vi.fn() }),
}));

vi.mock("../../../../src/features/plugins/hooks/useDrivers", () => ({
  useDrivers: () => ({ allDrivers: [], installedPlugins: [], refresh: vi.fn() }),
}));

describe("PluginSettingsPage", () => {
  it("renders safely for an unknown plugin", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ id: "missing", name: "Missing", version: "1", capabilities: {} });
    const { container } = render(<PluginSettingsPage pluginId="missing" />);
    expect(container).toBeInTheDocument();
    expect(await screen.findByText("Missing")).toBeInTheDocument();
  });
});
