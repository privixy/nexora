import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { usePluginRegistry } from "../../../../src/features/plugins/hooks/usePluginRegistry";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("usePluginRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves backend plugin registration order", async () => {
    const plugins = [
      { id: "second", name: "Second" },
      { id: "first", name: "First" },
    ];
    vi.mocked(invoke).mockResolvedValue(plugins);

    const { result } = renderHook(() => usePluginRegistry());

    expect(invoke).toHaveBeenCalledWith("fetch_plugin_registry");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plugins.map(({ id }) => id)).toEqual(["second", "first"]);
  });
});
