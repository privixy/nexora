import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React from "react";
import { EditorPage } from "../../../../src/features/editor/pages/EditorPage";
import { useDatabase } from "../../../../src/features/connections";
import { DatabaseContext, type DatabaseContextType } from "../../../../src/features/connections/state/DatabaseContext";
import { EditorContext, type EditorContextType } from "../../../../src/features/editor/state/EditorContext";
import type { BatchStatementResult, QueryResult, Tab, TableColumn } from "../../../../src/types/editor";
import type { PluginManifest } from "../../../../src/types/plugins";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}));

vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
    Play: Icon,
    Plus: Icon,
    Minus: Icon,
    Download: Icon,
    Square: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    Save: Icon,
    X: Icon,
    Database: Icon,
    Table: Icon,
    FileCode: Icon,
    Network: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    ChevronsLeft: Icon,
    ChevronsRight: Icon,
    ArrowLeftToLine: Icon,
    ArrowRightToLine: Icon,
    XCircle: Icon,
    Trash2: Icon,
    Check: Icon,
    BookOpen: Icon,
    Pencil: Icon,
    Hash: Icon,
    Loader2: Icon,
    Copy: Icon,
    FileText: Icon,
    FileJson: Icon,
    Maximize2: Icon,
    Minimize2: Icon,
    ExternalLink: Icon,
    CheckCircle2: Icon,
    Code2: Icon,
    Rows3: Icon,
    PanelTop: Icon,
    ChevronsDownUp: Icon,
    ChevronsUpDown: Icon,
    Sparkles: Icon,
  };
});

vi.mock("../../../../src/features/editor/components/SqlEditorWrapper", () => ({
  SqlEditorWrapper: ({ initialValue, onChange, onRun }: { initialValue?: string; onChange?: (value: string) => void; onRun?: () => void }) => (
    <div>
      <textarea
        aria-label="sql-editor"
        defaultValue={initialValue}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <button type="button" onClick={onRun}>mock-run</button>
    </div>
  ),
}));

vi.mock("../../../../src/features/connections", () => ({
  getConnectionAccent: () => "#3b82f6",
  useDatabase: vi.fn(),
}));

vi.mock("../../../../src/features/plugins", () => ({
  isMultiDatabaseCapable: () => false,
  useDrivers: () => ({ allDrivers: [{ id: "postgres", name: "PostgreSQL" }] }),
}));

vi.mock("../../../../src/features/data-grid", () => ({
  DataGrid: ({ columns, data, onSort, onForeignKeyShowPanel, onPendingChange, onSelectionChange }: {
    columns: string[];
    data: unknown[][];
    onSort?: (column: string) => void;
    onForeignKeyShowPanel?: (fk: { column_name: string; ref_table: string; ref_column: string }, value: unknown) => void;
    onPendingChange?: (pkVal: unknown, colName: string, value: unknown) => void;
    onSelectionChange?: (selection: Set<number>) => void;
  }) => (
    <div data-testid="data-grid">
      <span>{columns.join(",")}</span>
      <span>{data.map((row) => row.join(":")).join("|")}</span>
      <button type="button" onClick={() => onSort?.("name")}>sort-name</button>
      <button type="button" onClick={() => onForeignKeyShowPanel?.({ column_name: "account_id", ref_table: "accounts", ref_column: "id" }, 42)}>preview-fk</button>
      <button type="button" onClick={() => onPendingChange?.({ id: 1 }, "name", "Alicia")}>edit-name</button>
      <button type="button" onClick={() => onSelectionChange?.(new Set([0]))}>select-first-row</button>
    </div>
  ),
}));

vi.mock("../../../../src/components/ui/TableToolbar", () => ({
  TableToolbar: ({ initialFilter, initialSort, initialLimit, onUpdate }: { initialFilter?: string; initialSort?: string; initialLimit?: number; onUpdate: (filter: string, sort: string, limit?: number) => void }) => (
    <div data-testid="table-toolbar">
      <span>{initialFilter}</span>
      <span>{initialSort}</span>
      <span>{initialLimit}</span>
      <button type="button" onClick={() => onUpdate("status = 'active'", "name DESC", 25)}>apply-filter-sort-page</button>
    </div>
  ),
}));

vi.mock("../../../../src/components/ui/RelatedRecordsPanel", () => ({
  RelatedRecordsPanel: ({ connectionId, database, schema }: { connectionId: string; database?: string; schema?: string }) => (
    <div data-testid="related-records-panel">{[connectionId, database, schema].filter(Boolean).join("/")}</div>
  ),
}));

vi.mock("../../../../src/components/modals/NewRowModal", () => ({
  NewRowModal: ({ database, schema }: { database?: string; schema?: string }) => <div data-testid="new-row-modal">{[database, schema].filter(Boolean).join("/")}</div>,
}));

vi.mock("../../../../src/features/editor/hooks/useDangerousQueryGuard", () => ({
  DANGEROUS_QUERY_I18N: {},
  useDangerousQueryGuard: () => ({
    pending: null,
    guardQuery: vi.fn(() => Promise.resolve(true)),
    resolve: vi.fn(),
  }),
}));

vi.mock("../../../../src/features/plugins/hooks/useDrivers", () => ({
  useDrivers: () => ({ allDrivers: [{ id: "postgres", name: "PostgreSQL" }] }),
}));

vi.mock("../../../../src/features/settings", () => ({
  useSettings: () => ({
    settings: {
      resultPageSize: 50,
      copyFormat: "csv",
      csvDelimiter: ",",
      csvIncludeHeaders: true,
      aiEnabled: false,
    },
  }),
}));

vi.mock("../../../../src/features/visual-explain", () => ({
  VisualExplainModal: () => <div />,
}));

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      resultPageSize: 50,
      copyFormat: "csv",
      csvDelimiter: ",",
      csvIncludeHeaders: true,
      aiEnabled: false,
    },
  }),
}));

vi.mock("../../../../src/features/editor/hooks/useSavedQueries", () => ({
  useSavedQueries: () => ({ saveQuery: vi.fn() }),
}));

vi.mock("../../../../src/features/editor/hooks/useQueryHistory", () => ({
  useQueryHistory: () => ({ addEntry: vi.fn() }),
}));

vi.mock("../../../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

vi.mock("../../../../src/hooks/useConnectionLayoutContext", () => ({
  useConnectionLayoutContext: () => ({ explorerConnectionId: "conn-1", splitView: false, isSplitVisible: false }),
}));

vi.mock("../../../../src/hooks/useKeybindings", () => ({
  useKeybindings: () => ({ matchesShortcut: vi.fn(() => false), isMac: false }),
}));

vi.mock("../../../../src/features/editor/hooks/useSqlAutocompleteRegistration", () => ({
  useSqlAutocompleteRegistration: vi.fn(),
}));

vi.mock("../../../../src/features/editor/query-builder/VisualQueryBuilder", () => ({ VisualQueryBuilder: () => <div /> }));
vi.mock("../../../../src/features/ai", () => ({
  AiDropdownButton: () => <div />,
  AiQueryModal: () => <div />,
  AiExplainModal: () => <div />,
}));
vi.mock("../../../../src/components/modals/VisualExplainModal", () => ({ VisualExplainModal: () => <div /> }));
vi.mock("../../../../src/features/editor/components/ExportProgressModal", () => ({ ExportProgressModal: () => <div /> }));
vi.mock("../../../../src/features/editor/components/modals/QueryModal", () => ({ QueryModal: () => <div /> }));
vi.mock("../../../../src/features/editor/components/modals/ErrorModal", () => ({ ErrorModal: () => <div /> }));
vi.mock("../../../../src/components/modals/ConfirmModal", () => ({ ConfirmModal: () => <div /> }));
vi.mock("../../../../src/features/editor/components/modals/QueryParamsModal", () => ({ QueryParamsModal: () => <div /> }));
vi.mock("../../../../src/features/editor/components/modals/QuerySelectionModal", () => ({ QuerySelectionModal: ({ isOpen, queries, onRunAll }: { isOpen: boolean; queries: string[]; onRunAll: (queries: string[]) => void }) => isOpen ? <button type="button" onClick={() => onRunAll(queries)}>run-all-queries</button> : null }));
vi.mock("../../../../src/features/editor/components/modals/ExplainSelectionModal", () => ({ ExplainSelectionModal: () => <div /> }));
vi.mock("../../../../src/features/editor/components/modals/TabSwitcherModal", () => ({ TabSwitcherModal: () => <div /> }));

const makeResult = (rows: unknown[][] = [[1, "Alice"]]): QueryResult => ({
  columns: ["id", "name"],
  rows,
  affected_rows: 0,
  pagination: { page: 1, page_size: 50, total_rows: rows.length, has_more: false },
});

const postgresManifest: PluginManifest = {
  id: "postgres",
  name: "PostgreSQL",
  version: "1.0.0",
  capabilities: {
    schemas: true,
    multiple_databases: true,
    sql_dialect: "postgresql",
    materialized_views: true,
  },
};

function createDatabase(overrides: Partial<DatabaseContextType> = {}): DatabaseContextType {
  return {
    activeConnectionId: "conn-1",
    openConnectionIds: ["conn-1"],
    connectionDataMap: {},
    activeTable: null,
    activeDriver: "postgres",
    activeCapabilities: postgresManifest.capabilities ?? null,
    activeConnectionName: "Local Postgres",
    activeDatabaseName: "app",
    tables: [],
    views: [],
    materializedViews: [],
    routines: [],
    triggers: [],
    isLoadingTables: false,
    isLoadingViews: false,
    isLoadingRoutines: false,
    isLoadingTriggers: false,
    schemas: ["public"],
    isLoadingSchemas: false,
    schemaDataMap: {},
    activeDatabase: "analytics",
    activeSchema: "public",
    selectedSchemas: ["public"],
    needsSchemaSelection: false,
    selectedDatabases: ["app", "analytics"],
    databaseDataMap: {},
    connections: [{ id: "conn-1", name: "Local Postgres", params: { driver: "postgres", database: ["app", "analytics"] } }],
    connectionGroups: [],
    loadConnections: vi.fn(() => Promise.resolve()),
    isLoadingConnections: false,
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    detachConnection: vi.fn(),
    switchConnection: vi.fn(),
    setActiveTable: vi.fn(),
    setActiveTableContext: vi.fn(),
    setActiveDatabaseContext: vi.fn(),
    setActiveSchema: vi.fn(),
    refreshTables: vi.fn(() => Promise.resolve()),
    refreshViews: vi.fn(() => Promise.resolve()),
    refreshRoutines: vi.fn(() => Promise.resolve()),
    refreshTriggers: vi.fn(() => Promise.resolve()),
    loadSchemaData: vi.fn(() => Promise.resolve()),
    refreshSchemaData: vi.fn(() => Promise.resolve()),
    setSelectedSchemas: vi.fn(() => Promise.resolve()),
    loadDatabaseData: vi.fn(() => Promise.resolve()),
    refreshDatabaseData: vi.fn(() => Promise.resolve()),
    loadDatabaseSchemaData: vi.fn(() => Promise.resolve()),
    refreshDatabaseSchemaData: vi.fn(() => Promise.resolve()),
    setSelectedDatabases: vi.fn(),
    getConnectionData: vi.fn(),
    isConnectionOpen: vi.fn(() => true),
    globallyOpenConnectionIds: ["conn-1"],
    isConnectionOpenAnywhere: vi.fn(() => true),
    createGroup: vi.fn(() => Promise.resolve({ id: "g1", name: "Group", collapsed: false, sort_order: 0 })),
    createGroupPath: vi.fn(() => Promise.resolve({ id: "g1", name: "Group", collapsed: false, sort_order: 0 })),
    updateGroup: vi.fn(() => Promise.resolve()),
    moveGroupToParent: vi.fn(() => Promise.resolve()),
    deleteGroup: vi.fn(() => Promise.resolve()),
    moveConnectionToGroup: vi.fn(() => Promise.resolve()),
    reorderGroups: vi.fn(() => Promise.resolve()),
    reorderConnectionsInGroup: vi.fn(() => Promise.resolve()),
    toggleGroupCollapsed: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

const notebookRuntime = {
  render: vi.fn(() => <div data-testid="notebook-view" />),
  create: vi.fn(),
  rename: vi.fn(),
};

const baseConsoleTab: Tab = {
  id: "tab-1",
  title: "Console",
  type: "console",
  query: "SELECT * FROM users",
  result: null,
  error: "",
  executionTime: null,
  page: 1,
  activeTable: null,
  pkColumns: null,
  connectionId: "conn-1",
  database: "analytics",
  schema: "public",
};

function createStatefulEditor(initialTabs: Tab[]) {
  function Wrapper({ database = createDatabase() }: { database?: DatabaseContextType }) {
    vi.mocked(useDatabase).mockReturnValue(database);
    const [tabs, setTabs] = React.useState(initialTabs);
    const [activeTabId, setActiveTabId] = React.useState(initialTabs[0]?.id ?? null);
    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

    const updateTab = React.useCallback((id: string, partial: Partial<Tab>) => {
      setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...partial } : tab)));
    }, []);

    const updateResultEntry = React.useCallback((tabId: string, entryId: string, partial: Partial<NonNullable<Tab["results"]>[number]>) => {
      setTabs((current) => current.map((tab) => tab.id === tabId ? {
        ...tab,
        results: tab.results?.map((entry) => entry.id === entryId ? { ...entry, ...partial } : entry),
      } : tab));
    }, []);

    const editor = React.useMemo<EditorContextType>(() => ({
      tabs,
      activeTab,
      activeTabId,
      addTab: vi.fn((partial?: Partial<Tab>) => {
        const id = partial?.id ?? `tab-${tabs.length + 1}`;
        setTabs((current) => [...current, { ...baseConsoleTab, id, title: partial?.title ?? "Console", ...partial }]);
        setActiveTabId(id);
        return id;
      }),
      updateTab,
      closeTab: vi.fn(),
      setActiveTabId,
      closeAllTabs: vi.fn(),
      closeOtherTabs: vi.fn(),
      closeTabsToLeft: vi.fn(),
      closeTabsToRight: vi.fn(),
      getSchema: vi.fn(() => Promise.resolve([])),
      updateResultEntry,
      openNotebook: vi.fn(),
    }), [tabs, activeTab, activeTabId, updateTab, updateResultEntry]);

    return (
      <MemoryRouter initialEntries={["/editor"]}>
        <DatabaseContext.Provider value={database}>
          <EditorContext.Provider value={editor}>
            <Routes>
              <Route path="/editor" element={<EditorPage notebook={notebookRuntime} />} />
            </Routes>
          </EditorContext.Provider>
        </DatabaseContext.Provider>
      </MemoryRouter>
    );
  }

    const rendered = render(<Wrapper />);
    return {
      ...rendered,
      rerenderWithDatabase: (database: DatabaseContextType) => rendered.rerender(<Wrapper database={database} />),
    };

}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listen).mockResolvedValue(vi.fn());
  vi.mocked(invoke).mockImplementation((command: string) => {
    if (command === "execute_query") return Promise.resolve(makeResult([[1, "Alice"]]));
    if (command === "execute_query_batch") return Promise.resolve([]);
    if (command === "get_columns") return Promise.resolve([{ name: "id", data_type: "integer", is_pk: true, is_nullable: false, is_auto_increment: true } satisfies TableColumn]);
    if (command === "get_foreign_keys") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Editor", () => {
  it("forwards notebook tabs and persistence operations through the injected runtime", async () => {
    const notebookTab: Tab = {
      ...baseConsoleTab,
      id: "notebook-1",
      title: "Notebook",
      type: "notebook",
      notebookId: "saved-notebook",
    };
    notebookRuntime.create.mockResolvedValue({ notebookId: "created-notebook" });
    notebookRuntime.rename.mockResolvedValue(undefined);

    createStatefulEditor([notebookTab]);

    expect(notebookRuntime.render).toHaveBeenCalledWith({
      tab: notebookTab,
      updateTab: expect.any(Function),
      connectionId: "conn-1",
      isActive: true,
    });

    fireEvent.doubleClick(screen.getByText("Notebook"));
    const input = screen.getByDisplayValue("Notebook");
    fireEvent.change(input, { target: { value: "Renamed notebook" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(notebookRuntime.rename).toHaveBeenCalledWith(
      "saved-notebook",
      "conn-1",
      "Renamed notebook",
    ));
    expect(notebookRuntime.rename).toHaveBeenCalledTimes(1);
  });

  it("executes the active query with connection, database, and schema and shows returned rows", async () => {
    createStatefulEditor([baseConsoleTab]);

    fireEvent.click(screen.getByRole("button", { name: /editor.run/ }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("execute_query", expect.objectContaining({
        connectionId: "conn-1",
        query: "SELECT * FROM users",
        limit: 50,
        page: 1,
        database: "analytics",
        schema: "public",
      }));
    });
    expect(await screen.findByText("1:Alice")).toBeInTheDocument();
    expect(screen.getByText(/editor.rowsRetrieved/)).toBeInTheDocument();
  });

  it("uses the active tuple after switching away from a stale previous selection", async () => {
    const tab = { ...baseConsoleTab, database: undefined, schema: undefined };
    const { rerenderWithDatabase } = createStatefulEditor([tab]);

    rerenderWithDatabase(createDatabase({ activeDatabase: "app", activeSchema: "public" }));
    rerenderWithDatabase(createDatabase({ activeDatabase: "analytics", activeSchema: "reporting" }));
    fireEvent.click(screen.getByRole("button", { name: /editor.run/ }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("execute_query", expect.objectContaining({
        connectionId: "conn-1",
        database: "analytics",
        schema: "reporting",
      }));
    });
    expect(await screen.findByText("1:Alice")).toBeInTheDocument();
  });

  it("shows loading state and then preserves already-loaded results", async () => {
    let resolveQuery: (value: QueryResult) => void = () => {};
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "execute_query") {
        return new Promise<QueryResult>((resolve) => {
          resolveQuery = resolve;
        });
      }
      return Promise.resolve([]);
    });
    createStatefulEditor([baseConsoleTab]);

    fireEvent.click(screen.getByRole("button", { name: /editor.run/ }));

    expect(await screen.findByText("editor.executingQuery")).toBeInTheDocument();
    expect(screen.queryByText("2:Bob")).not.toBeInTheDocument();

    await act(async () => {
      resolveQuery(makeResult([[2, "Bob"]]));
    });

    expect(await screen.findByText("2:Bob")).toBeInTheDocument();
    expect(screen.queryByText("editor.executingQuery")).not.toBeInTheDocument();
  });

  it("records mixed batch results while preserving statement order and context", async () => {
    const batchResults: BatchStatementResult[] = [
      { result: makeResult([[1]]), error: null, execution_time_ms: 3 },
      { result: null, error: "syntax error", execution_time_ms: 4 },
    ];
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "execute_query_batch") return Promise.resolve(batchResults);
      return Promise.resolve([]);
    });
    createStatefulEditor([{ ...baseConsoleTab, query: "SELECT 1; SELECT broken" }]);

    fireEvent.click(screen.getByRole("button", { name: /editor.run/ }));
    fireEvent.click(await screen.findByText("run-all-queries"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("execute_query_batch", expect.objectContaining({
        connectionId: "conn-1",
        queries: ["SELECT 1", "SELECT broken"],
        database: "analytics",
        schema: "public",
      }));
    });
    expect(await screen.findByText("SELECT 1")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText("editor.multiResult.queryPrefix 2")).toBeInTheDocument();
  });

  it("marks unresolved batch statements failed when execution stops on error", async () => {
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === "execute_query_batch") return Promise.reject("stopped on error");
      return Promise.resolve([]);
    });
    createStatefulEditor([{ ...baseConsoleTab, query: "SELECT ok; SELECT fail; SELECT skipped" }]);

    fireEvent.click(screen.getByRole("button", { name: /editor.run/ }));
    fireEvent.click(await screen.findByText("run-all-queries"));

    expect(await screen.findByText("Error: stopped on error")).toBeInTheDocument();
    expect(screen.getByText("SELECT ok")).toBeInTheDocument();
    expect(screen.getByText("editor.multiResult.queryPrefix 2")).toBeInTheDocument();
    expect(screen.getByText("editor.multiResult.queryPrefix 3")).toBeInTheDocument();
  });

  it("cancels the active query with connection id and shows cancellation state", async () => {
    createStatefulEditor([{ ...baseConsoleTab, isLoading: true }]);

    expect(screen.getByText("editor.executingQuery")).toBeInTheDocument();
    fireEvent.click(screen.getByText("editor.stop"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cancel_query", { connectionId: "conn-1" });
    });
    expect(screen.queryByText("editor.executingQuery")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /editor.run/ })).toBeInTheDocument();
  });
});
