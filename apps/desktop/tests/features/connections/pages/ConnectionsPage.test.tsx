import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Connections } from "../../../../src/features/connections/pages/ConnectionsPage";
import { useDatabase } from "../../../../src/features/connections/hooks/useDatabase";
import { useSettings } from "../../../../src/features/settings/hooks/useSettings";
import { useDrivers } from "../../../../src/features/plugins/hooks/useDrivers";
import { useOpenConnectionInNewWindow } from "../../../../src/features/connections/hooks/useOpenConnectionInNewWindow";
import type { SavedConnection } from "../../../../src/features/connections/state/DatabaseContext";
import type { DriverCapabilities, PluginManifest } from "../../../../src/types/plugins";
import { DEFAULT_SETTINGS } from "../../../../src/features/settings/state/SettingsContext";

vi.mock("../../../../src/features/connections/hooks/useDatabase", () => ({
  useDatabase: vi.fn(),
}));

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../../../../src/features/plugins/hooks/useDrivers", () => ({
  useDrivers: vi.fn(),
}));

vi.mock("../../../../src/features/connections/hooks/useOpenConnectionInNewWindow", () => ({
  useOpenConnectionInNewWindow: vi.fn(),
}));

vi.mock("../../../../src/features/connections/components/NewConnectionModal/NewConnectionModal", () => ({
  NewConnectionModal: () => null,
}));

vi.mock("../../../../src/features/connections/components/ExportConnectionsModal", () => ({
  ExportConnectionsModal: () => null,
}));

vi.mock("../../../../src/features/connections/components/ImportFromAppModal", () => ({
  ImportFromAppModal: () => null,
}));

vi.mock("../../../../src/shared/ui/ConfirmModal", () => ({
  ConfirmModal: () => null,
}));

const makeCapabilities = (
  overrides: Partial<DriverCapabilities> = {},
): DriverCapabilities => ({
  schemas: false,
  views: false,
  routines: false,
  file_based: false,
  folder_based: false,
  identifier_quote: '"',
  alter_primary_key: false,
  ...overrides,
});

const driver: PluginManifest = {
  id: "postgres",
  name: "PostgreSQL",
  version: "1.0.0",
  description: "PostgreSQL databases",
  default_port: 5432,
  is_builtin: true,
  capabilities: makeCapabilities(),
};

const connection: SavedConnection = {
  id: "conn-1",
  name: "Production",
  params: {
    driver: "postgres",
    host: "localhost",
    database: "app",
  },
};

const renderConnections = () => {
  render(
    <MemoryRouter>
      <Connections />
    </MemoryRouter>,
  );

  return screen.getByText("connections.title").closest(".h-full");
};

describe("Connections page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSettings).mockReturnValue({
      settings: DEFAULT_SETTINGS,
      updateSetting: vi.fn(),
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
    });

    vi.mocked(useDrivers).mockReturnValue({
      drivers: [driver],
      allDrivers: [driver],
      installedPlugins: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    vi.mocked(useOpenConnectionInNewWindow).mockReturnValue(vi.fn());

    vi.mocked(useDatabase).mockReturnValue({
      activeConnectionId: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnectionOpen: vi.fn(() => false),
      isConnectionOpenAnywhere: vi.fn(() => false),
      switchConnection: vi.fn(),
      connectionGroups: [],
      createGroupPath: vi.fn(),
      updateGroup: vi.fn(),
      moveGroupToParent: vi.fn(),
      deleteGroup: vi.fn(),
      moveConnectionToGroup: vi.fn(),
      reorderGroups: vi.fn(),
      toggleGroupCollapsed: vi.fn(),
      loadConnections: vi.fn(),
      connections: [connection],
    } as unknown as ReturnType<typeof useDatabase>);
  });

  it("keeps the page wrapper fixed and scrolls only the connections content", () => {
    const root = renderConnections();
    const content = root?.querySelector(".custom-scrollbar");

    expect(root).toHaveClass("overflow-hidden");
    expect(content).toHaveClass("min-h-0");
    expect(content).toHaveClass("overflow-y-auto");
  });
});
