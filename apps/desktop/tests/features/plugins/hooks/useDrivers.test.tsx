import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useDrivers } from "../../../../src/features/plugins/hooks/useDrivers";
import {
  DEFAULT_SETTINGS,
  SettingsContext,
} from "../../../../src/features/settings/state/SettingsContext";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsContext.Provider
    value={{
      settings: {
        ...DEFAULT_SETTINGS,
        activeExternalDrivers: ["external"],
      },
      updateSetting: vi.fn(),
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
    }}
  >
    {children}
  </SettingsContext.Provider>
);

describe("useDrivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads drivers concurrently in command order and keeps missing capabilities disabled", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([
        {
          id: "external",
          name: "External",
          version: "1.0.0",
          description: "External driver",
          default_port: null,
          capabilities: {
            schemas: false,
            views: false,
            routines: false,
            file_based: false,
            folder_based: false,
            identifier_quote: '"',
            alter_primary_key: false,
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useDrivers(), { wrapper });

    expect(invoke).toHaveBeenNthCalledWith(1, "get_registered_drivers");
    expect(invoke).toHaveBeenNthCalledWith(2, "get_installed_plugins");
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.drivers[0].capabilities.create_database).not.toBe(true);
    expect(result.current.drivers[0].capabilities.truncate_table).not.toBe(true);
    expect(result.current.drivers[0].capabilities.create_foreign_keys).not.toBe(true);
  });
});
