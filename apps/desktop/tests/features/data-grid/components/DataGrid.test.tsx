import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { listenTauri, recordGateway, windowGateway } from "../../../../src/platform/tauri";
import { DataGrid } from "../../../../src/features/data-grid/components/DataGrid";
import { TableToolbar } from "../../../../src/components/ui/TableToolbar";
import { reconstructTableQuery } from "../../../../src/utils/editor";
import type { Tab } from "../../../../src/types/editor";
import type { ForeignKey, TableColumn } from "../../../../src/types/editor";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver;

vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    ArrowUp: Icon,
    ArrowDown: Icon,
    ArrowUpDown: Icon,
    Braces: Icon,
    Copy: Icon,
    CopyPlus: Icon,
    Clock: Icon,
    Undo: Icon,
    Trash2: Icon,
    Edit: Icon,
    Sparkles: Icon,
    Ban: Icon,
    Eraser: Icon,
    FileDigit: Icon,
    ExternalLink: Icon,
    PanelBottomOpen: Icon,
    Filter: Icon,
    ListFilter: Icon,
    Plus: Icon,
    SlidersHorizontal: Icon,
    X: Icon,
  };
});

vi.mock("../../../../src/components/ui/ContextMenu", () => ({
  ContextMenu: ({ items }: { items: Array<{ label?: string; action?: () => void; disabled?: boolean; separator?: boolean }> }) => (
    <div data-testid="context-menu">
      {items
        .filter((item) => !item.separator)
        .map((item) => (
          <button key={item.label} type="button" disabled={item.disabled} onClick={item.action}>
            {item.label}
          </button>
        ))}
    </div>
  ),
}));

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { detectJsonInTextColumns: false } }),
}));

vi.mock("../../../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

const mockDatabaseContext = vi.hoisted(() => ({
  activeDatabase: "analytics" as string | null,
  activeSchema: "reporting" as string | null,
  activeDriver: "postgres" as string | null,
  connections: [] as Array<{ id: string; detect_json_in_text_columns?: boolean }>,
}));

vi.mock("../../../../src/features/connections/hooks/useDatabase", () => ({
  useDatabase: () => mockDatabaseContext,
}));
vi.mock("../../../../src/features/connections", () => ({
  useDatabase: () => mockDatabaseContext,
}));

vi.mock("../../../../src/platform/tauri", () => ({
  listenTauri: vi.fn(() => Promise.resolve(vi.fn())),
  recordGateway: {
    getServerNow: vi.fn(),
    updateRecord: vi.fn(),
  },
  windowGateway: {
    openJsonViewer: vi.fn(),
  },
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [{ index: 0, key: "0", start: 0, size: 35 }],
    getTotalSize: () => 35,
    scrollToIndex: vi.fn(),
  }),
}));

const columns = ["id", "account_id", "name"];
const data = [[1, 42, "Alice"]];
const columnMetadata: TableColumn[] = [
  { name: "id", data_type: "integer", is_pk: true, is_nullable: false, is_auto_increment: true },
  { name: "account_id", data_type: "integer", is_pk: false, is_nullable: false, is_auto_increment: false },
  { name: "name", data_type: "text", is_pk: false, is_nullable: true, is_auto_increment: false },
];
const foreignKeys: ForeignKey[] = [
  {
    column_name: "account_id",
    ref_table: "accounts",
    ref_column: "id",
  },
];

function renderGrid(overrides: Partial<React.ComponentProps<typeof DataGrid>> = {}) {
  const props: React.ComponentProps<typeof DataGrid> = {
    columns,
    data,
    tableName: "users",
    pkColumns: ["id"],
    nullableColumns: ["name"],
    columnMetadata,
    foreignKeys,
    connectionId: "conn-1",
    onRefresh: vi.fn(),
    onPendingChange: vi.fn(),
    onMarkForDeletion: vi.fn(),
    onDuplicateRow: vi.fn(),
    onForeignKeyShowPanel: vi.fn(),
    onForeignKeyNavigate: vi.fn(),
    onSelectionChange: vi.fn(),
    ...overrides,
  };

  render(<DataGrid {...props} />);
  return props;
}

describe("DataGrid operations", () => {
  it("can transition from no columns to rendered columns without changing hook order", () => {
    const props: React.ComponentProps<typeof DataGrid> = {
      data: [],
      columns: [],
      connectionId: "connection-1",
      tableName: "users",
      onRefresh: vi.fn(),
    };
    const { rerender } = render(<DataGrid {...props} />);

    expect(screen.getByText("dataGrid.noData")).toBeInTheDocument();

    rerender(<DataGrid {...props} columns={["id"]} data={[[1]]} />);

    expect(screen.getByText("id")).toBeInTheDocument();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabaseContext.activeDatabase = "analytics";
    mockDatabaseContext.activeSchema = "reporting";
    mockDatabaseContext.activeDriver = "postgres";
    mockDatabaseContext.connections = [];
    (recordGateway.updateRecord as Mock).mockResolvedValue(undefined);
    (windowGateway.openJsonViewer as Mock).mockResolvedValue("session-1");
    (listenTauri as Mock).mockResolvedValue(vi.fn());
  });

  it("shows referenced record preview from the visible foreign-key cell with the referenced-record payload", () => {
    const props = renderGrid();

    fireEvent.click(screen.getByText("42"));

    expect(screen.getByTitle("42")).toHaveClass("ring-2");
    expect(props.onForeignKeyShowPanel).toHaveBeenCalledWith(foreignKeys[0], 42);
  });

  it("passes primary-key payloads for duplicate and delete row operations", async () => {
    const props = renderGrid();

    fireEvent.contextMenu(screen.getByText("Alice"));
    fireEvent.click(screen.getByText("dataGrid.duplicateRow"));

    expect(props.onDuplicateRow).toHaveBeenCalledWith({ id: 1, account_id: 42, name: "Alice" });

    fireEvent.contextMenu(screen.getByText("Alice"));
    fireEvent.click(screen.getByText("dataGrid.deleteRow"));

    await waitFor(() => {
      expect(props.onMarkForDeletion).toHaveBeenCalledWith({ id: 1 });
    });
  });

  it("passes the edited column and primary-key context when a visible cell edit is committed", () => {
    const props = renderGrid();

    fireEvent.doubleClick(screen.getByText("Alice"));
    const input = screen.getByDisplayValue("Alice");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onPendingChange).toHaveBeenCalledWith({ id: 1 }, "name", "Alicia");
  });

  it("reconstructs filter, sort, and page queries with the exact active context", () => {
    const onRun = vi.fn();
    const tableTab: Tab = {
      id: "table-tab",
      title: "events",
      type: "table",
      query: "SELECT * FROM events",
      result: null,
      error: "",
      executionTime: null,
      page: 1,
      activeTable: "events",
      pkColumns: ["id"],
      connectionId: "conn-1",
      database: "analytics",
      schema: "reporting",
      filterClause: "status = 'active'",
      sortClause: "created_at DESC",
      limitClause: 25,
    };

    render(
      <TableToolbar
        initialFilter="status = 'active'"
        initialSort="created_at DESC"
        initialLimit={25}
        placeholderColumn="status"
        placeholderSort="created_at"
        defaultLimit={50}
        columnMetadata={columnMetadata}
          onUpdate={(filter, sort, limit) => {
          tableTab.filterClause = filter;
          tableTab.sortClause = sort;
          tableTab.limitClause = limit;
          onRun({
            connectionId: "conn-1",
            database: tableTab.database,
            schema: tableTab.schema,
            page: 1,
            query: reconstructTableQuery(tableTab, mockDatabaseContext.activeDriver ?? undefined, { wrapLimitSubquery: true }),
          });
        }}
      />,
    );

    const filterInput = screen.getByDisplayValue("status = 'active'");
    fireEvent.change(filterInput, { target: { value: "account_id = 42" } });
    fireEvent.keyDown(filterInput, { key: "Enter" });

    expect(onRun).toHaveBeenCalledWith({
      connectionId: "conn-1",
      database: "analytics",
      schema: "reporting",
      page: 1,
      query: "SELECT * FROM (SELECT * FROM \"reporting\".\"events\" WHERE account_id = 42 ORDER BY created_at DESC LIMIT 25) AS limited_subset",
    });

    const sortInput = screen.getByDisplayValue("created_at DESC");
    fireEvent.change(sortInput, { target: { value: "name ASC" } });
    fireEvent.keyDown(sortInput, { key: "Enter" });

    expect(onRun).toHaveBeenLastCalledWith({
      connectionId: "conn-1",
      database: "analytics",
      schema: "reporting",
      page: 1,
      query: "SELECT * FROM (SELECT * FROM \"reporting\".\"events\" WHERE account_id = 42 ORDER BY name ASC LIMIT 25) AS limited_subset",
    });
  });

  it("passes explicit table-tab context for immediate record operations", async () => {
    mockDatabaseContext.activeDatabase = "app";
    mockDatabaseContext.activeSchema = "public";
    const onRefresh = vi.fn();
    renderGrid({
      onPendingChange: undefined,
      onRefresh,
      database: "analytics",
      schema: "reporting",
    });

    fireEvent.doubleClick(screen.getByText("Alice"));
    const input = screen.getByDisplayValue("Alice");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(recordGateway.updateRecord).toHaveBeenCalledWith({
        connectionId: "conn-1",
        table: "users",
        pkMap: { id: 1 },
        colName: "name",
        newVal: "Alicia",
        database: "analytics",
        schema: "reporting",
      });
    });
    expect(onRefresh).toHaveBeenCalled();
  });
});
