import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { openUrl as openExternal } from "@tauri-apps/plugin-opener";
import { DatabaseContext } from "../../../../src/features/connections/state/DatabaseContext";
import { openUrl, usePluginConnection, usePluginQuery, usePluginToast } from "../../../../src/features/plugins/hooks/usePluginApi";

vi.mock("@tauri-apps/plugin-dialog", () => ({ message: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DatabaseContext.Provider value={{
    activeConnectionId: "connection",
    activeDriver: "postgres",
    activeSchema: "public",
  } as never}>
    {children}
  </DatabaseContext.Provider>
);

describe("usePluginApi", () => {
  it("forwards query context and exposes active connection metadata", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ columns: ["id"], rows: [[1]] });
    const query = renderHook(() => usePluginQuery(), { wrapper });
    const connection = renderHook(() => usePluginConnection(), { wrapper });

    await act(() => query.result.current.executeQuery("select 1"));

    expect(invoke).toHaveBeenCalledWith("execute_query", {
      connectionId: "connection",
      query: "select 1",
      schema: "public",
    });
    expect(connection.result.current).toEqual({
      connectionId: "connection",
      driver: "postgres",
      schema: "public",
    });
  });

  it("forwards dialog kinds and external URLs", async () => {
    const { result } = renderHook(() => usePluginToast());

    await act(() => result.current.showWarning("careful"));
    await openUrl("https://example.com");

    expect(message).toHaveBeenCalledWith("careful", { kind: "warning" });
    expect(openExternal).toHaveBeenCalledWith("https://example.com");
  });
});
