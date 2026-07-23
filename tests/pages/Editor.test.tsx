import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { Tab } from "../../src/types/editor";
import { Editor } from "../../src/pages/Editor";

const state = vi.hoisted(() => ({
  initialTab: null as Tab | null,
  database: {
    activeConnectionId: "conn-current",
    activeDatabase: "stale_database",
    activeSchema: "stale_schema",
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return { ...actual, Table: actual.Table2 };
});

vi.mock("../../src/hooks/useDatabase", () => ({
  useDatabase: () => ({
    activeConnectionId: state.database.activeConnectionId,
    connections: [],
    views: [],
    materializedViews: [],
    activeDriver: "postgres",
    activeSchema: state.database.activeSchema,
    activeCapabilities: {
      schemas: true,
      multiple_databases: true,
      identifier_quote: '"',
    },
    activeTable: null,
    selectedDatabases: ["stale_database", "tab_database"],
    activeConnectionName: "Current",
    activeDatabaseName: state.database.activeDatabase,
    activeDatabase: state.database.activeDatabase,
    setActiveDatabaseContext: vi.fn(),
  }),
}));

vi.mock("../../src/hooks/useEditor", () => ({
  useEditor: () => {
    const [tab, setTab] = React.useState<Tab | null>(state.initialTab);
    const updateTab = (_id: string, partial: Partial<Tab>) => {
      setTab((current) => current ? { ...current, ...partial } : current);
    };
    return {
      tabs: tab ? [tab] : [],
      activeTab: tab,
      activeTabId: tab?.id ?? null,
      updateTab,
      updateResultEntry: vi.fn(),
      addTab: vi.fn(() => "new-tab"),
      setActiveTabId: vi.fn(),
      closeTab: vi.fn(),
      closeAllTabs: vi.fn(),
      closeOtherTabs: vi.fn(),
      closeTabsToLeft: vi.fn(),
      closeTabsToRight: vi.fn(),
    };
  },
}));

vi.mock("../../src/hooks/useDrivers", () => ({ useDrivers: () => ({ allDrivers: [] }) }));
vi.mock("../../src/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: { resultPageSize: 100, copyFormat: "csv", csvDelimiter: ",", csvIncludeHeaders: true },
  }),
}));
vi.mock("../../src/hooks/useSavedQueries", () => ({ useSavedQueries: () => ({ saveQuery: vi.fn() }) }));
vi.mock("../../src/hooks/useQueryHistory", () => ({ useQueryHistory: () => ({ addEntry: vi.fn() }) }));
vi.mock("../../src/hooks/useConnectionLayoutContext", () => ({
  useConnectionLayoutContext: () => ({ explorerConnectionId: "conn-current" }),
}));
vi.mock("../../src/hooks/useKeybindings", () => ({
  useKeybindings: () => ({ matchesShortcut: vi.fn(() => false), isMac: false }),
}));
vi.mock("../../src/hooks/useAlert", () => ({ useAlert: () => ({ showAlert: vi.fn() }) }));
vi.mock("../../src/hooks/useDangerousQueryGuard", () => ({
  DANGEROUS_QUERY_I18N: {},
  useDangerousQueryGuard: () => ({ pending: null, guardQuery: vi.fn().mockResolvedValue(true), resolve: vi.fn() }),
}));
vi.mock("../../src/hooks/useSqlAutocompleteRegistration", () => ({ useSqlAutocompleteRegistration: vi.fn() }));
vi.mock("../../src/utils/notebookStore", () => ({ createNotebook: vi.fn(), renameNotebook: vi.fn() }));

vi.mock("../../src/components/ui/DataGrid", () => ({
  DataGrid: ({ onPendingChange, onMarkForDeletion, onDuplicateRow }: {
    onPendingChange?: (pk: unknown, column: string, value: unknown) => void;
    onMarkForDeletion?: (pk: unknown) => void;
    onDuplicateRow?: (row: Record<string, unknown>) => void;
  }) => (
    <div>
      <button onClick={() => onPendingChange?.({ id: 1 }, "name", "Updated")}>Stage update</button>
      <button onClick={() => onMarkForDeletion?.({ id: 2 })}>Stage delete</button>
      <button onClick={() => onDuplicateRow?.({ id: 3, name: "Inserted" })}>Stage insert</button>
    </div>
  ),
}));

vi.mock("../../src/components/modals/AiQueryModal", () => ({ AiQueryModal: () => null }));
vi.mock("../../src/components/modals/AiExplainModal", () => ({ AiExplainModal: () => null }));
vi.mock("../../src/components/modals/VisualExplainModal", () => ({ VisualExplainModal: () => null }));
vi.mock("../../src/components/ui/SqlEditorWrapper", () => ({ SqlEditorWrapper: () => null }));
vi.mock("../../src/components/ui/TableToolbar", () => ({ TableToolbar: () => null }));
vi.mock("../../src/components/ui/MultiResultPanel", () => ({ MultiResultPanel: () => null }));
vi.mock("../../src/components/ui/VisualQueryBuilder", () => ({ VisualQueryBuilder: () => null }));
vi.mock("../../src/components/notebook/NotebookView", () => ({ NotebookView: () => null }));

const createTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: "tab-1",
  title: "users",
  type: "table",
  query: 'SELECT * FROM "tab_schema"."users"',
  result: {
    columns: ["id", "name"],
    rows: [[1, "Before"], [2, "Delete"]],
    affected_rows: 0,
    pagination: { page: 1, page_size: 100, total_rows: 2, has_more: false },
  },
  error: "",
  executionTime: null,
  page: 1,
  activeTable: "users",
  pkColumns: ["id"],
  autoIncrementColumns: ["id"],
  connectionId: "conn-current",
  database: "tab_database",
  schema: "tab_schema",
  selectedRows: [],
  ...overrides,
});

const renderEditor = () => render(<MemoryRouter><Editor /></MemoryRouter>);

describe("Editor table mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.database.activeConnectionId = "conn-current";
    state.database.activeDatabase = "stale_database";
    state.database.activeSchema = "stale_schema";
    state.initialTab = createTab();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "get_columns") {
        return [
          { name: "id", data_type: "integer", is_nullable: false, is_pk: true, is_auto_increment: true },
          { name: "name", data_type: "text", is_nullable: false, is_pk: false, is_auto_increment: false },
        ];
      }
      if (command === "get_foreign_keys") return [];
      if (command === "execute_query") return {
        columns: ["id", "name"],
        rows: [],
        affected_rows: 0,
        pagination: { page: 1, page_size: 100, total_rows: 0, has_more: false },
      };
      return undefined;
    });
  });

  it("disables mutations when the active table tab lacks its explicit database and schema", () => {
    state.initialTab = createTab({ database: undefined, schema: undefined });
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Stage update" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "editor.applyToAll" }));

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(invoke).not.toHaveBeenCalledWith("update_record", expect.anything());
  });

  it("applies staged update, delete, and insert before refreshing with the tab-owned full tuple", async () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Stage update" }));
    fireEvent.click(screen.getByRole("button", { name: "Stage delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Stage insert" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "editor.applyToAll" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("execute_query", expect.anything()));

    const relevantCalls = vi.mocked(invoke).mock.calls.filter(([command]) => [
      "delete_record",
      "update_record",
      "insert_record",
      "execute_query",
    ].includes(command));

    expect(vi.mocked(invoke).mock.calls.filter(([command]) => command === "get_columns")[0]).toEqual(
      ["get_columns", { connectionId: "conn-current", tableName: "users", database: "tab_database", schema: "tab_schema" }],
    );
    expect(relevantCalls).toEqual([
      ["delete_record", { connectionId: "conn-current", table: "users", pkMap: { id: 2 }, database: "tab_database", schema: "tab_schema" }],
      ["update_record", { connectionId: "conn-current", table: "users", pkMap: { id: 1 }, colName: "name", newVal: "Updated", database: "tab_database", schema: "tab_schema" }],
      ["insert_record", { connectionId: "conn-current", table: "users", data: { name: "Inserted" }, database: "tab_database", schema: "tab_schema" }],
      ["execute_query", { connectionId: "conn-current", query: 'SELECT * FROM "tab_schema"."users"', limit: 100, page: 1, database: "tab_database", schema: "tab_schema" }],
    ]);
  });
});
