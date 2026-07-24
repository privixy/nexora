import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { recordGateway } from "../../../../src/platform/tauri/recordGateway";
import { useCellEditing } from "../../../../src/features/data-grid/hooks/useCellEditing";
import type { DriverCapabilities } from "../../../../src/features/plugins";

vi.mock("../../../../src/platform/tauri/recordGateway", () => ({
  recordGateway: {
    updateRecord: vi.fn(),
  },
}));

const capabilities = (
  overrides: Partial<DriverCapabilities>,
): DriverCapabilities => overrides as DriverCapabilities;

const contextCases = [
  {
    name: "schema-only",
    capabilities: capabilities({ schemas: true, multiple_databases: false }),
    database: undefined,
    schema: "reporting",
  },
  {
    name: "database-only",
    capabilities: capabilities({ schemas: false, multiple_databases: true }),
    database: "analytics",
    schema: undefined,
  },
  {
    name: "full-tuple",
    capabilities: capabilities({ schemas: true, multiple_databases: true }),
    database: "analytics",
    schema: "reporting",
  },
];

describe("useCellEditing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(contextCases)(
    "commits the complete $name explicit context without global fallback",
    async ({ capabilities, database, schema }) => {
      const onRefresh = vi.fn();
      vi.mocked(recordGateway.updateRecord).mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useCellEditing({
          columns: ["id", "name"],
          mergedRows: [
            { type: "existing", rowData: [1, "Alice"], displayIndex: 0 },
          ],
          tableName: "users",
          pkColumns: ["id"],
          pkIndexMaps: [0],
          connectionId: "conn-1",
          capabilities,
          database,
          schema,
          activeDatabase: "stale_database",
          activeSchema: "stale_schema",
          onRefresh,
          showAlert: vi.fn(),
          t: (key) => key,
        }),
      );

      act(() =>
        result.current.setEditingCell({
          rowIndex: 0,
          colIndex: 1,
          value: "Alicia",
        }),
      );
      await act(() => result.current.handleEditCommit());

      expect(recordGateway.updateRecord).toHaveBeenCalledWith({
        connectionId: "conn-1",
        database,
        schema,
        table: "users",
        pkMap: { id: 1 },
        colName: "name",
        newVal: "Alicia",
      });
      expect(onRefresh).toHaveBeenCalledOnce();
    },
  );

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
        capabilities: capabilities({ schemas: true, multiple_databases: true }),
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

  it("blocks direct mutations with incomplete explicit context instead of using stale active context", async () => {
    const loadedRows = [
      { type: "existing" as const, rowData: [1, "Alice"], displayIndex: 0 },
    ];
    const onRefresh = vi.fn();
    vi.mocked(recordGateway.updateRecord).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCellEditing({
        columns: ["id", "name"],
        mergedRows: loadedRows,
        tableName: "users",
        pkColumns: ["id"],
        pkIndexMaps: [0],
        connectionId: "conn-1",
        capabilities: capabilities({ schemas: true, multiple_databases: true }),
        database: "analytics",
        activeDatabase: "stale_database",
        activeSchema: "stale_schema",
        onRefresh,
        showAlert: vi.fn(),
        t: (key) => key,
      }),
    );

    act(() => result.current.setEditingCell({ rowIndex: 0, colIndex: 1, value: "Alicia" }));
    await act(() => result.current.handleEditCommit());

    expect(recordGateway.updateRecord).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(loadedRows[0].rowData).toEqual([1, "Alice"]);
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
