import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router-dom";
import { ExplorerSidebar } from "../../../src/components/layout/ExplorerSidebar";
import { useDatabase } from "../../../src/features/connections/hooks/useDatabase";
import { useEditor } from "../../../src/features/editor/hooks/useEditor";
import { useDrivers } from "../../../src/features/plugins/hooks/useDrivers";
import type { DatabaseContextType } from "../../../src/features/connections/state/DatabaseContext";
import type { DriverCapabilities } from "../../../src/types/plugins";

vi.mock("../../../src/features/connections/hooks/useDatabase", () => ({
  useDatabase: vi.fn(),
}));

vi.mock("../../../src/features/editor/hooks/useEditor", () => ({
  useEditor: vi.fn(),
}));

vi.mock("../../../src/features/plugins/hooks/useDrivers", () => ({
  useDrivers: vi.fn(),
}));

vi.mock("../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { compactMode: false } }),
}));

vi.mock("../../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

vi.mock("../../../src/hooks/useConnectionLayoutContext", () => ({
  useConnectionLayoutContext: () => ({ explorerConnectionId: "conn-1", splitView: false, isSplitVisible: false }),
}));

vi.mock("../../../src/features/editor/hooks/useSavedQueries", () => ({
  useSavedQueries: () => ({ queries: [], saveQuery: vi.fn(), deleteQuery: vi.fn(), updateQuery: vi.fn() }),
}));

vi.mock("../../../src/features/editor/hooks/useQueryHistory", () => ({
  useQueryHistory: () => ({ entries: [], isLoading: false, deleteEntry: vi.fn(), clearHistory: vi.fn(), recoveryNotice: null, dismissRecoveryNotice: vi.fn() }),
}));

vi.mock("../../../src/components/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));

vi.mock("../../../src/components/ui/ContextMenu", () => ({
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

vi.mock("../../../src/components/modals/ConfirmModal", () => ({
  ConfirmModal: ({ isOpen, title, onConfirm }: { isOpen: boolean; title: string; onConfirm: () => void }) => isOpen ? (
    <div>
      <span>{title}</span>
      <button type="button" onClick={onConfirm}>common.confirm</button>
    </div>
  ) : null,
}));

vi.mock("../../../src/components/layout/sidebar/NotebooksSection", () => ({
  NotebooksSection: () => <div />,
}));

vi.mock("../../../src/components/layout/sidebar/QueryHistorySection", () => ({
  QueryHistorySection: () => <div />,
}));

vi.mock("../../../src/components/layout/sidebar/SidebarSchemaItem", () => ({
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
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(), open: vi.fn() }));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return {
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
});
