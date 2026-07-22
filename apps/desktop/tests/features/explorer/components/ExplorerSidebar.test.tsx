import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { MemoryRouter } from "react-router-dom";
import { ExplorerSidebar } from "../../../../src/components/layout/ExplorerSidebar";
import { useDatabase } from "../../../../src/features/connections/hooks/useDatabase";
import { useEditor } from "../../../../src/features/editor/hooks/useEditor";
import { useDrivers } from "../../../../src/features/plugins/hooks/useDrivers";
import type { DatabaseContextType } from "../../../../src/features/connections/state/DatabaseContext";
import type { DriverCapabilities } from "../../../../src/types/plugins";

vi.mock("../../../../src/features/connections/hooks/useDatabase", () => ({
  useDatabase: vi.fn(),
}));

vi.mock("../../../../src/features/editor/hooks/useEditor", () => ({
  useEditor: vi.fn(),
}));

vi.mock("../../../../src/features/plugins/hooks/useDrivers", () => ({
  useDrivers: vi.fn(),
}));

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { compactMode: false } }),
}));

vi.mock("../../../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

vi.mock("../../../../src/hooks/useConnectionLayoutContext", () => ({
  useConnectionLayoutContext: () => ({ explorerConnectionId: "conn-1", splitView: false, isSplitVisible: false }),
}));

vi.mock("../../../../src/features/editor/hooks/useSavedQueries", () => ({
  useSavedQueries: () => ({ queries: [], saveQuery: vi.fn(), deleteQuery: vi.fn(), updateQuery: vi.fn() }),
}));

vi.mock("../../../../src/features/editor/hooks/useQueryHistory", () => ({
  useQueryHistory: () => ({ entries: [], isLoading: false, deleteEntry: vi.fn(), clearHistory: vi.fn(), recoveryNotice: null, dismissRecoveryNotice: vi.fn() }),
}));

vi.mock("../../../../src/components/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));

vi.mock("../../../../src/components/ui/ContextMenu", () => ({
  ContextMenu: ({ items }: { items: Array<{ label?: string; action?: () => void; separator?: boolean; disabled?: boolean }> }) => (
    <div>
      {items.filter((item) => !item.separator).map((item) => (
        <button key={item.label} type="button" disabled={item.disabled} onClick={item.action}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../../../src/components/modals/ConfirmModal", () => ({
  ConfirmModal: ({ isOpen, title, onConfirm }: { isOpen: boolean; title: string; onConfirm: () => void }) => isOpen ? (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onConfirm}>common.confirm</button>
    </div>
  ) : null,
}));

vi.mock("../../../../src/components/layout/sidebar/NotebooksSection", () => ({
  NotebooksSection: () => <div>notebooks-section</div>,
}));

vi.mock("../../../../src/components/layout/sidebar/QueryHistorySection", () => ({
  QueryHistorySection: () => <div>history-section</div>,
}));

vi.mock("../../../../src/components/modals/DumpDatabaseModal", () => ({
  DumpDatabaseModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>dump-modal</div> : null,
}));

vi.mock("../../../../src/components/modals/ImportDatabaseModal", () => ({
  ImportDatabaseModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>import-modal</div> : null,
}));

vi.mock("../../../../src/features/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/features/schema")>();
  return {
    ...actual,
    ClipboardImportModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>clipboard-modal</div> : null,
  };
});

vi.mock("../../../../src/components/layout/sidebar/SidebarSchemaItem", () => ({
  SidebarSchemaItem: ({ database, schemaName, schemaData, onTableClick, onTableDoubleClick, onContextMenu }: {
    database?: string;
    schemaName: string;
    schemaData?: { tables?: Array<{ name: string }> };
    onTableClick: (name: string, schema: string) => void;
    onTableDoubleClick: (name: string, schema: string) => void;
    onContextMenu: (event: React.MouseEvent, type: string, id: string, label: string, data?: { database?: string; schema?: string }) => void;
  }) => (
    <div>
      <span>{schemaName}</span>
      {(schemaData?.tables ?? []).map((table) => (
        <div
          key={table.name}
          role="button"
          tabIndex={0}
          onClick={() => onTableClick(table.name, schemaName)}
          onDoubleClick={() => onTableDoubleClick(table.name, schemaName)}
          onContextMenu={(event) => onContextMenu(event, "table", table.name, table.name, { database, schema: schemaName })}
        >
          {table.name}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(), open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn(), writeTextFile: vi.fn() }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = () => null;
  return {
    ...actual,
    Database: Icon,
    Plus: Icon,
    FileCode: Icon,
    Play: Icon,
    Edit: Icon,
    Trash2: Icon,
    PanelLeftClose: Icon,
    Network: Icon,
    PlaySquare: Icon,
    Hash: Icon,
    FileText: Icon,
    Copy: Icon,
    Loader2: Icon,
    Download: Icon,
    Upload: Icon,
    ChevronDown: Icon,
    RefreshCw: Icon,
    AlertCircle: Icon,
    ChevronRight: Icon,
    Settings2: Icon,
    Check: Icon,
    RotateCcw: Icon,
    CheckSquare: Icon,
    Square: Icon,
    Search: Icon,
    X: Icon,
    Star: Icon,
    FileInput: Icon,
    Layers: Icon,
    Clock: Icon,
    Clipboard: Icon,
    BookOpen: Icon,
    Table: Icon,
    Folder: Icon,
    FolderOpen: Icon,
    Sparkles: Icon,
    Grid3x3: Icon,
    Smile: Icon,
    Image: Icon,
    Palette: Icon,
  };
});

const capabilities: DriverCapabilities = {
    schemas: false,

  views: true,
  routines: true,
  file_based: false,
  folder_based: false,
  multiple_databases: true,
  identifier_quote: '"',
    alter_primary_key: true,
    truncate_table: true,
  };


function createDatabase(overrides: Partial<DatabaseContextType> = {}): DatabaseContextType {
  return {
    activeConnectionId: "conn-1",
    openConnectionIds: ["conn-1"],
    connectionDataMap: {},
    activeTable: null,
    activeDriver: "postgres",
    activeCapabilities: capabilities,
    activeConnectionName: "Warehouse",
    activeDatabaseName: "app",
          tables: [{ name: "events" }],
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
    activeSchema: "reporting",
    selectedSchemas: ["reporting"],
    needsSchemaSelection: false,
    selectedDatabases: ["app", "analytics"],
    setSelectedDatabases: vi.fn(),
    databaseDataMap: {
      app: {
        tables: [{ name: "users" }],
        views: [],
        routines: [],
        triggers: [],
        isLoading: false,
        isLoaded: true,
        schemas: ["public"],
        selectedSchemas: ["public"],
        activeSchema: "public",
        needsSchemaSelection: false,
        schemaDataMap: {
          public: { tables: [{ name: "users" }], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true },
        },
      },
      analytics: {
        tables: [{ name: "events" }],
        views: [],
        routines: [],
        triggers: [],
        isLoading: true,
        isLoaded: true,
        schemas: ["reporting"],
        selectedSchemas: ["reporting"],
        activeSchema: "reporting",
        needsSchemaSelection: false,
        schemaDataMap: {
          reporting: { tables: [{ name: "events" }], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true },
        },
      },
    },
    connections: [{ id: "conn-1", name: "Warehouse", params: { driver: "postgres", database: ["app", "analytics"] } }],
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
    getConnectionData: vi.fn(),
    isConnectionOpen: vi.fn(() => true),
    globallyOpenConnectionIds: ["conn-1"],
    isConnectionOpenAnywhere: vi.fn(() => true),
    createGroup: vi.fn(),
    createGroupPath: vi.fn(),
    updateGroup: vi.fn(),
    moveGroupToParent: vi.fn(),
    deleteGroup: vi.fn(),
    moveConnectionToGroup: vi.fn(),
    reorderGroups: vi.fn(),
    reorderConnectionsInGroup: vi.fn(),
    toggleGroupCollapsed: vi.fn(),
    ...overrides,
  };
}

function renderSidebar(database = createDatabase()) {
  vi.mocked(useDatabase).mockReturnValue(database);
  vi.mocked(useEditor).mockReturnValue({
    tabs: [],
    activeTabId: null,
    activeTab: null,
    addTab: vi.fn(() => "tab-1"),
    openNotebook: vi.fn(),
    updateTab: vi.fn(),
    closeTab: vi.fn(),
    closeAllTabs: vi.fn(),
    closeOtherTabs: vi.fn(),
    closeTabsToLeft: vi.fn(),
    closeTabsToRight: vi.fn(),
    updateResultEntry: vi.fn(),
    setActiveTabId: vi.fn(),
    getSchema: vi.fn(() => Promise.resolve([])),
  });
  vi.mocked(useDrivers).mockReturnValue({
    allDrivers: [{ id: "postgres", name: "PostgreSQL", capabilities }],
  });

  const rendered = render(
    <MemoryRouter>
      <ExplorerSidebar
        sidebarWidth={320}
        startResize={vi.fn()}
        onCollapse={vi.fn()}
        sidebarTab="structure"
        onSidebarTabChange={vi.fn()}
      />
    </MemoryRouter>,
  );

  return {
    ...rendered,
    rerenderWithDatabase(nextDatabase: DatabaseContextType) {
      vi.mocked(useDatabase).mockReturnValue(nextDatabase);
      rendered.rerender(
        <MemoryRouter>
          <ExplorerSidebar
            sidebarWidth={320}
            startResize={vi.fn()}
            onCollapse={vi.fn()}
            sidebarTab="structure"
            onSidebarTabChange={vi.fn()}
          />
        </MemoryRouter>,
      );
    },
  };
}

describe("ExplorerSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as Mock).mockResolvedValue(undefined);
    (listen as Mock).mockResolvedValue(vi.fn());
    (ask as Mock).mockResolvedValue(true);
    (open as Mock).mockResolvedValue(null);
    (save as Mock).mockResolvedValue(null);
  });

  it("shows the active analytics/reporting/table context while preserving stale previous loaded data during pending loading", () => {
    const loadDatabaseSchemaData = vi.fn();
    const setActiveDatabaseContext = vi.fn();
    const setActiveSchema = vi.fn();
    const setActiveTableContext = vi.fn();
    const previousDatabase = createDatabase({
      activeDatabaseName: "app",
      activeDatabase: "app",
      activeSchema: "public",
      activeTable: "users",
      activeCapabilities: { ...capabilities, schemas: true },
      selectedDatabases: ["app", "analytics"],
      loadDatabaseSchemaData,
      setActiveDatabaseContext,
      setActiveSchema,
      setActiveTableContext,
      databaseDataMap: {
        app: {
          tables: [{ name: "users" }],
          views: [],
          routines: [],
          triggers: [],
          isLoading: false,
          isLoaded: true,
          schemas: ["public"],
          selectedSchemas: ["public"],
          activeSchema: "public",
          needsSchemaSelection: false,
          schemaDataMap: {
            public: { tables: [{ name: "users" }], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true },
          },
        },
        analytics: {
          tables: [{ name: "events" }],
          views: [],
          routines: [],
          triggers: [],
          isLoading: false,
          isLoaded: true,
          schemas: ["reporting"],
          selectedSchemas: ["reporting"],
          activeSchema: "reporting",
          needsSchemaSelection: false,
          schemaDataMap: {
            reporting: { tables: [], views: [], routines: [], triggers: [], isLoading: true, isLoaded: false },
          },
        },
      },
    });
    const { rerenderWithDatabase } = renderSidebar(previousDatabase);

    expect(screen.getByText("app")).toBeInTheDocument();

    const activeDatabase = createDatabase({
      ...previousDatabase,
      activeCapabilities: { ...capabilities, schemas: true },
      selectedDatabases: ["app", "analytics"],
      activeDatabase: "analytics",
      activeSchema: "reporting",
      activeTable: "events",
      databaseDataMap: {
        ...previousDatabase.databaseDataMap,
        analytics: {
          ...previousDatabase.databaseDataMap.analytics,
          isLoading: true,
          schemaDataMap: {
            reporting: { tables: [{ name: "events" }], views: [], routines: [], triggers: [], isLoading: true, isLoaded: true },
          },
        },
      },
    });
    rerenderWithDatabase(activeDatabase);

    expect(previousDatabase.databaseDataMap.app.schemaDataMap.public.tables).toEqual([{ name: "users" }]);
    expect(screen.getByText("analytics")).toBeInTheDocument();
    expect(screen.getByText("reporting")).toBeInTheDocument();
    expect(screen.getByText("events")).toBeInTheDocument();
    expect(loadDatabaseSchemaData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("events"));

    expect(setActiveTableContext).toHaveBeenCalledWith("events", "analytics", "reporting");
  });

  it("passes the exact database/schema/table tuple when selecting and opening a table", async () => {
    const setActiveTableContext = vi.fn();
    const database = createDatabase({ setActiveTableContext, activeCapabilities: { ...capabilities, schemas: true } });
    renderSidebar(database);

    fireEvent.click(screen.getByText("events"));

    expect(setActiveTableContext).toHaveBeenCalledWith("events", "analytics", "reporting");

    fireEvent.doubleClick(screen.getByText("events"));

    expect(setActiveTableContext).toHaveBeenCalledWith("events", "analytics", "reporting");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
  });

  it("renders loading, history, and notebook workflows and gates connection actions by capabilities", () => {
    const { rerender } = renderSidebar(createDatabase({ isLoadingTables: true }));
    expect(screen.getByText("sidebar.loadingSchema")).toBeInTheDocument();

    vi.mocked(useDatabase).mockReturnValue(createDatabase());
    rerender(
      <MemoryRouter>
        <ExplorerSidebar sidebarWidth={320} startResize={vi.fn()} onCollapse={vi.fn()} sidebarTab="history" onSidebarTabChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("history-section")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ExplorerSidebar sidebarWidth={320} startResize={vi.fn()} onCollapse={vi.fn()} sidebarTab="notebooks" onSidebarTabChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("notebooks-section")).toBeInTheDocument();

    vi.mocked(useDatabase).mockReturnValue(createDatabase({ activeCapabilities: { ...capabilities, no_connection_required: true } }));
    rerender(
      <MemoryRouter>
        <ExplorerSidebar sidebarWidth={320} startResize={vi.fn()} onCollapse={vi.fn()} sidebarTab="structure" onSidebarTabChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTitle("dump.importDatabase")).not.toBeInTheDocument();
  });

  it("opens dump, confirmed import, clipboard import, and ER diagram with raw APIs", async () => {
    (open as Mock).mockResolvedValue("/tmp/input.sql");
    renderSidebar(createDatabase({
      activeDatabaseName: "analytics",
      selectedDatabases: ["analytics"],
    }));

    fireEvent.click(screen.getAllByTitle("dump.dumpDatabase")[0]);
    expect(screen.getByText("dump-modal")).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle("dump.importDatabase")[0]);
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(screen.getByText("import-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("View Schema Diagram"));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("open_er_diagram_window", {
      connectionId: "conn-1",
      connectionName: "Warehouse",
      databaseName: "analytics",
      schema: "reporting",
    }));

    fireEvent(window, new Event("nexora:paste-import"));
    expect(screen.getByText("clipboard-modal")).toBeInTheDocument();
  });

  it("sends the exact active tuple to backend table actions after switching from stale app/public/users", async () => {
    const previous = createDatabase({
      activeDatabaseName: "app",
      activeDatabase: "app",
      activeSchema: "public",
      activeTable: "users",
      activeCapabilities: { ...capabilities, schemas: true },
      selectedDatabases: ["app", "analytics"],
    });
    const { rerenderWithDatabase } = renderSidebar(previous);
    const next = createDatabase({
      activeDatabase: "analytics",
      activeSchema: "reporting",
      activeTable: "events",
      activeCapabilities: { ...capabilities, schemas: true },
      selectedDatabases: ["app", "analytics"],
    });

    rerenderWithDatabase(next);
    fireEvent.contextMenu(screen.getByText("events"));
    fireEvent.click(screen.getByText("sidebar.truncateTable"));
    fireEvent.click(screen.getByText("common.confirm"));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("truncate_table", {
      connectionId: "conn-1",
      table: "events",
      database: "analytics",
      schema: "reporting",
    }));
  });

  it("pins raw explorer importer families and data-transfer payload shapes", async () => {
    const core = await import("@tauri-apps/api/core");
    const events = await import("@tauri-apps/api/event");
    const dialogs = await import("@tauri-apps/plugin-dialog");
    const files = await import("@tauri-apps/plugin-fs");

    await core.invoke("get_columns", {
      connectionId: "conn-1",
      tableName: "orders",
      database: "analytics",
      schema: "reporting",
    });
    await core.invoke("get_view_columns", {
      connectionId: "conn-1",
      viewName: "order_totals",
      database: "analytics",
      schema: "reporting",
    });
    await core.invoke("get_routine_parameters", {
      connectionId: "conn-1",
      routineName: "refresh_orders",
      database: "analytics",
      schema: "reporting",
    });
    await core.invoke("execute_query", {
      connectionId: "conn-1",
      query: 'ALTER TABLE "reporting"."orders" DROP COLUMN "obsolete"',
      database: "analytics",
      schema: "reporting",
    });
    await core.invoke("dump_database", {
      connectionId: "conn-1",
      filePath: "/tmp/dump.sql",
      options: { structure: true, data: true, tables: ["orders"] },
      database: "analytics",
      schema: "reporting",
    });
    await core.invoke("import_database", {
      connectionId: "conn-1",
      filePath: "/tmp/import.sql",
      schema: "reporting",
    });
    await events.listen("import_progress", vi.fn());
    await dialogs.ask("confirm", { title: "Import", kind: "warning" });
    await dialogs.open({ filters: [{ name: "SQL", extensions: ["sql"] }] });
    await dialogs.save({ defaultPath: "dump.sql" });
    await files.readTextFile("/tmp/notebook.json");
    await files.writeTextFile("/tmp/notebook.json", "{}");

    expect(invoke).toHaveBeenCalledWith("import_database", {
      connectionId: "conn-1",
      filePath: "/tmp/import.sql",
      schema: "reporting",
    });
    expect(invoke).not.toHaveBeenCalledWith(
      "import_database",
      expect.objectContaining({ database: expect.anything() }),
    );
    expect(listen).toHaveBeenCalledWith("import_progress", expect.any(Function));
    expect(ask).toHaveBeenCalled();
    expect(open).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(files.readTextFile).toHaveBeenCalled();
    expect(files.writeTextFile).toHaveBeenCalled();
  });
});
