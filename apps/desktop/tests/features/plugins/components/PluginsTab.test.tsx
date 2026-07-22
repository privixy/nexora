import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { PluginsTab } from "../../../../src/features/plugins/components/PluginsTab";

vi.mock("lucide-react", () => ({
  AlertTriangle: () => null,
  Boxes: () => null,
  Check: () => null,
  CheckCircle2: () => null,
  ChevronDown: () => null,
  Copy: () => null,
  Download: () => null,
  ExternalLink: () => null,
  Loader2: () => null,
  PackageCheck: () => null,
  Plug: () => null,
  Power: () => null,
  RefreshCw: () => null,
  RotateCcw: () => null,
  Search: () => null,
  Settings: () => null,
  Trash2: () => null,
  X: () => null,
}));

vi.mock("../../../../src/features/connections", () => ({
  useDatabase: () => ({ openConnectionIds: [], connectionDataMap: {}, disconnect: vi.fn() }),
}));

vi.mock("../../../../src/features/settings", () => ({
  useSettings: () => ({ settings: { plugins: {} }, updateSetting: vi.fn() }),
}));

vi.mock("../../../../src/features/plugins/hooks/useDrivers", () => ({
  useDrivers: () => ({ allDrivers: [], installedPlugins: [], refresh: vi.fn() }),
}));

vi.mock("../../../../src/features/plugins/hooks/usePluginRegistry", () => ({
  usePluginRegistry: () => ({ plugins: [], loading: false, refresh: vi.fn() }),
}));

describe("PluginsTab", () => {
  it("renders plugin management content", () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    render(<PluginsTab onPluginsChanged={vi.fn()} />);
    expect(screen.getAllByText(/plugins/i).length).toBeGreaterThan(0);
  });
});
