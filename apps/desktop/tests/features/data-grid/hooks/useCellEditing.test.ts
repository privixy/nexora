import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { recordGateway } from "../../../../src/platform/tauri";
import { useCellEditing } from "../../../../src/features/data-grid/hooks/useCellEditing";

vi.mock("../../../../src/platform/tauri", () => ({
  recordGateway: {
    updateRecord: vi.fn(),
  },
}));

describe("useCellEditing", () => {
  it("forwards the explicit database and schema instead of stale active context", async () => {
    const onRefresh = vi.fn();
    vi.mocked(recordGateway.updateRecord).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCellEditing({
        columns: ["id", "name"],
        mergedRows: [{ type: "existing", rowData: [1, "Alice"], displayIndex: 0 }],
        tableName: "users",
        pkColumns: ["id"],
        pkIndexMaps: [0],
        connectionId: "conn-1",
        database: "analytics",
        schema: "reporting",
        activeDatabase: "app",
        activeSchema: "public",
        onRefresh,
        showAlert: vi.fn(),
        t: (key) => key,
      }),
    );

    act(() => result.current.setEditingCell({ rowIndex: 0, colIndex: 1, value: "Alicia" }));
    await act(() => result.current.handleEditCommit());

    expect(recordGateway.updateRecord).toHaveBeenCalledWith({
      connectionId: "conn-1",
      table: "users",
      pkMap: { id: 1 },
      colName: "name",
      newVal: "Alicia",
      database: "analytics",
      schema: "reporting",
    });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("omits unavailable database and schema fields", async () => {
    vi.mocked(recordGateway.updateRecord).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCellEditing({
        columns: ["id", "name"],
        mergedRows: [{ type: "existing", rowData: [1, "Alice"], displayIndex: 0 }],
        tableName: "users",
        pkColumns: ["id"],
        pkIndexMaps: [0],
        connectionId: "conn-1",
        showAlert: vi.fn(),
        t: (key) => key,
      }),
    );

    act(() => result.current.setEditingCell({ rowIndex: 0, colIndex: 1, value: "Alicia" }));
    await act(() => result.current.handleEditCommit());

    expect(recordGateway.updateRecord).toHaveBeenCalledWith({
      connectionId: "conn-1",
      table: "users",
      pkMap: { id: 1 },
      colName: "name",
      newVal: "Alicia",
    });
  });

  it("commits the picker value without waiting for state synchronization", async () => {
    const onPendingChange = vi.fn();
    const { result } = renderHook(() =>
      useCellEditing({
        columns: ["id", "status"],
        mergedRows: [{ type: "existing", rowData: [1, "draft"], displayIndex: 0 }],
        tableName: "users",
        pkColumns: ["id"],
        pkIndexMaps: [0],
        onPendingChange,
        showAlert: vi.fn(),
        t: (key) => key,
      }),
    );

    act(() => result.current.setEditingCell({ rowIndex: 0, colIndex: 1, value: "draft" }));
    act(() => result.current.commitEditWithValue("published"));

    await waitFor(() => {
      expect(onPendingChange).toHaveBeenCalledWith(
        { id: 1 },
        "status",
        "published",
      );
    });
  });
});
