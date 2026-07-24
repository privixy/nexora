import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { quoteTableRef } from "../../../shared/lib/identifiers";
import { dataTransferGateway } from "../../../platform/tauri/dataTransferGateway";
import { dialogGateway } from "../../../platform/tauri/dialogGateway";
import {
  Database,
  Plus,
  FileCode,
  Play,
  Edit,
  Trash2,
  PanelLeftClose,
  Network,
  PlaySquare,
  Hash,
  FileText,
  Copy,
  Loader2,
  Download,
  Upload,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Settings2,
  Check,
  RotateCcw,
  CheckSquare,
  Square,
  Search,
  X,
  Star,
  FileInput,
  Clipboard,
} from "lucide-react";
const { ask, open } = dialogGateway;
import { toErrorMessage } from "../../../shared/lib/errors";
import { useAlert } from "../../../shared/hooks/useAlert";
import { useSettings } from "../../settings";
import { useDatabase } from "../../connections";
import { useEditor } from "../../editor";
import { useSavedQueries } from "../../editor";
import { useQueryHistory } from "../../editor";
import type { SavedQuery } from "../../editor";
import type { QueryHistoryEntry } from "../../editor";
import type { NotebookMetadata } from "../../notebooks";
import { ContextMenu, type ContextMenuItem } from "../../../shared/ui/ContextMenu";
import { SchemaModal } from "../../schema";
import { CreateTableModal } from "../../schema";
import { QueryModal } from "../../editor";
import { ModifyColumnModal } from "../../schema";
import { CreateIndexModal } from "../../schema";
import { CreateForeignKeyModal } from "../../schema";
import { GenerateSQLModal } from "../../editor";
import { DumpDatabaseModal } from "./DumpDatabaseModal";
import { ImportDatabaseModal } from "./ImportDatabaseModal";
import { ClipboardImportModal } from "../../schema";
import { ViewEditorModal } from "../../schema";
import { TriggerEditorModal } from "../../schema";
import type { SqlEditorComponent } from "../../../shared/types/sqlEditor";
import { ConfirmModal } from "../../../shared/ui/ConfirmModal";
import { RunRoutineModal } from "../../schema";
import { Accordion } from "./sidebar/Accordion";
import { SidebarTableItem } from "./sidebar/SidebarTableItem";
import { buildTableItemSelector } from "../lib/sidebarTableItem";
import { fuzzyFilter } from "../../../shared/lib/fuzzy";
import { SidebarViewItem } from "./sidebar/SidebarViewItem";
import { SidebarRoutineItem } from "./sidebar/SidebarRoutineItem";
import { SidebarRoutineGroupHeader } from "./sidebar/SidebarRoutineGroupHeader";
import { SidebarSchemaItem } from "./sidebar/SidebarSchemaItem";
import { SidebarDatabaseItem } from "./sidebar/SidebarDatabaseItem";
import { SidebarTriggerItem } from "./sidebar/SidebarTriggerItem";
import { QueryHistorySection } from "./sidebar/QueryHistorySection";
import { NotebooksSection } from "./sidebar/NotebooksSection";
import { renameNotebook, deleteNotebook, listNotebooks, NOTEBOOKS_CHANGED_EVENT } from "../../notebooks";
import { useConnectionLayoutContext } from "../../connections";
import { useDrivers } from "../../plugins";
import { getConnectionAccent } from "../../connections";
import type { TableColumn } from "../../schema";
import type { ContextMenuData } from "../contracts";
import type { RoutineInfo, TriggerInfo } from "../../connections";
import { groupRoutinesByType } from "../../schema";
import { formatObjectCount } from "../../schema";
import { groupByDate, formatHistoryTime } from "../../../shared/lib/dateGroups";
import { SqlHighlight } from "../../editor";
import { isMultiDatabaseCapable } from "../../plugins";
import {
  supportsCreateDatabase,
  supportsCreateSchema,
  supportsDropDatabase,
  supportsManageTables,
  supportsRenameDatabase,
  supportsTruncateTable,
} from "../../plugins";
import { newConsoleForDatabase, newConsoleForTable } from "../../editor";
import {
  DEFAULT_CREATE_TABLE_TARGET,
  getCreateTableRefreshPlan,
  type CreateTableTarget,
} from "../../schema";
import { useExplorerActions } from "../hooks/useExplorerActions";
import { useExplorerContextMenu } from "../hooks/useExplorerContextMenu";
import { useExplorerSelection } from "../hooks/useExplorerSelection";
import { CreateDatabaseModal } from "./CreateDatabaseModal";
import { ExplorerModals } from "./ExplorerModals";
import { ExplorerStructure } from "./ExplorerStructure";
import { ExplorerTabs, type SidebarTab } from "./ExplorerTabs";
export type { SidebarTab } from "./ExplorerTabs";
interface ExplorerSidebarProps {
  SqlEditor: SqlEditorComponent;
  sidebarWidth: number;
  startResize: (e: React.MouseEvent) => void;
  onCollapse: () => void;
  sidebarTab: SidebarTab;
  onSidebarTabChange: (tab: SidebarTab) => void;
}
export const ExplorerSidebar = ({ SqlEditor, sidebarWidth, startResize, onCollapse, sidebarTab, onSidebarTabChange }: ExplorerSidebarProps) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const {
    activeConnectionId,
    activeDriver,
    activeCapabilities,
    activeTable,
    setActiveTableContext,
    setActiveDatabaseContext,
    setActiveSchema,
    tables,
    views,
    routines,
    triggers,
    isLoadingTables,
    refreshTables,
    refreshViews,
    refreshRoutines,
    refreshTriggers,
    activeConnectionName,
    activeDatabaseName,
    activeDatabase,
    schemas,
    isLoadingSchemas,
    schemaDataMap,
    activeSchema,
    loadSchemaData,
    refreshSchemaData,
    selectedSchemas,
    setSelectedSchemas,
    needsSchemaSelection,
    selectedDatabases,
    setSelectedDatabases,
    databaseDataMap,
    loadDatabaseData,
    refreshDatabaseData,
    loadDatabaseSchemaData,
    refreshDatabaseSchemaData,
    connectionDataMap,
    connections,
    connect,
  } = useDatabase();
  const { allDrivers } = useDrivers();
  const { tabs, openNotebook, updateTab, closeTab } = useEditor();
  // Accent color for a connection, matching the tinted editor tab bar / split
  // panel headers. Falls back to the driver manifest color.
  const accentForConnection = (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    const driverId = conn?.params.driver ?? connectionDataMap[connId]?.driver;
    return getConnectionAccent(conn, allDrivers.find((d) => d.id === driverId));
  };

  const schemaLoadError =
    activeCapabilities?.schemas === true && schemas.length === 0 && activeConnectionId
      ? connectionDataMap[activeConnectionId]?.error
      : undefined;
  const { queries, deleteQuery, updateQuery, saveQuery } = useSavedQueries();
  const {
    entries: historyEntries,
    isLoading: isHistoryLoading,
    deleteEntry: deleteHistoryEntry,
    clearHistory,
    recoveryNotice: historyRecoveryNotice,
    dismissRecoveryNotice: dismissHistoryRecoveryNotice,
  } = useQueryHistory();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [schemaVersion, setSchemaVersion] = useState(0);
  const sidebarBodyRef = useRef<HTMLDivElement>(null);
  const [schemaErrorExpanded, setSchemaErrorExpanded] = useState(false);
  const [schemaErrorCopied, setSchemaErrorCopied] = useState(false);

  const { splitView, isSplitVisible, explorerConnectionId, setExplorerConnectionId } = useConnectionLayoutContext();

  const {
    contextMenu,
    openContextMenu: handleContextMenu,
    closeContextMenu,
  } = useExplorerContextMenu();
  const [schemaModal, setSchemaModal] = useState<{ tableName: string; database?: string; schema?: string } | null>(null);
  const [runRoutineModal, setRunRoutineModal] = useState<{ routine: RoutineInfo; database?: string; schema?: string } | null>(null);
  const [routineDropConfirm, setRoutineDropConfirm] = useState<{ name: string; routineType: string; database?: string; schema?: string } | null>(null);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [createTableTarget, setCreateTableTarget] = useState<CreateTableTarget>(DEFAULT_CREATE_TABLE_TARGET);
  const [isClipboardImportOpen, setIsClipboardImportOpen] = useState(false);
  const [modifyColumnModal, setModifyColumnModal] = useState<{
    isOpen: boolean;
    tableName: string;
    database?: string;
    schema?: string;
    column: TableColumn | null;
  }>({ isOpen: false, tableName: "", column: null });
  const [createIndexModal, setCreateIndexModal] = useState<{
    isOpen: boolean;
    tableName: string;
    database?: string;
    schema?: string;
  }>({ isOpen: false, tableName: "" });
  const [createForeignKeyModal, setCreateForeignKeyModal] = useState<{
    isOpen: boolean;
    tableName: string;
    database?: string;
    schema?: string;
  }>({ isOpen: false, tableName: "" });
  const [generateSQLModal, setGenerateSQLModal] = useState<{
    tableName: string;
    database?: string;
    schema?: string;
  } | null>(null);
  const setSidebarTab = onSidebarTabChange;
  const [historyToFavoriteSQL, setHistoryToFavoriteSQL] = useState<string | null>(null);
  const [historyToFavoriteDB, setHistoryToFavoriteDB] = useState<string | null>(null);
  const [historyDeleteConfirm, setHistoryDeleteConfirm] = useState<string | null>(null);
  const [historyClearConfirm, setHistoryClearConfirm] = useState(false);
  const [favoriteDeleteConfirm, setFavoriteDeleteConfirm] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [favoritesFilter, setFavoritesFilter] = useState("");
  const [refreshingMatView, setRefreshingMatView] = useState<string | null>(null);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [triggersOpenFlat, setTriggersOpenFlat] = useState(false);
  const [triggerFilterFlat, setTriggerFilterFlat] = useState("");
  const [functionsOpen, setFunctionsOpen] = useState(true);
  const [proceduresOpen, setProceduresOpen] = useState(true);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [queryModal, setQueryModal] = useState<{
    isOpen: boolean;
    query?: SavedQuery;
  }>({ isOpen: false });
  const [dumpModal, setDumpModal] = useState<{ database: string } | null>(null);
  const [importModal, setImportModal] = useState<{
    filePath: string;
    database: string;
  } | null>(null);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isSchemaFilterOpen, setIsSchemaFilterOpen] = useState(false);
  const [dbFilter, setDbFilter] = useState("");
  const [isDbManagerOpen, setIsDbManagerOpen] = useState(false);
  const {
    pendingSchemas: pendingSchemaSelection,
    pendingDatabases: pendingDbSelection,
    resetSchemas: setPendingSchemaSelection,
    resetDatabases: setPendingDbSelection,
    toggleSchema,
    toggleDatabase,
    toggleAllSchemas,
    toggleAllDatabases,
    confirmSchemas,
    confirmDatabases,
  } = useExplorerSelection();
  const [allAvailableDatabases, setAllAvailableDatabases] = useState<string[]>([]);
  const [isLoadingAllDbs, setIsLoadingAllDbs] = useState(false);
  const [viewEditorModal, setViewEditorModal] = useState<{
    isOpen: boolean;
    viewName?: string;
    database?: string;
    schema?: string;
    isNewView?: boolean;
  }>({ isOpen: false });

  const [triggerEditorModal, setTriggerEditorModal] = useState<{
    isOpen: boolean;
    triggerName?: string;
    tableName?: string;
    database?: string;
    schema?: string;
    isNewTrigger?: boolean;
  }>({ isOpen: false });
  const [databaseDropConfirm, setDatabaseDropConfirm] = useState<string | null>(null);
  const [isCreateDatabaseModalOpen, setIsCreateDatabaseModalOpen] = useState(false);
  const [tableTruncateConfirm, setTableTruncateConfirm] = useState<{
    tableName: string;
    database?: string;
    schema?: string;
  } | null>(null);

  const groupedRoutines = routines ? groupRoutinesByType(routines) : { procedures: [], functions: [] };

  const openCreateTableModal = (target: CreateTableTarget) => {
    setCreateTableTarget(target);
    setIsCreateTableModalOpen(true);
  };

  const refreshAfterCreateTable = async () => {
    const refreshPlan = getCreateTableRefreshPlan(createTableTarget);

    if (refreshPlan.scope === "schema") {
      await refreshSchemaData(refreshPlan.schema);
    } else if (refreshPlan.scope === "database") {
      await refreshDatabaseData(refreshPlan.database);
    } else if (refreshPlan.scope === "database-schema") {
      await refreshDatabaseSchemaData(refreshPlan.database, refreshPlan.schema);
    } else if (refreshTables) {
      await refreshTables();
    }
    setSchemaVersion((v) => v + 1);
  };

  const {
    runQuery,
    runSavedQuery,
    selectTable,
    openTable,
    openView,
  } = useExplorerActions({
    connectionId: activeConnectionId,
    driver: activeDriver,
    navigate,
    setActiveTableContext,
  });

  // Notebook count for the tab badge — kept in sync with the active connection
  // and refreshed whenever notebooks change (save/rename/delete/import).
  const [notebookCount, setNotebookCount] = useState(0);
  useEffect(() => {
    if (!activeConnectionId) {
      setNotebookCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      listNotebooks(activeConnectionId)
        .then((nbs) => {
          if (!cancelled) setNotebookCount(nbs.length);
        })
        .catch(() => {
          if (!cancelled) setNotebookCount(0);
        });
    };
    refresh();
    window.addEventListener(NOTEBOOKS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTEBOOKS_CHANGED_EVENT, refresh);
    };
  }, [activeConnectionId]);

  // The Notebooks section only lists the active connection's notebooks, so all
  // actions stay within activeConnectionId.
  const handleOpenNotebook = (nb: NotebookMetadata) => {
    if (!activeConnectionId) return;
    openNotebook(activeConnectionId, nb.id, nb.title);
    navigate("/editor");
  };

  const handleRenameNotebook = async (notebookId: string, title: string) => {
    if (!activeConnectionId) return;
    await renameNotebook(notebookId, activeConnectionId, title);
    const open = tabs.find((tb) => tb.notebookId === notebookId);
    if (open) updateTab(open.id, { title });
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    if (!activeConnectionId) return;
    // Clears cache + timers first, so closing the tab below won't re-save it.
    await deleteNotebook(notebookId, activeConnectionId);
    const open = tabs.find((tb) => tb.notebookId === notebookId);
    if (open) closeTab(open.id);
  };

  useEffect(() => {
    const handler = () => {
      if (activeConnectionId && activeCapabilities?.no_connection_required !== true) {
        setIsClipboardImportOpen(true);
      }
    };
    window.addEventListener("nexora:paste-import", handler);
    return () => window.removeEventListener("nexora:paste-import", handler);
  }, [activeConnectionId, activeCapabilities]);

  // Focus the first visible "Filter tables…" input (flat / per-schema / per-db
  // layouts) when the focus_table_filter shortcut fires.
  useEffect(() => {
    const handler = () => {
      const input = sidebarBodyRef.current?.querySelector<HTMLInputElement>(
        "[data-table-filter]",
      );
      input?.focus();
      input?.select();
    };
    window.addEventListener("nexora:focus-table-filter", handler);
    return () =>
      window.removeEventListener("nexora:focus-table-filter", handler);
  }, []);

  const handleTableClick = (tableName: string, schema?: string) => {
    selectTable(tableName, undefined, schema);
  };

  const handleOpenTable = (tableName: string, schema?: string) => {
    openTable(tableName, undefined, schema);
  };

  const handleViewClick = (viewName: string) => {
    setActiveView(viewName);
  };

  const handleOpenView = (viewName: string, schema?: string, materialized = false) => {
    openView(viewName, undefined, schema, materialized);
  };

  const handleOpenDatabaseTable = (tableName: string, database?: string) => {
    openTable(tableName, database);
  };

  const handleOpenDatabaseView = (viewName: string, database?: string) => {
    openView(viewName, database);
  };

  const handleTableContext = (tableName: string, database: string, schema?: string) => {
    selectTable(tableName, database, schema);
  };

  const handleOpenDatabaseSchemaTable = (tableName: string, database: string, schema?: string) => {
    openTable(tableName, database, schema);
  };

  const handleOpenDatabaseSchemaView = (
    viewName: string,
    database: string,
    schema?: string,
    materialized = false,
  ) => {
    openView(viewName, database, schema, materialized);
  };

  const handleRoutineDoubleClick = async (
    routine: RoutineInfo,
    schema?: string,
    database?: string,
  ) => {
    try {
      const definition = await dataTransferGateway.invoke<string>("get_routine_definition", {
        connectionId: activeConnectionId,
        routineName: routine.name,
        routineType: routine.routine_type,
        ...(database ? { database } : {}),
        ...(schema ? { schema } : {}),
      });
      runQuery(
        definition,
        `${routine.name} Definition`,
        undefined,
        true,
        schema,
        true,
        database,
      );
    } catch (e) {
      console.error(e);
      showAlert(
        t("sidebar.failGetRoutineDefinition") + String(e),
        { kind: "error" }
      );
    }
  };

  const handleNewRoutine = async (routineType: string) => {
    try {
      const template = await dataTransferGateway.invoke<string>("get_routine_create_template", {
        connectionId: activeConnectionId,
        routineType,
        ...(activeSchema ? { schema: activeSchema } : {}),
      });
      const tabName =
        routineType === "FUNCTION"
          ? t("routines.newFunction")
          : t("routines.newProcedure");
      runQuery(template, tabName, undefined, true, activeSchema ?? undefined);
    } catch (e) {
      console.error(e);
      showAlert(t("routines.templateError") + String(e), { kind: "error" });
    }
  };

  const handleDropRoutine = async () => {
    if (!routineDropConfirm) return;
    const { name, routineType, database, schema } = routineDropConfirm;
    setRoutineDropConfirm(null);
    try {
      await dataTransferGateway.invoke("drop_routine", {
        connectionId: activeConnectionId,
        routineName: name,
        routineType,
        ...(database ? { database } : {}),
        ...(schema ? { schema } : {}),
      });
      showAlert(t("routines.dropSuccess", { name }), { kind: "info" });
      if (refreshRoutines) refreshRoutines();
    } catch (e) {
      console.error(e);
      showAlert(t("routines.dropError") + String(e), { kind: "error" });
    }
  };

  const handleTriggerDoubleClick = async (
    trigger: TriggerInfo,
    schema?: string,
    database?: string,
  ) => {
    try {
      const definition = await dataTransferGateway.invoke<string>("get_trigger_definition", {
        connectionId: activeConnectionId,
        triggerName: trigger.name,
        tableName: trigger.table_name,
        ...(database ? { database } : {}),
        ...(schema ? { schema } : {}),
      });
      runQuery(
        definition,
        `${trigger.name} Definition`,
        undefined,
        true,
        schema,
        true,
        database,
      );
    } catch (e) {
      console.error(e);
      showAlert(
        t("sidebar.failGetTriggerDefinition") + String(e),
        { kind: "error" }
      );
    }
  };

  const handleImportDatabase = async (database?: string) => {
    const file = await open({
      filters: [{ name: "SQL / Zip File", extensions: ["sql", "zip"] }],
    });
    if (file && typeof file === "string") {
      const confirmed = await ask(
        t("dump.confirmImport", { file: file.split(/[\\/]/).pop() }),
        { title: t("dump.importDatabase"), kind: "warning" },
      );
      if (!confirmed) return;
      setImportModal({ filePath: file, database: database ?? activeDatabaseName ?? "" });
    }
  };

  const loadAvailableDatabases = async () => {
    if (!activeConnectionId) return [];
    const all = await dataTransferGateway.invoke<string[]>("get_available_databases", { connectionId: activeConnectionId });
    setAllAvailableDatabases(all);
    return all;
  };

  const refreshAvailableDatabases = async () => {
    try {
      await loadAvailableDatabases();
    } catch (e) {
      console.error("Failed to load available databases:", e);
    }
  };

  const createDatabase = async (database: string) => {
    if (!activeConnectionId || !supportsCreateDatabase(activeCapabilities)) return;
    await dataTransferGateway.invoke("create_database", {
      connectionId: activeConnectionId,
      database,
    });
    const baseDatabases = selectedDatabases.length > 0
      ? selectedDatabases
      : activeDatabaseName
        ? [activeDatabaseName]
        : [];
    const nextDatabases = Array.from(new Set([...baseDatabases, database]));
    setSelectedDatabases(nextDatabases);
    setPendingDbSelection(nextDatabases);
    await refreshAvailableDatabases();
    await loadDatabaseData(database, undefined, true);
  };

  const handleCreateDatabase = () => {
    if (!activeConnectionId || !supportsCreateDatabase(activeCapabilities)) return;
    setIsCreateDatabaseModalOpen(true);
  };

  const handleCreateSchema = async (database?: string) => {
    if (!activeConnectionId || !supportsCreateSchema(activeCapabilities)) return;
    const schema = window.prompt(t("sidebar.createSchemaPrompt"))?.trim();
    if (!schema) return;
    try {
      await dataTransferGateway.invoke("create_schema", {
        connectionId: activeConnectionId,
        schema,
        ...(database ? { database } : {}),
      });
      const currentSelected = database
        ? (databaseDataMap[database]?.selectedSchemas ?? selectedSchemas)
        : selectedSchemas;
      await setSelectedSchemas(Array.from(new Set([...currentSelected, schema])));
      if (database) {
        await refreshDatabaseData(database);
      } else {
        await refreshSchemaData(schema);
      }
    } catch (e) {
      console.error(e);
      showAlert(t("sidebar.failCreateSchema") + toErrorMessage(e), { kind: "error" });
    }
  };

  const handleRenameDatabase = async (database: string) => {
    if (!activeConnectionId || !supportsRenameDatabase(activeCapabilities)) return;
    const nextName = window.prompt(t("sidebar.renameDatabasePrompt", { database }), database)?.trim();
    if (!nextName || nextName === database) return;
    try {
      await dataTransferGateway.invoke("rename_database", {
        connectionId: activeConnectionId,
        database,
        newName: nextName,
      });
      setSelectedDatabases(selectedDatabases.map((db) => (db === database ? nextName : db)));
      await refreshAvailableDatabases();
    } catch (e) {
      console.error(e);
      showAlert(t("sidebar.failRenameDatabase") + toErrorMessage(e), { kind: "error" });
    }
  };

  const handleDropDatabase = async () => {
    if (!activeConnectionId || !supportsDropDatabase(activeCapabilities) || !databaseDropConfirm) return;
    const database = databaseDropConfirm;
    setDatabaseDropConfirm(null);
    try {
      await dataTransferGateway.invoke("drop_database", {
        connectionId: activeConnectionId,
        database,
      });
      const nextDatabases = selectedDatabases.filter((db) => db !== database);
      setSelectedDatabases(nextDatabases);
      await refreshAvailableDatabases();
    } catch (e) {
      console.error(e);
      showAlert(t("sidebar.failDropDatabase") + toErrorMessage(e), { kind: "error" });
    }
  };

  const handleTruncateTable = async () => {
    if (!activeConnectionId || !supportsTruncateTable(activeCapabilities) || !tableTruncateConfirm) return;
    const { tableName, database, schema } = tableTruncateConfirm;
    setTableTruncateConfirm(null);
    try {
      await dataTransferGateway.invoke("truncate_table", {
        connectionId: activeConnectionId,
        table: tableName,
        ...(database ? { database } : {}),
        ...(schema ? { schema } : {}),
      });
      if (database) {
        if (schema) {
          await refreshDatabaseSchemaData(database, schema);
        } else {
          await refreshDatabaseData(database);
        }
      } else if (schema) {
        await refreshSchemaData(schema);
      } else if (refreshTables) {
        await refreshTables();
      }
      setSchemaVersion((v) => v + 1);
    } catch (e) {
      console.error(e);
      showAlert(t("sidebar.failTruncateTable") + toErrorMessage(e), { kind: "error" });
    }
  };

  const isMultiDb = isMultiDatabaseCapable(activeCapabilities) && selectedDatabases.length > 1;
  const diagramDatabaseName =
    isMultiDatabaseCapable(activeCapabilities) && selectedDatabases.length === 1
      ? selectedDatabases[0]
      : activeDatabase ?? activeDatabaseName ?? "Unknown";

  useEffect(() => {
    if (!activeTable) return;
    const container = sidebarBodyRef.current;
    if (!container) return;

    const selector = buildTableItemSelector(activeTable, activeDatabase, activeSchema);
    // The target database/schema may have just been expanded and its tables
    // loaded asynchronously, so the item might not be in the DOM on the first
    // tick. Retry across frames until it appears; without this an upward scroll
    // to a freshly expanded section silently does nothing.
    let frame = 0;
    let rafId = requestAnimationFrame(function tryScroll() {
      const el = container.querySelector<HTMLElement>(selector);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      if (frame++ < 120) {
        rafId = requestAnimationFrame(tryScroll);
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeTable, activeDatabase, activeSchema]);

  return (
    <>
      <aside
        className="bg-base border-r border-default flex flex-col relative shrink-0"
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 z-30 transition-colors"
        />

        {/* Tab switcher for split view */}
        {splitView && isSplitVisible && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-default">
            {splitView.connectionIds.map(connId => {
              const name = connectionDataMap[connId]?.connectionName ?? connId;
              const isActive = explorerConnectionId === connId;
              const accent = accentForConnection(connId);
              return (
                <button
                  key={connId}
                  onClick={() => setExplorerConnectionId(connId)}
                  className="text-xs px-2 py-0.5 rounded border transition-colors"
                  style={isActive
                    ? {
                        backgroundColor: `${accent}33`,
                        borderColor: `${accent}66`,
                        color: accent,
                      }
                    : {
                        backgroundColor: `${accent}14`,
                        borderColor: 'transparent',
                        color: `${accent}80`,
                      }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        <div className="p-4 border-b border-default font-semibold text-sm text-primary flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Database size={16} className="text-blue-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span>{t("sidebar.explorer")}</span>
              {activeConnectionName && (
                <span className="text-xs font-normal text-muted truncate">{activeConnectionName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Global actions — hidden in multi-database mode (actions move to each database node) and for API-based plugins */}
            {!isMultiDb && activeCapabilities?.no_connection_required !== true && (sidebarWidth < 200 ? (
              <div className="relative">
                <button
                  onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                  className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded"
                  title={t("sidebar.actions")}
                >
                  <ChevronDown size={16} />
                </button>
                {isActionsDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsActionsDropdownOpen(false)}
                    />
                    <div className="absolute left-0 top-8 bg-elevated border border-default rounded-lg shadow-lg z-40 py-1 min-w-[200px]">
                      <button
                        onClick={() => {
                          handleImportDatabase();
                          setIsActionsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                      >
                        <Upload size={16} className="text-green-400 shrink-0" />
                        <span>{t("dump.importDatabase")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setDumpModal({ database: activeDatabaseName ?? "" });
                          setIsActionsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                      >
                        <Download size={16} className="text-blue-400 shrink-0" />
                        <span>{t("dump.dumpDatabase")}</span>
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await dataTransferGateway.invoke("open_er_diagram_window", {
                              connectionId: activeConnectionId || "",
                              connectionName: activeConnectionName || "Unknown",
                              databaseName: diagramDatabaseName,
                              ...(activeSchema ? { schema: activeSchema } : {}),
                            });
                          } catch (e) {
                            console.error("Failed to open ER Diagram window:", e);
                          }
                          setIsActionsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-secondary hover:bg-surface-secondary hover:text-primary transition-colors text-left whitespace-nowrap"
                      >
                        <Network size={16} className="rotate-90 text-orange-400 shrink-0" />
                        <span>View Schema Diagram</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleImportDatabase()}
                  className="text-muted hover:text-green-400 transition-colors p-1 hover:bg-surface-secondary rounded"
                  title={t("dump.importDatabase")}
                >
                  <Upload size={16} />
                </button>
                <button
                  onClick={() => setDumpModal({ database: activeDatabaseName ?? "" })}
                  className="text-muted hover:text-blue-400 transition-colors p-1 hover:bg-surface-secondary rounded"
                  title={t("dump.dumpDatabase")}
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await dataTransferGateway.invoke("open_er_diagram_window", {
                        connectionId: activeConnectionId || "",
                        connectionName: activeConnectionName || "Unknown",
                        databaseName: diagramDatabaseName,
                        ...(activeSchema ? { schema: activeSchema } : {}),
                      });
                    } catch (e) {
                      console.error("Failed to open ER Diagram window:", e);
                    }
                  }}
                  className="text-muted hover:text-orange-400 transition-colors p-1 hover:bg-surface-secondary rounded"
                  title="View Schema Diagram"
                >
                  <Network size={16} className="rotate-90" />
                </button>
              </>
            ))}
            <button
              onClick={onCollapse}
              className="text-muted hover:text-secondary transition-colors p-1 hover:bg-surface-secondary rounded"
              title="Collapse Explorer"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        <ExplorerTabs
          activeTab={sidebarTab}
          counts={{
            favorites: queries.length,
            history: historyEntries.length,
            notebooks: notebookCount,
          }}
          labels={{
            structure: t("sidebar.structure"),
            favorites: t("sidebar.favorites"),
            history: t("sidebar.queryHistory"),
            notebooks: t("sidebar.notebooks.tab"),
          }}
          onChange={setSidebarTab}
        />

        <div ref={sidebarBodyRef} className="flex-1 overflow-y-auto py-2">
          {/* Favorites tab */}
          {sidebarTab === "favorites" && (<div className="animate-fade-in">{(() => {
            const sorted = [...queries].sort((a, b) => {
              if (!a.updated_at && !b.updated_at) return 0;
              if (!a.updated_at) return 1;
              if (!b.updated_at) return -1;
              return b.updated_at.localeCompare(a.updated_at);
            });
            const filteredQueries = favoritesFilter.trim()
              ? sorted.filter((q) => q.name.toLowerCase().includes(favoritesFilter.toLowerCase()) || q.sql.toLowerCase().includes(favoritesFilter.toLowerCase()))
              : sorted;
            const groupedFavorites = groupByDate(filteredQueries, (q) => q.updated_at ?? "1970-01-01", settings.displayTimezone);

            return queries.length === 0 ? (
              <div className="text-center p-4 text-xs text-muted italic">
                {t("sidebar.noSavedQueries")}
              </div>
            ) : (
              <div>
                <div className="px-2 pb-1.5">
                  <div className="relative">
                    <Search
                      size={12}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type="text"
                      value={favoritesFilter}
                      onChange={(e) => setFavoritesFilter(e.target.value)}
                      placeholder={t("sidebar.searchFavorites")}
                      className="w-full pl-6 pr-2 py-1 text-xs bg-surface-secondary border border-default rounded text-primary placeholder:text-muted focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>
                {favoritesFilter.trim() && (
                  <div className="px-3 pb-1 text-[10px] text-muted">
                    {filteredQueries.length} / {queries.length}
                  </div>
                )}
                {groupedFavorites.length === 0 ? (
                  <div className="text-center p-2 text-xs text-muted italic">
                    {t("sidebar.noFavoritesSearchResults")}
                  </div>
                ) : (
                  groupedFavorites.map(([groupKey, items]) => (
                    <div key={groupKey}>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted tracking-wider">
                        {t(`sidebar.${groupKey}`)}
                      </div>
                      {items.map((q) => (
                        <div
                          key={q.id}
                          onClick={() => setSelectedFavoriteId(q.id)}
                          onDoubleClick={() => runSavedQuery(q.sql, q.name, q.database ?? undefined)}
                          onContextMenu={(e) =>
                            handleContextMenu(e, "query", q.id, q.name, q)
                          }
                          className={`pl-3 pr-3 py-1.5 cursor-pointer group transition-colors border-b border-default/30 ${
                            selectedFavoriteId === q.id
                              ? "bg-surface-secondary"
                              : "hover:bg-surface-secondary"
                          }`}
                          title={q.database ? `[${q.database}] ${q.sql}` : q.sql}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[13px] font-semibold text-primary truncate tracking-tight">{q.name}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted shrink-0">
                              {q.database && (
                                <span className="flex items-center gap-0.5">
                                  <Database size={9} className="shrink-0" />
                                  <span className="truncate max-w-[80px]">{q.database}</span>
                                </span>
                              )}
                              {q.updated_at && (
                                <span>{formatHistoryTime(q.updated_at, settings.displayTimezone)}</span>
                              )}
                            </div>
                          </div>
                          <SqlHighlight sql={q.sql} />
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            );
          })()}</div>)}

          {/* History tab */}
          {sidebarTab === "history" && (
            <div className="animate-fade-in"><QueryHistorySection
              entries={historyEntries}
              isLoading={isHistoryLoading}
              recoveryNotice={historyRecoveryNotice}
              onDismissRecoveryNotice={dismissHistoryRecoveryNotice}
              onDoubleClick={(entry) => {
                runSavedQuery(entry.sql, undefined, entry.database ?? undefined);
              }}
              onContextMenu={(e, entry) => {
                handleContextMenu(e, "history", entry.id, entry.sql, entry as unknown as ContextMenuData);
              }}
              onClearAll={() => setHistoryClearConfirm(true)}
            /></div>
          )}

          {/* Notebooks tab — saved notebooks for the active connection */}
          {sidebarTab === "notebooks" && (
            <NotebooksSection
              connectionId={activeConnectionId}
              openNotebookIds={
                new Set(
                  tabs
                    .filter((tb) => tb.notebookId)
                    .map((tb) => tb.notebookId as string),
                )
              }
              onOpen={handleOpenNotebook}
              onRename={handleRenameNotebook}
              onDelete={handleDeleteNotebook}
            />
          )}

          {/* Structure tab */}
          {sidebarTab === "structure" && (
            <ExplorerStructure>
            {(isLoadingTables || isLoadingSchemas) ? (
              <div className="flex items-center justify-center h-20 text-muted gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">{t("sidebar.loadingSchema")}</span>
              </div>
            ) : (
              <>
              {/* Schema fetch failed: surface the error instead of a silently empty tree */}
              {schemaLoadError ? (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <AlertCircle size={18} className="text-red-500" />
                  <span className="text-sm font-medium text-red-500">{t("sidebar.schemaLoadError")}</span>
                  <span className="text-xs text-muted break-words line-clamp-2">{schemaLoadError.split("\n\n")[0]}</span>
                  <button
                    onClick={() => setSchemaErrorExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors"
                  >
                    {schemaErrorExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {t("sidebar.errorDetails")}
                  </button>
                  {schemaErrorExpanded && (
                    <div className="relative w-full">
                      <pre className="text-xs text-muted bg-surface-secondary rounded p-2 pr-8 text-left whitespace-pre-wrap break-words max-h-40 overflow-auto select-text">
                        {schemaLoadError}
                      </pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(schemaLoadError);
                          setSchemaErrorCopied(true);
                          setTimeout(() => setSchemaErrorCopied(false), 1500);
                        }}
                        title={t("sidebar.copyError")}
                        className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-surface-tertiary text-muted hover:text-secondary transition-colors"
                      >
                        {schemaErrorCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => { if (activeConnectionId) connect(activeConnectionId); }}
                    className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-surface-secondary text-secondary hover:bg-surface-tertiary transition-colors"
                  >
                    <RefreshCw size={12} />
                    {t("sidebar.retry")}
                  </button>
                </div>
              ) : /* Schema-capable driver: Schema tree layout */
              activeCapabilities?.schemas === true && !isMultiDb && schemas.length > 0 ? (
                /* Postgres schema layout (unchanged) */
                <div>
                  {needsSchemaSelection ? (
                    /* Schema picker (first connect, no saved preference) */
                    <div className="px-3 py-2">
                      <div className="text-xs font-semibold uppercase text-muted tracking-wider mb-2">
                        {t("sidebar.schemas")}
                      </div>
                      <div className="text-xs text-secondary mb-2">
                        {t("sidebar.selectSchemasHint")}
                      </div>
                      <div className="border border-default rounded-lg overflow-hidden mb-2">
                        <div className="max-h-[200px] overflow-y-auto py-1">
                          {schemas.map((schemaName) => {
                            const isSelected = pendingSchemaSelection.has(schemaName);
                            return (
                              <div
                                key={schemaName}
                                onClick={() => {
                                  toggleSchema(schemaName);
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                                  isSelected
                                    ? "text-primary hover:bg-surface-secondary"
                                    : "text-muted hover:bg-surface-secondary"
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 flex items-center justify-center shrink-0 ${
                                    isSelected ? "text-blue-500" : "text-muted"
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckSquare size={14} />
                                  ) : (
                                    <Square size={14} />
                                  )}
                                </div>
                                <span className="text-sm truncate select-none">
                                  {schemaName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            toggleAllSchemas(schemas);
                          }}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          {pendingSchemaSelection.size === schemas.length
                            ? t("sidebar.deselectAll")
                            : t("sidebar.selectAll")}
                        </button>
                        <button
                          onClick={() => {
                            if (pendingSchemaSelection.size > 0) {
                              void confirmSchemas(setSelectedSchemas);
                              setPendingSchemaSelection([]);
                            }
                          }}
                          disabled={pendingSchemaSelection.size === 0}
                          className={`ml-auto flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                            pendingSchemaSelection.size > 0
                              ? "bg-blue-500 text-white hover:bg-blue-600"
                              : "bg-surface-secondary text-muted cursor-not-allowed"
                          }`}
                        >
                          <Check size={12} />
                          {t("sidebar.confirmSelection")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Schema selection header */}
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-xs font-semibold uppercase text-muted tracking-wider">
                          {t("sidebar.schemas")} ({selectedSchemas.length}/{schemas.length})
                        </span>
                        <div className="relative flex items-center gap-1">
                          {supportsCreateDatabase(activeCapabilities) && (
                            <button
                              onClick={handleCreateDatabase}
                              className="p-1 rounded transition-colors text-muted hover:text-secondary hover:bg-surface-secondary"
                              title={t("sidebar.createDatabase")}
                            >
                              <Database size={14} />
                            </button>
                          )}
                          {supportsCreateSchema(activeCapabilities) && (
                            <button
                              onClick={() => handleCreateSchema()}
                              className="p-1 rounded transition-colors text-muted hover:text-secondary hover:bg-surface-secondary"
                              title={t("sidebar.createSchema")}
                            >
                              <Plus size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPendingSchemaSelection(selectedSchemas);
                              setIsSchemaFilterOpen(!isSchemaFilterOpen);
                            }}
                            className={`p-1 rounded transition-colors mr-1.5 ${
                              selectedSchemas.length < schemas.length
                                ? "text-blue-400 hover:text-blue-300 bg-blue-500/10"
                                : "text-muted hover:text-secondary hover:bg-surface-secondary"
                            }`}
                            title={t("sidebar.editSchemas")}
                          >
                            <Settings2 size={14} />
                          </button>
                          {isSchemaFilterOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsSchemaFilterOpen(false)}
                              />
                              <div className="absolute right-0 top-8 bg-elevated border border-default rounded-lg shadow-lg z-40 py-2 min-w-[200px] max-h-[300px] flex flex-col">
                                <div className="flex items-center justify-between px-3 pb-2 border-b border-default">
                                  <span className="text-xs font-semibold text-secondary">
                                    {t("sidebar.editSchemas")}
                                  </span>
                                  <button
                                    onClick={() => {
                                        toggleAllSchemas(schemas);
                                    }}
                                    className="text-xs text-blue-500 hover:underline"
                                  >
                                    {pendingSchemaSelection.size === schemas.length
                                      ? t("sidebar.deselectAll")
                                      : t("sidebar.selectAll")}
                                  </button>
                                </div>
                                <div className="overflow-y-auto py-1">
                                  {schemas.map((schemaName) => {
                                    const isSelected = pendingSchemaSelection.has(schemaName);
                                    return (
                                      <div
                          key={`${activeConnectionId}:${schemaName}`}
                                        onClick={() => {
                                          toggleSchema(schemaName);
                                        }}
                                        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                                          isSelected
                                            ? "text-primary hover:bg-surface-secondary"
                                            : "text-muted hover:bg-surface-secondary"
                                        }`}
                                      >
                                        <div
                                          className={`w-4 h-4 flex items-center justify-center shrink-0 ${
                                            isSelected ? "text-blue-500" : "text-muted"
                                          }`}
                                        >
                                          {isSelected ? (
                                            <CheckSquare size={14} />
                                          ) : (
                                            <Square size={14} />
                                          )}
                                        </div>
                                        <span className="text-sm truncate select-none">
                                          {schemaName}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="px-3 pt-2 border-t border-default">
                                  <button
                                    onClick={() => {
                                      if (pendingSchemaSelection.size > 0) {
                                        void confirmSchemas(setSelectedSchemas);
                                      }
                                      setIsSchemaFilterOpen(false);
                                    }}
                                    disabled={pendingSchemaSelection.size === 0}
                                    className={`w-full flex items-center justify-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                      pendingSchemaSelection.size > 0
                                        ? "bg-blue-500 text-white hover:bg-blue-600"
                                        : "bg-surface-secondary text-muted cursor-not-allowed"
                                    }`}
                                  >
                                    <Check size={12} />
                                    {t("sidebar.confirmSelection")}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {selectedSchemas.map((schemaName) => (
                        <SidebarSchemaItem
                          key={schemaName}
                          schemaName={schemaName}
                          schemaData={schemaDataMap[schemaName]}
                          activeTable={activeTable}
                          activeSchema={activeSchema}
                          connectionId={activeConnectionId!}
                          driver={activeDriver!}
                          schemaVersion={schemaVersion}
                          onLoadSchema={loadSchemaData}
                          onRefreshSchema={refreshSchemaData}
                          onActivateSchema={(schema) => setActiveSchema(schema)}
                          onTableClick={(name, schema) => handleTableClick(name, schema)}
                          onTableDoubleClick={(name, schema) => handleOpenTable(name, schema)}
                          onViewClick={handleViewClick}
                          onViewDoubleClick={(name, schema, materialized) =>
                            handleOpenView(name, schema, materialized)
                          }
                          onRoutineDoubleClick={(routine, schema) => handleRoutineDoubleClick(routine, schema)}
                          onTriggerDoubleClick={(trigger, schema) => handleTriggerDoubleClick(trigger, schema)}
                          onContextMenu={handleContextMenu}
                           onAddColumn={(t_name) =>
                             setModifyColumnModal({ isOpen: true, tableName: t_name, schema: schemaName, column: null })
                           }
                           onEditColumn={(t_name, c) =>
                             setModifyColumnModal({ isOpen: true, tableName: t_name, schema: schemaName, column: c })
                           }
                           onAddIndex={(t_name) =>
                             setCreateIndexModal({ isOpen: true, tableName: t_name, schema: schemaName })
                           }
                          onDropIndex={async (t_name, name) => {
                            if (
                              await ask(
                                t("sidebar.deleteIndexConfirm", { name }),
                                { title: t("sidebar.deleteIndex"), kind: "warning" },
                              )
                            ) {
                              try {
                                await dataTransferGateway.invoke("drop_index_action", {
                                  connectionId: activeConnectionId,
                                  table: t_name,
                                  indexName: name,
                                  ...(schemaName ? { schema: schemaName } : {}),
                                });
                                setSchemaVersion((v) => v + 1);
                              } catch (e) {
                                showAlert(t("sidebar.failDeleteIndex") + toErrorMessage(e), { title: t("common.error"), kind: "error" });
                              }
                            }
                          }}
                           onAddForeignKey={(t_name) =>
                             setCreateForeignKeyModal({ isOpen: true, tableName: t_name, schema: schemaName })
                           }
                          onDropForeignKey={async (t_name, name) => {
                            if (
                              await ask(
                                t("sidebar.deleteFkConfirm", { name }),
                                { title: t("sidebar.deleteFk"), kind: "warning" },
                              )
                            ) {
                              try {
                                await dataTransferGateway.invoke("drop_foreign_key_action", {
                                  connectionId: activeConnectionId,
                                  table: t_name,
                                  fkName: name,
                                  ...(schemaName ? { schema: schemaName } : {}),
                                });
                                setSchemaVersion((v) => v + 1);
                              } catch (e) {
                                showAlert(toErrorMessage(e), { title: t("common.error"), kind: "error" });
                              }
                            }
                          }}
                          onCreateTable={() => openCreateTableModal({ kind: "schema", database: null, schema: schemaName })}
                          onCreateView={(schema) =>
                            setViewEditorModal({ isOpen: true, schema, isNewView: true })
                          }
                          onCreateTrigger={(schema) =>
                            setTriggerEditorModal({ isOpen: true, schema, isNewTrigger: true })
                          }
                          showTriggers={activeCapabilities?.triggers === true}
                          refreshingMatView={refreshingMatView}
                        />
                      ))}
                    </>
                  )}
                </div>
              ) : isMultiDatabaseCapable(activeCapabilities) && selectedDatabases.length > 1 ? (
                /* Multi-database MySQL layout */
                <div>
                  {/* Database header: label + manage button */}
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-semibold uppercase text-muted tracking-wider">
                      {t("sidebar.databases")} ({selectedDatabases.length})
                    </span>
                    <div className="relative flex items-center gap-1">
                      {supportsCreateDatabase(activeCapabilities) && (
                        <button
                          onClick={handleCreateDatabase}
                          className="p-1 rounded transition-colors text-muted hover:text-secondary hover:bg-surface-secondary"
                          title={t("sidebar.createDatabase")}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!isDbManagerOpen) {
                            setPendingDbSelection(selectedDatabases);
                            setIsLoadingAllDbs(true);
                            try {
                              await refreshAvailableDatabases();
                            } finally {
                              setIsLoadingAllDbs(false);
                            }
                          }
                          setIsDbManagerOpen(!isDbManagerOpen);
                        }}
                        className={`p-1 rounded transition-colors ${
                          selectedDatabases.length < allAvailableDatabases.length && allAvailableDatabases.length > 0
                            ? "text-blue-400 hover:text-blue-300 bg-blue-500/10"
                            : "text-muted hover:text-secondary hover:bg-surface-secondary"
                        }`}
                        title={t("sidebar.manageDatabases")}
                      >
                        <Settings2 size={14} />
                      </button>
                      {isDbManagerOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsDbManagerOpen(false)}
                          />
                          <div className="absolute right-0 top-8 bg-elevated border border-default rounded-lg shadow-lg z-40 py-2 min-w-[200px] max-h-[320px] flex flex-col">
                            <div className="flex items-center justify-between px-3 pb-2 border-b border-default">
                              <span className="text-xs font-semibold text-secondary">
                                {t("sidebar.manageDatabases")}
                              </span>
                              <button
                                onClick={() => {
                                  toggleAllDatabases(allAvailableDatabases);
                                }}
                                className="text-xs text-blue-500 hover:underline"
                              >
                                {pendingDbSelection.size === allAvailableDatabases.length
                                  ? t("sidebar.deselectAll")
                                  : t("sidebar.selectAll")}
                              </button>
                            </div>
                            <div className="overflow-y-auto py-1 flex-1">
                              {isLoadingAllDbs ? (
                                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                                  <Loader2 size={12} className="animate-spin" />
                                  {t("sidebar.loadingSchema")}
                                </div>
                              ) : allAvailableDatabases.map((dbName) => {
                                const isSelected = pendingDbSelection.has(dbName);
                                return (
                                  <div
                      key={`${activeConnectionId}:${dbName}`}
                                    onClick={() => {
                                      toggleDatabase(dbName);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                                      isSelected ? "text-primary hover:bg-surface-secondary" : "text-muted hover:bg-surface-secondary"
                                    }`}
                                  >
                                    <div className={`w-4 h-4 flex items-center justify-center shrink-0 ${isSelected ? "text-blue-500" : "text-muted"}`}>
                                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </div>
                                    <span className="text-sm truncate select-none">{dbName}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="px-3 pt-2 border-t border-default">
                              <button
                                onClick={() => {
                                  if (pendingDbSelection.size > 0) {
                                    void confirmDatabases(setSelectedDatabases);
                                  }
                                  setIsDbManagerOpen(false);
                                }}
                                disabled={pendingDbSelection.size === 0}
                                className={`w-full flex items-center justify-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                  pendingDbSelection.size > 0
                                    ? "bg-blue-500 text-white hover:bg-blue-600"
                                    : "bg-surface-secondary text-muted cursor-not-allowed"
                                }`}
                              >
                                <Check size={12} />
                                {t("sidebar.confirmSelection")}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Database filter input */}
                  <div className="px-3 pb-1.5">
                    <div className="relative flex items-center">
                      <Search size={11} className="absolute left-2 text-muted pointer-events-none" />
                      <input
                        type="text"
                        value={dbFilter}
                        onChange={(e) => setDbFilter(e.target.value)}
                        placeholder={t("sidebar.filterDatabases")}
                        className="w-full bg-surface-secondary text-xs text-secondary placeholder:text-muted rounded pl-6 pr-6 py-1 border border-default focus:outline-none focus:border-blue-500/50"
                      />
                      {dbFilter && (
                        <button
                          onClick={() => setDbFilter("")}
                          className="absolute right-1.5 text-muted hover:text-primary"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {(dbFilter
                    ? selectedDatabases.filter((db) => db.toLowerCase().includes(dbFilter.toLowerCase()))
                    : selectedDatabases
                  ).map((dbName) => (
                    <SidebarDatabaseItem
                      key={dbName}
                      databaseName={dbName}
                      databaseData={databaseDataMap[dbName]}
                      activeTable={activeTable}
                      activeDatabase={activeDatabase}
                      activeSchema={activeSchema}
                      connectionId={activeConnectionId!}
                      driver={activeDriver!}
                      schemaVersion={schemaVersion}
                      onLoadDatabase={(database, activate) => {
                        void loadDatabaseData(database, activeConnectionId!, activate);
                      }}
                      onRefreshDatabase={refreshDatabaseData}
                      onLoadDatabaseSchema={loadDatabaseSchemaData}
                      onRefreshDatabaseSchema={refreshDatabaseSchemaData}
                      onActivateDatabase={(db) => setActiveDatabaseContext(db)}
                      onActivateDatabaseSchema={(db, schema) => setActiveSchema(schema, db)}
                      onTableClick={(name, db, schema) => schema ? handleTableContext(name, db, schema) : setActiveTableContext(name, undefined, null)}
                      onTableDoubleClick={(name, db, schema) => schema ? handleOpenDatabaseSchemaTable(name, db, schema) : handleOpenDatabaseTable(name, db)}
                      onViewClick={handleViewClick}
                      onViewDoubleClick={(name, db, schema, materialized) => schema ? handleOpenDatabaseSchemaView(name, db, schema, materialized) : handleOpenDatabaseView(name, db)}
                      onRoutineDoubleClick={(routine, db, schema) => handleRoutineDoubleClick(routine, schema, db)}
                      onTriggerDoubleClick={(trigger, db, schema) => handleTriggerDoubleClick(trigger, schema, db)}
                      onContextMenu={handleContextMenu}
                      onAddColumn={(t_name, database, schema) =>
                        setModifyColumnModal({ isOpen: true, tableName: t_name, database, schema, column: null })
                      }
                      onEditColumn={(t_name, c, database, schema) =>
                        setModifyColumnModal({ isOpen: true, tableName: t_name, database, schema, column: c })
                      }
                      onAddIndex={(t_name, database, schema) =>
                        setCreateIndexModal({ isOpen: true, tableName: t_name, database, schema })
                      }
                      onDropIndex={async (t_name, name, database, schema) => {
                        if (
                          await ask(
                            t("sidebar.deleteIndexConfirm", { name }),
                            { title: t("sidebar.deleteIndex"), kind: "warning" },
                          )
                        ) {
                          try {
                            await dataTransferGateway.invoke("drop_index_action", {
                              connectionId: activeConnectionId,
                              table: t_name,
                              indexName: name,
                              ...(database ? { database } : { database: dbName }),
                              ...(schema ? { schema } : {}),
                            });
                            setSchemaVersion((v) => v + 1);
                          } catch (e) {
                            showAlert(t("sidebar.failDeleteIndex") + toErrorMessage(e), { title: t("common.error"), kind: "error" });
                          }
                        }
                      }}
                      onAddForeignKey={(t_name, database, schema) =>
                        setCreateForeignKeyModal({ isOpen: true, tableName: t_name, database, schema })
                      }
                      onDropForeignKey={async (t_name, name, database, schema) => {
                        if (
                          await ask(
                            t("sidebar.deleteFkConfirm", { name }),
                            { title: t("sidebar.deleteFk"), kind: "warning" },
                          )
                        ) {
                          try {
                            await dataTransferGateway.invoke("drop_foreign_key_action", {
                              connectionId: activeConnectionId,
                              table: t_name,
                              fkName: name,
                              ...(database ? { database } : { database: dbName }),
                              ...(schema ? { schema } : {}),
                            });
                            setSchemaVersion((v) => v + 1);
                          } catch (e) {
                            showAlert(toErrorMessage(e), { title: t("common.error"), kind: "error" });
                          }
                        }
                      }}
                      capabilities={activeCapabilities}
                      onCreateTable={(database, schema) =>
                        schema
                          ? openCreateTableModal({
                              kind: "database-schema",
                              database,
                              schema,
                            })
                          : openCreateTableModal({ kind: "database", database, schema: null })
                      }
                      onCreateView={(database, schema) =>
                        setViewEditorModal({ isOpen: true, database, schema, isNewView: true })
                      }
                      onCreateTrigger={(database, schema) =>
                        setTriggerEditorModal({ isOpen: true, database, schema, isNewTrigger: true })
                      }
                      onCreateSchema={activeCapabilities?.schemas === true && supportsCreateSchema(activeCapabilities) ? (database) => handleCreateSchema(database) : undefined}
                      onDump={activeCapabilities?.no_connection_required !== true ? (db) => setDumpModal({ database: db }) : undefined}
                      onImport={activeCapabilities?.no_connection_required !== true ? (db) => handleImportDatabase(db) : undefined}
                      onViewDiagram={activeCapabilities?.no_connection_required !== true ? async (db) => {
                        try {
                          await dataTransferGateway.invoke("open_er_diagram_window", {
                            connectionId: activeConnectionId || "",
                            connectionName: activeConnectionName || "Unknown",
                            databaseName: db,
                          });
                        } catch (e) {
                          console.error("Failed to open ER Diagram window:", e);
                        }
                      } : undefined}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* MySQL/SQLite: Flat layout */}
                  {(() => {
                    const dbLabel = isMultiDatabaseCapable(activeCapabilities) && selectedDatabases.length === 1
                      ? selectedDatabases[0]
                      : activeDatabaseName;
                    return dbLabel ? (
                      <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 border-b border-default">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Database size={14} className="text-blue-400 shrink-0" />
                          <span className="text-sm font-medium text-secondary truncate">
                            {dbLabel}
                          </span>
                        </div>
                        {supportsCreateDatabase(activeCapabilities) && (
                          <button
                            onClick={handleCreateDatabase}
                            className="p-1 rounded transition-colors text-muted hover:text-secondary hover:bg-surface-secondary shrink-0"
                            title={t("sidebar.createDatabase")}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-[10px] text-muted opacity-80 uppercase tracking-wider">
                      {t("sidebar.objectSummary")}
                    </span>
                    <span className="text-[10px] text-muted opacity-60">
                      {formatObjectCount(tables.length, views.length, routines.length, triggers.length)}
                    </span>
                  </div>

                  {/* Tables */}
                  <Accordion
                    title={`${t("sidebar.tables")} (${tables.length})`}
                    isOpen={tablesOpen}
                    onToggle={() => setTablesOpen(!tablesOpen)}
                    actions={
                      <div className="flex items-center gap-1 mr-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (refreshTables) refreshTables();
                          }}
                          className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                          title={t("sidebar.refreshTables") || "Refresh Tables"}
                        >
                          <RefreshCw size={14} />
                        </button>
                        {supportsManageTables(activeCapabilities) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateTableModal({ kind: "connection", database: null, schema: null });
                          }}
                          className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                          title="Create New Table"
                        >
                          <Plus size={14} />
                        </button>
                        )}
                      </div>
                    }
                  >
                    {tables.length > 0 && (
                      <div className="px-2 py-1">
                        <div className="relative flex items-center">
                          <Search size={11} className="absolute left-2 text-muted pointer-events-none" />
                          <input
                            type="text"
                            data-table-filter
                            value={tableFilter}
                            onChange={(e) => setTableFilter(e.target.value)}
                            placeholder={t("sidebar.filterTables")}
                            className="w-full bg-surface-secondary text-xs text-secondary placeholder:text-muted rounded pl-6 pr-10 py-1 border border-default focus:outline-none focus:border-blue-500/50"
                          />
                          {tableFilter && (
                            <button
                              onClick={() => setTableFilter("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary p-0.5 rounded hover:bg-surface-secondary"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {(() => {
                      const filtered = fuzzyFilter(tables, tableFilter, (tbl) => tbl.name);
                      return filtered.length === 0 ? (
                        <div className="text-center p-2 text-xs text-muted italic">
                          {tableFilter ? t("sidebar.noTablesMatch") : t("sidebar.noTables")}
                        </div>
                      ) : (
                        <div>
                          {filtered.map((table) => (
                            <SidebarTableItem
                              key={table.name}
                              table={table}
                              activeTable={activeTable}
                              onTableClick={handleTableClick}
                              onTableDoubleClick={handleOpenTable}
                              onContextMenu={handleContextMenu}
                              connectionId={activeConnectionId!}
                              driver={activeDriver!}
                              canManage={supportsManageTables(activeCapabilities)}
                              onAddColumn={(t_name) =>
                                setModifyColumnModal({ isOpen: true, tableName: t_name, column: null })
                              }
                              onEditColumn={(t_name, c) =>
                                setModifyColumnModal({ isOpen: true, tableName: t_name, column: c })
                              }
                              onAddIndex={(t_name) =>
                                setCreateIndexModal({ isOpen: true, tableName: t_name })
                              }
                      onDropIndex={async (t_name, name) => {
                                if (
                                  await ask(
                                    t("sidebar.deleteIndexConfirm", { name }),
                                    { title: t("sidebar.deleteIndex"), kind: "warning" },
                                  )
                                ) {
                                  try {
                                    await dataTransferGateway.invoke("drop_index_action", {
                                      connectionId: activeConnectionId,
                                      table: t_name,
                                      indexName: name,
                                    });
                                    setSchemaVersion((v) => v + 1);
                                  } catch (e) {
                                    showAlert(t("sidebar.failDeleteIndex") + toErrorMessage(e), { title: t("common.error"), kind: "error" });
                                  }
                                }
                              }}
                              onAddForeignKey={(t_name) =>
                                setCreateForeignKeyModal({ isOpen: true, tableName: t_name })
                              }
                              onDropForeignKey={async (t_name, name) => {
                                if (
                                  await ask(
                                    t("sidebar.deleteFkConfirm", { name }),
                                    { title: t("sidebar.deleteFk"), kind: "warning" },
                                  )
                                ) {
                                  try {
                                    await dataTransferGateway.invoke("drop_foreign_key_action", {
                                      connectionId: activeConnectionId,
                                      table: t_name,
                                      fkName: name,
                                    });
                                    setSchemaVersion((v) => v + 1);
                                  } catch (e) {
                                    showAlert(toErrorMessage(e), { title: t("common.error"), kind: "error" });
                                  }
                                }
                              }}
                              schemaVersion={schemaVersion}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </Accordion>

                  {/* Views */}
                  {activeCapabilities?.views !== false && (
                  <Accordion
                    title={`${t("sidebar.views")} (${views.length})`}
                    isOpen={viewsOpen}
                    onToggle={() => setViewsOpen(!viewsOpen)}
                    actions={
                      <div className="flex items-center gap-1 mr-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (refreshViews) refreshViews();
                          }}
                          className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                          title={t("sidebar.refreshViews") || "Refresh Views"}
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewEditorModal({ isOpen: true, isNewView: true });
                          }}
                          className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                          title={t("sidebar.createView") || "Create New View"}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    }
                  >
                    {views.length === 0 ? (
                      <div className="text-center p-2 text-xs text-muted italic">
                        {t("sidebar.noViews")}
                      </div>
                    ) : (
                      <div>
                        {views.map((view) => (
                          <SidebarViewItem
                            key={view.name}
                            view={view}
                            activeView={activeView}
                            onViewClick={handleViewClick}
                            onViewDoubleClick={handleOpenView}
                            onContextMenu={handleContextMenu}
                            connectionId={activeConnectionId!}
                            driver={activeDriver!}
                          />
                        ))}
                      </div>
                    )}
                  </Accordion>
                  )}

                  {/* Triggers (flat layout) */}
                  {activeCapabilities?.triggers === true && (
                    <Accordion
                      title={`${t("sidebar.triggers")} (${triggers.length})`}
                      isOpen={triggersOpenFlat}
                      onToggle={() => setTriggersOpenFlat(!triggersOpenFlat)}
                      actions={
                        <div className="flex items-center gap-1 mr-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (refreshTriggers) refreshTriggers();
                            }}
                            className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                            title={t("sidebar.refreshTriggers") || "Refresh Triggers"}
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTriggerEditorModal({ isOpen: true, isNewTrigger: true });
                            }}
                            className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                            title={t("sidebar.createTrigger") || "Create New Trigger"}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      }
                    >
                      {triggers.length > 0 && (
                        <div className="px-2 py-1">
                          <div className="relative flex items-center">
                            <Search size={11} className="absolute left-2 text-muted pointer-events-none" />
                            <input
                              type="text"
                              value={triggerFilterFlat}
                              onChange={(e) => setTriggerFilterFlat(e.target.value)}
                              placeholder={t("sidebar.filterTriggers")}
                              className="w-full bg-surface-secondary text-xs text-secondary placeholder:text-muted rounded pl-6 pr-6 py-1 border border-default focus:outline-none focus:border-blue-500/50"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {triggerFilterFlat && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setTriggerFilterFlat(""); }}
                                className="absolute right-1.5 text-muted hover:text-primary"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const filtered = fuzzyFilter(triggers, triggerFilterFlat, (tr) => tr.name);
                        return filtered.length === 0 ? (
                          <div className="text-center p-2 text-xs text-muted italic">
                            {triggerFilterFlat ? t("sidebar.noTriggersMatch") : t("sidebar.noTriggers")}
                          </div>
                        ) : (
                          <div>
                            {filtered.map((trigger) => (
                              <SidebarTriggerItem
                                key={trigger.name}
                                trigger={trigger}
                                connectionId={activeConnectionId!}
                                onContextMenu={handleContextMenu}
                                onDoubleClick={handleTriggerDoubleClick}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </Accordion>
                  )}

                  {/* Routines */}
                  {activeCapabilities?.routines === true && (
                    <Accordion
                      title={`${t("sidebar.routines")} (${routines.length})`}
                      isOpen={routinesOpen}
                      onToggle={() => setRoutinesOpen(!routinesOpen)}
                      actions={
                        <div className="flex items-center gap-1 mr-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (refreshRoutines) refreshRoutines();
                            }}
                            className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                            title={t("sidebar.refreshRoutines") || "Refresh Routines"}
                          >
                            <RefreshCw size={14} />
                          </button>
                          {activeCapabilities?.routine_management === true && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContextMenu(e, "routines-new", "routines-new", t("routines.newRoutine"));
                              }}
                              className="p-1 rounded hover:bg-surface-secondary text-muted hover:text-primary transition-colors"
                              title={t("routines.newRoutine")}
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      }
                    >
                      {routines.length === 0 ? (
                        <div className="text-center p-2 text-xs text-muted italic">
                          {t("sidebar.noRoutines")}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {/* Functions */}
                          {groupedRoutines.functions.length > 0 && (
                            <div className="mb-2">
                              <SidebarRoutineGroupHeader
                                label={t("sidebar.functions")}
                                count={groupedRoutines.functions.length}
                                isOpen={functionsOpen}
                                onToggle={() => setFunctionsOpen(!functionsOpen)}
                              />
                              {functionsOpen && groupedRoutines.functions.map((routine) => (
                                <SidebarRoutineItem
                                  key={routine.name}
                                  routine={routine}
                                  connectionId={activeConnectionId!}
                                  onContextMenu={handleContextMenu}
                                  onDoubleClick={handleRoutineDoubleClick}
                                />
                              ))}
                            </div>
                          )}

                          {/* Procedures */}
                          {groupedRoutines.procedures.length > 0 && (
                            <div>
                              <SidebarRoutineGroupHeader
                                label={t("sidebar.procedures")}
                                count={groupedRoutines.procedures.length}
                                isOpen={proceduresOpen}
                                onToggle={() => setProceduresOpen(!proceduresOpen)}
                              />
                              {proceduresOpen && groupedRoutines.procedures.map((routine) => (
                                <SidebarRoutineItem
                                  key={routine.name}
                                  routine={routine}
                                  connectionId={activeConnectionId!}
                                  onContextMenu={handleContextMenu}
                                  onDoubleClick={handleRoutineDoubleClick}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Accordion>
                  )}
                </>
              )}
            </>
            )}
            </ExplorerStructure>
          )}
        </div>
      </aside>

      <ExplorerModals>
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          boundaryRight={64 + sidebarWidth}
          onClose={closeContextMenu}
          items={
            contextMenu.type === "table"
              ? (() => {
                  const ctxDatabase = contextMenu.data && "database" in contextMenu.data
                    ? contextMenu.data.database ?? undefined
                    : undefined;
                  const ctxSchema = contextMenu.data && "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                  const tableName = contextMenu.data && "tableName" in contextMenu.data ? contextMenu.data.tableName : contextMenu.id;
                  return [
                    {
                      label: t("sidebar.showData"),
                      icon: PlaySquare,
                      action: () => {
                        const quotedTable = quoteTableRef(tableName, activeDriver, ctxSchema);
                        setActiveTableContext(tableName, ctxDatabase ?? null, ctxSchema ?? null);
                        runQuery(`SELECT * FROM ${quotedTable}`, undefined, tableName, false, ctxSchema, undefined, ctxDatabase);
                      },
                    },
                    {
                      label: t("sidebar.newConsole"),
                      icon: FileCode,
                      action: () => {
                        const spec = newConsoleForTable(contextMenu.id, activeDriver, ctxSchema);
                        runQuery(spec.sql, spec.title, undefined, true, spec.schema, undefined, ctxDatabase);
                      },
                    },
                    {
                      label: t("sidebar.countRows"),
                      icon: Hash,
                      action: () => {
                        const quotedTable = quoteTableRef(contextMenu.id, activeDriver, ctxSchema);
                            runQuery(`SELECT COUNT(*) as count FROM ${quotedTable}`, undefined, undefined, false, ctxSchema, undefined, ctxDatabase);
                      },
                    },
                    {
                      label: t("sidebar.viewSchema"),
                      icon: FileText,
                      action: () => setSchemaModal({ tableName: contextMenu.id, database: ctxDatabase, schema: ctxSchema }),
                    },
                    activeCapabilities?.no_connection_required !== true ? {
                      label: t("sidebar.viewERDiagram"),
                      icon: Network,
                      action: async () => {
                        try {
                          await dataTransferGateway.invoke("open_er_diagram_window", {
                            connectionId: activeConnectionId || "",
                            connectionName: activeConnectionName || "Unknown",
                            databaseName: ctxDatabase ?? diagramDatabaseName,
                            focusTable: contextMenu.id,
                            ...(ctxSchema ? { schema: ctxSchema } : {}),
                          });
                        } catch (e) {
                          console.error("Failed to open ER Diagram window:", e);
                        }
                      },
                    } : null,
                    supportsManageTables(activeCapabilities) ? {
                      label: t("sidebar.generateSQL"),
                      icon: FileCode,
                      action: () => setGenerateSQLModal({
                        tableName: contextMenu.id,
                        database: ctxDatabase,
                        schema: ctxSchema,
                      }),
                    } : null,
                    supportsManageTables(activeCapabilities) ? {
                      label: t("clipboardImport.contextMenuLabel"),
                      icon: Clipboard,
                      action: () => setIsClipboardImportOpen(true),
                    } : null,
                    {
                      label: t("sidebar.copyName"),
                      icon: Copy,
                      action: () => navigator.clipboard.writeText(contextMenu.id),
                    },
                    supportsManageTables(activeCapabilities) ? {
                      label: t("sidebar.addColumn"),
                      icon: Plus,
                      action: () =>
                        setModifyColumnModal({
                          isOpen: true,
                          tableName: contextMenu.id,
                          database: ctxDatabase,
                          schema: ctxSchema,
                          column: null,
                        }),
                    } : null,
                    supportsTruncateTable(activeCapabilities) ? {
                      label: t("sidebar.truncateTable"),
                      icon: RotateCcw,
                      danger: true,
                      action: () => setTableTruncateConfirm({
                        tableName: contextMenu.id,
                        database: ctxDatabase,
                        schema: ctxSchema,
                      }),
                    } : null,
                    supportsManageTables(activeCapabilities) ? {
                      label: t("sidebar.deleteTable"),
                      icon: Trash2,
                      danger: true,
                      action: async () => {
                        if (
                          await ask(
                            t("sidebar.deleteTableConfirm", { table: contextMenu.id }),
                            { title: t("sidebar.deleteTable"), kind: "warning" },
                          )
                        ) {
                          try {
                            await dataTransferGateway.invoke("drop_table", {
                              connectionId: activeConnectionId,
                              table: tableName,
                              ...(ctxDatabase ? { database: ctxDatabase } : {}),
                              ...(ctxSchema ? { schema: ctxSchema } : {}),
                            });
                            if (ctxDatabase) {
                              if (ctxSchema) {
                                await refreshDatabaseSchemaData(ctxDatabase, ctxSchema);
                              } else {
                                await refreshDatabaseData(ctxDatabase);
                              }
                            } else if (ctxSchema) {
                              await refreshSchemaData(ctxSchema);
                            } else if (refreshTables) {
                              await refreshTables();
                            }
                          } catch (e) {
                            console.error(e);
                            showAlert(t("sidebar.failDeleteTable") + toErrorMessage(e), { kind: "error" });
                          }
                        }
                      },
                    } : null,
                  ].filter(Boolean) as ContextMenuItem[];
                })()
              : contextMenu.type === "index"
                ? [
                    {
                      label: t("sidebar.copyName"),
                      icon: Copy,
                      action: () => navigator.clipboard.writeText(contextMenu.id),
                    },
                    supportsManageTables(activeCapabilities) ? {
                      label: t("sidebar.deleteIndex"),
                      icon: Trash2,
                      danger: true,
                      action: async () => {
                        if (contextMenu.data && "tableName" in contextMenu.data) {
                          const t_name = contextMenu.data.tableName;
                          const ctxDatabase = "database" in contextMenu.data ? contextMenu.data.database : undefined;
                          const ctxSchema = "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                          if (
                            await ask(
                              t("sidebar.deleteIndexConfirm", { name: contextMenu.id }),
                              { title: t("sidebar.deleteIndex"), kind: "warning" },
                            )
                          ) {
                            try {
                              await dataTransferGateway.invoke("drop_index_action", {
                                connectionId: activeConnectionId,
                                table: t_name,
                                indexName: contextMenu.id,
                                ...(ctxDatabase ? { database: ctxDatabase } : {}),
                                ...(ctxSchema ? { schema: ctxSchema } : {}),
                              });
                              setSchemaVersion((v) => v + 1);
                            } catch (e) {
                              showAlert(
                                t("sidebar.failDeleteIndex") + String(e),
                                { title: t("common.error"), kind: "error" },
                              );
                            }
                          }
                        }
                      },
                    } : null,
                  ].filter(Boolean) as ContextMenuItem[]
                  : contextMenu.type === "foreign_key"
                  ? (() => {
                      const ctxDatabase = contextMenu.data && "database" in contextMenu.data
                        ? contextMenu.data.database ?? undefined
                        : undefined;
                      const ctxSchema = contextMenu.data && "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                      return [
                        {
                          label: t("sidebar.copyName"),
                          icon: Copy,
                          action: () => navigator.clipboard.writeText(contextMenu.id),
                        },
                        supportsManageTables(activeCapabilities) ? {
                          label: t("sidebar.deleteFk"),
                          icon: Trash2,
                          danger: true,
                          action: async () => {
                            if (contextMenu.data && "tableName" in contextMenu.data) {
                              const t_name = contextMenu.data.tableName;
                              if (
                                await ask(
                                  t("sidebar.deleteFkConfirm", { name: contextMenu.id }),
                                  { title: t("sidebar.deleteFk"), kind: "warning" },
                                )
                              ) {
                                try {
                                  await dataTransferGateway.invoke("drop_foreign_key_action", {
                                    connectionId: activeConnectionId,
                                    table: t_name,
                                    fkName: contextMenu.id,
                                    ...(ctxDatabase ? { database: ctxDatabase } : {}),
                                    ...(ctxSchema ? { schema: ctxSchema } : {}),
                                  });
                                  setSchemaVersion((v) => v + 1);
                                } catch (e) {
                                  showAlert(String(e), { kind: "error" });
                                }
                              }
                            }
                          },
                        } : null,
                      ].filter(Boolean) as ContextMenuItem[];
                    })()
                  : contextMenu.type === "folder_indexes"
                    ? supportsManageTables(activeCapabilities)
                      ? [
                          {
                            label: t("sidebar.addIndex"),
                            icon: Plus,
                            action: () => {
                              if (contextMenu.data && "tableName" in contextMenu.data) {
                                setCreateIndexModal({
                                  isOpen: true,
                                  tableName: contextMenu.data.tableName,
                                  database: "database" in contextMenu.data ? contextMenu.data.database : undefined,
                                  schema: "schema" in contextMenu.data ? contextMenu.data.schema : undefined,
                                });
                              }
                            },
                          },
                        ]
                      : []
                    : contextMenu.type === "folder_fks"
                      ? supportsManageTables(activeCapabilities)
                        ? [
                            {
                              label: t("sidebar.addFk"),
                              icon: Plus,
                              action: () => {
                                if (contextMenu.data && "tableName" in contextMenu.data) {
                                  setCreateForeignKeyModal({
                                    isOpen: true,
                                    tableName: contextMenu.data.tableName,
                                    database: "database" in contextMenu.data ? contextMenu.data.database : undefined,
                                    schema: "schema" in contextMenu.data ? contextMenu.data.schema : undefined,
                                  });
                                }
                              },
                            },
                          ]
                        : []
                      : contextMenu.type === "view"
                        ? (() => {
                            const viewCtxDatabase = contextMenu.data && "database" in contextMenu.data
                              ? contextMenu.data.database ?? undefined
                              : undefined;
                            const viewCtxSchema = contextMenu.data && "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                            return [
                              {
                                label: t("sidebar.showData"),
                                icon: PlaySquare,
                                action: () => {
                                  const quotedView = quoteTableRef(contextMenu.id, activeDriver, viewCtxSchema);
                                  runQuery(`SELECT * FROM ${quotedView}`, undefined, contextMenu.id, false, viewCtxSchema, undefined, viewCtxDatabase);
                                },
                              },
                              {
                                label: t("sidebar.countRows"),
                                icon: Hash,
                                action: () => {
                                  const quotedView = quoteTableRef(contextMenu.id, activeDriver, viewCtxSchema);
                                  runQuery(`SELECT COUNT(*) as count FROM ${quotedView}`, undefined, undefined, false, viewCtxSchema, undefined, viewCtxDatabase);
                                },
                              },
                              {
                                label: t("sidebar.editView"),
                                icon: Edit,
                                action: () => {
                                  setViewEditorModal({
                                    isOpen: true,
                                    viewName: contextMenu.id,
                                    database: viewCtxDatabase,
                                    schema: viewCtxSchema,
                                    isNewView: false,
                                  });
                                },
                              },
                              {
                                label: t("sidebar.copyName"),
                                icon: Copy,
                                action: () => navigator.clipboard.writeText(contextMenu.id),
                              },
                              {
                                label: t("sidebar.dropView"),
                                icon: Trash2,
                                danger: true,
                                action: async () => {
                                  if (
                                    await ask(
                                      t("sidebar.dropViewConfirm", { view: contextMenu.id }),
                                      { title: t("sidebar.dropView"), kind: "warning" },
                                    )
                                  ) {
                                    try {
                                      await dataTransferGateway.invoke("drop_view", {
                                        connectionId: activeConnectionId,
                                        viewName: contextMenu.id,
                                        ...(viewCtxDatabase ? { database: viewCtxDatabase } : {}),
                                        ...(viewCtxSchema ? { schema: viewCtxSchema } : {}),
                                      });
                                      if (refreshViews) refreshViews();
                                    } catch (e) {
                                      console.error(e);
                                      showAlert(t("sidebar.failDropView") + String(e), { kind: "error" });
                                    }
                                  }
                                },
                              },
                            ];
                          })()
                        : contextMenu.type === "materialized_view"
                        ? (() => {
                            const mvCtxDatabase = contextMenu.data && "database" in contextMenu.data
                              ? contextMenu.data.database ?? undefined
                              : undefined;
                            const mvCtxSchema = contextMenu.data && "schema" in contextMenu.data ? contextMenu.data.schema : undefined;
                            return [
                              {
                                label: t("sidebar.showData"),
                                icon: PlaySquare,
                                action: () => {
                                  const quotedView = quoteTableRef(contextMenu.id, activeDriver, mvCtxSchema);
                                  runQuery(`SELECT * FROM ${quotedView}`, undefined, contextMenu.id, false, mvCtxSchema, undefined, mvCtxDatabase);
                                },
                              },
                              {
                                label: t("sidebar.countRows"),
                                icon: Hash,
                                action: () => {
                                  const quotedView = quoteTableRef(contextMenu.id, activeDriver, mvCtxSchema);
                                  runQuery(`SELECT COUNT(*) as count FROM ${quotedView}`, undefined, undefined, false, mvCtxSchema, undefined, mvCtxDatabase);
                                },
                              },
                              {
                                label: t("sidebar.refreshMaterializedView"),
                                icon: RefreshCw,
                                action: async () => {
                                  const mvName = contextMenu.id;
                                  setRefreshingMatView(mvName);
                                  try {
                                    await dataTransferGateway.invoke("refresh_materialized_view", {
                                      connectionId: activeConnectionId,
                                      viewName: mvName,
                                      ...(mvCtxDatabase ? { database: mvCtxDatabase } : {}),
                                      ...(mvCtxSchema ? { schema: mvCtxSchema } : {}),
                                    });
                                    showAlert(t("views.refreshSuccess", { view: mvName }), { kind: "info" });
                                  } catch (e) {
                                    console.error(e);
                                    showAlert(t("views.refreshError") + String(e), { kind: "error" });
                                  } finally {
                                    setRefreshingMatView(null);
                                  }
                                },
                              },
                              {
                                label: t("sidebar.showDefinition"),
                                icon: FileText,
                                action: async () => {
                                  try {
                                    const definition = await dataTransferGateway.invoke<string>("get_materialized_view_definition", {
                                      connectionId: activeConnectionId,
                                      viewName: contextMenu.id,
                                      ...(mvCtxDatabase ? { database: mvCtxDatabase } : {}),
                                      ...(mvCtxSchema ? { schema: mvCtxSchema } : {}),
                                    });
                                    runQuery(definition, `${contextMenu.id} Definition`, undefined, true, mvCtxSchema, true, mvCtxDatabase);
                                  } catch (e) {
                                    console.error(e);
                                    showAlert(t("views.failGetDefinition") + String(e), { kind: "error" });
                                  }
                                },
                              },
                              {
                                label: t("sidebar.copyName"),
                                icon: Copy,
                                action: () => navigator.clipboard.writeText(contextMenu.id),
                              },
                            ];
                          })()
                        : contextMenu.type === "routine"
                          ? (() => {
                              const routineData =
                                contextMenu.data && 'routine_type' in contextMenu.data
                                   ? (contextMenu.data as RoutineInfo & { database?: string; schema?: string })
                                   : null;
                               const routineType = routineData?.routine_type ?? "PROCEDURE";
                               const routineDatabase = routineData?.database;
                               const routineSchema = routineData?.schema ?? activeSchema ?? undefined;
                              const canManageRoutines =
                                activeCapabilities?.routine_management === true;
                              return [
                                canManageRoutines ? {
                                  label: t("routines.menuRun"),
                                  icon: Play,
                                  action: () => {
                                    if (routineData) {
                                      setRunRoutineModal({
                                        routine: routineData,
                                        database: routineDatabase,
                                        schema: routineSchema,
                                      });
                                    }
                                  },
                                } : null,
                                {
                                  label: t("sidebar.viewDefinition"),
                                  icon: FileText,
                                  action: async () => {
                                    try {
                                      const definition = await dataTransferGateway.invoke<string>("get_routine_definition", {
                                        connectionId: activeConnectionId,
                                        routineName: contextMenu.id,
                                        routineType: routineType,
                                        ...(routineDatabase ? { database: routineDatabase } : {}),
                                        ...(routineSchema ? { schema: routineSchema } : {}),
                                      });
                                      runQuery(definition, `${contextMenu.id} Definition`, undefined, true, routineSchema, true, routineDatabase);
                                    } catch (e) {
                                      console.error(e);
                                      showAlert(
                                        t("sidebar.failGetRoutineDefinition") + String(e),
                                        { kind: "error" }
                                      );
                                    }
                                  },
                                },
                                canManageRoutines ? {
                                  label: t("routines.menuEdit"),
                                  icon: Edit,
                                  action: async () => {
                                    try {
                                      const script = await dataTransferGateway.invoke<string>("get_routine_edit_script", {
                                        connectionId: activeConnectionId,
                                        routineName: contextMenu.id,
                                        routineType: routineType,
                                        ...(routineDatabase ? { database: routineDatabase } : {}),
                                        ...(routineSchema ? { schema: routineSchema } : {}),
                                      });
                                      runQuery(script, `${contextMenu.id} Edit`, undefined, true, routineSchema, undefined, routineDatabase);
                                    } catch (e) {
                                      console.error(e);
                                      showAlert(
                                        t("sidebar.failGetRoutineDefinition") + String(e),
                                        { kind: "error" }
                                      );
                                    }
                                  },
                                } : null,
                                canManageRoutines ? {
                                  label: t("routines.menuDrop"),
                                  icon: Trash2,
                                  danger: true,
                                  action: () => {
                                    setRoutineDropConfirm({
                                      name: contextMenu.id,
                                      routineType,
                                      database: routineDatabase,
                                      schema: routineSchema,
                                    });
                                  },
                                } : null,
                                {
                                  label: t("sidebar.copyName"),
                                  icon: Copy,
                                  action: () => navigator.clipboard.writeText(contextMenu.id),
                                },
                              ].filter(Boolean) as ContextMenuItem[];
                            })()
                          : contextMenu.type === "routines-new"
                            ? [
                                {
                                  label: t("routines.newProcedure"),
                                  icon: FileCode,
                                  action: () => handleNewRoutine("PROCEDURE"),
                                },
                                {
                                  label: t("routines.newFunction"),
                                  icon: FileCode,
                                  action: () => handleNewRoutine("FUNCTION"),
                                },
                              ]
                          : contextMenu.type === "trigger"
                            ? (() => {
                                const triggerData = contextMenu.data && 'table_name' in contextMenu.data
                                   ? contextMenu.data as unknown as TriggerInfo & { database?: string; schema?: string }
                                   : null;
                                 const triggerDatabase = triggerData?.database;
                                 const triggerSchema = triggerData?.schema ?? activeSchema ?? undefined;
                                return [
                                  {
                                    label: t("sidebar.viewTriggerDefinition"),
                                    icon: FileText,
                                    action: async () => {
                                      try {
                                        const definition = await dataTransferGateway.invoke<string>("get_trigger_definition", {
                                          connectionId: activeConnectionId,
                                          triggerName: contextMenu.id,
                                          tableName: triggerData?.table_name ?? "",
                                          ...(triggerDatabase ? { database: triggerDatabase } : {}),
                                          ...(triggerSchema ? { schema: triggerSchema } : {}),
                                        });
                                        runQuery(definition, `${contextMenu.id} Definition`, undefined, true, triggerSchema, true, triggerDatabase);
                                      } catch (e) {
                                        console.error(e);
                                        showAlert(
                                          t("sidebar.failGetTriggerDefinition") + String(e),
                                          { kind: "error" }
                                        );
                                      }
                                    },
                                  },
                                  {
                                    label: t("sidebar.editTrigger"),
                                    icon: Edit,
                                    action: () => {
                                      setTriggerEditorModal({
                                        isOpen: true,
                                        triggerName: contextMenu.id,
                                        tableName: triggerData?.table_name,
                                        database: triggerDatabase,
                                        schema: triggerSchema,
                                        isNewTrigger: false,
                                      });
                                    },
                                  },
                                  {
                                    label: t("sidebar.copyName"),
                                    icon: Copy,
                                    action: () => navigator.clipboard.writeText(contextMenu.id),
                                  },
                                  {
                                    label: t("sidebar.dropTrigger"),
                                    icon: Trash2,
                                    danger: true,
                                    action: async () => {
                                      if (
                                        await ask(
                                          t("sidebar.dropTriggerConfirm", { trigger: contextMenu.id }),
                                          { title: t("sidebar.dropTrigger"), kind: "warning" },
                                        )
                                      ) {
                                        try {
                                          await dataTransferGateway.invoke("drop_trigger", {
                                            connectionId: activeConnectionId,
                                            triggerName: contextMenu.id,
                                            tableName: triggerData?.table_name ?? "",
                                            ...(triggerDatabase ? { database: triggerDatabase } : {}),
                                            ...(triggerSchema ? { schema: triggerSchema } : {}),
                                          });
                                          if (refreshTriggers) refreshTriggers();
                                        } catch (e) {
                                          console.error(e);
                                          showAlert(t("sidebar.failDropTrigger") + String(e), { kind: "error" });
                                        }
                                      }
                                    },
                                  },
                                ];
                              })()
                          : contextMenu.type === "database"
                            ? [
                                {
                                  label: t("sidebar.newConsole"),
                                  icon: FileCode,
                                  action: () => {
                                    const spec = newConsoleForDatabase(contextMenu.id);
                                    runQuery(spec.sql, spec.title, undefined, true, spec.schema, undefined, spec.database);
                                  },
                                },
                                {
                                  label: t("dump.importDatabase"),
                                  icon: Upload,
                                  action: () => handleImportDatabase(contextMenu.id),
                                },
                                {
                                  label: t("dump.dumpDatabase"),
                                  icon: Download,
                                  action: () => setDumpModal({ database: contextMenu.id }),
                                },
                                {
                                  label: t("sidebar.viewERDiagram"),
                                  icon: Network,
                                  action: async () => {
                                    try {
                                      await dataTransferGateway.invoke("open_er_diagram_window", {
                                        connectionId: activeConnectionId || "",
                                        connectionName: activeConnectionName || "Unknown",
                                        databaseName: contextMenu.id,
                                      });
                                    } catch (e) {
                                      console.error("Failed to open ER Diagram window:", e);
                                    }
                                  },
                                },
                                {
                                  label: t("sidebar.refreshTables"),
                                  icon: RefreshCw,
                                  action: () => refreshDatabaseData(contextMenu.id),
                                },
                                supportsRenameDatabase(activeCapabilities) ? {
                                  label: t("sidebar.renameDatabase"),
                                  icon: Edit,
                                  action: () => handleRenameDatabase(contextMenu.id),
                                } : null,
                                supportsDropDatabase(activeCapabilities) ? {
                                  label: t("sidebar.dropDatabase"),
                                  icon: Trash2,
                                  danger: true,
                                  action: () => setDatabaseDropConfirm(contextMenu.id),
                                } : null,
                              ].filter(Boolean) as ContextMenuItem[]
                          : contextMenu.type === "history"
                            ? (() => {
                                const historyEntry = contextMenu.data as unknown as QueryHistoryEntry;
                                return [
                                  {
                                    label: t("sidebar.copyQuery"),
                                    icon: Copy,
                                    action: () => navigator.clipboard.writeText(historyEntry.sql),
                                  },
                                  {
                                    label: t("sidebar.insertToEditor"),
                                    icon: FileInput,
                                    action: () => runQuery(historyEntry.sql, undefined, undefined, true, undefined, undefined, historyEntry.database ?? undefined),
                                  },
                                  {
                                    label: t("sidebar.runQuery"),
                                    icon: Play,
                                    action: () => runSavedQuery(historyEntry.sql, undefined, historyEntry.database ?? undefined),
                                  },
                                  {
                                    label: t("sidebar.openInNewTab"),
                                    icon: Plus,
                                    action: () => runQuery(historyEntry.sql, undefined, undefined, true, undefined, undefined, historyEntry.database ?? undefined),
                                  },
                                  {
                                    label: t("sidebar.addToFavorites"),
                                    icon: Star,
                                    action: () => {
                                      setQueryModal({ isOpen: true });
                                      // Pre-fill the modal with history SQL via a small timeout
                                      // so the modal mounts first, then we set the initial values
                                      setHistoryToFavoriteSQL(historyEntry.sql);
                                      setHistoryToFavoriteDB(historyEntry.database ?? null);
                                    },
                                  },
                                  { separator: true },
                                  {
                                    label: t("sidebar.delete"),
                                    icon: Trash2,
                                    danger: true,
                                    action: () => setHistoryDeleteConfirm(historyEntry.id),
                                  },
                                  {
                                    label: t("sidebar.clearAllHistory"),
                                    icon: Trash2,
                                    danger: true,
                                    action: () => setHistoryClearConfirm(true),
                                  },
                                ] as ContextMenuItem[];
                              })()
                          : [
                              // Saved Query Actions (Default fallback)
                              {
                                label: t("sidebar.execute"),
                                icon: Play,
                                action: () => {
                                  if (contextMenu.data && "sql" in contextMenu.data) {
                                    const sq = contextMenu.data as SavedQuery;
                                    runSavedQuery(sq.sql, sq.name, sq.database ?? undefined);
                                  }
                                },
                              },
                              {
                                label: t("sidebar.edit"),
                                icon: Edit,
                                action: () => {
                                  if (contextMenu.data && "sql" in contextMenu.data) {
                                    setQueryModal({ isOpen: true, query: contextMenu.data as SavedQuery });
                                  }
                                },
                              },
                              {
                                label: t("sidebar.delete"),
                                icon: Trash2,
                                danger: true,
                                action: () => {
                                  setFavoriteDeleteConfirm(contextMenu.id);
                                },
                              },
                            ]
          }
        />
      )}

      {schemaModal && (
        <SchemaModal
          isOpen={true}
          tableName={schemaModal.tableName}
          database={schemaModal.database}
          schema={schemaModal.schema}
          onClose={() => setSchemaModal(null)}
        />
      )}

      <CreateDatabaseModal
        isOpen={isCreateDatabaseModalOpen}
        onClose={() => setIsCreateDatabaseModalOpen(false)}
        onCreate={createDatabase}
      />

      {isCreateTableModalOpen && (
        <CreateTableModal
          isOpen={isCreateTableModalOpen}
          onClose={() => setIsCreateTableModalOpen(false)}
          onSuccess={refreshAfterCreateTable}
          database={createTableTarget.database}
          schema={createTableTarget.schema}
        />
      )}

      {isClipboardImportOpen && (
        <ClipboardImportModal
          isOpen={isClipboardImportOpen}
          onClose={() => setIsClipboardImportOpen(false)}
          onSuccess={() => {
            if (refreshTables) refreshTables();
            setSchemaVersion((v) => v + 1);
            setIsClipboardImportOpen(false);
          }}
        />
      )}

      {queryModal.isOpen && (
        <QueryModal
          isOpen={queryModal.isOpen}
          onClose={() => {
            setQueryModal({ isOpen: false });
            setHistoryToFavoriteSQL(null);
            setHistoryToFavoriteDB(null);
          }}
          title={queryModal.query ? "Edit Query" : "Save Query"}
          initialName={queryModal.query?.name ?? ""}
          initialSql={queryModal.query?.sql ?? historyToFavoriteSQL ?? ""}
          initialDatabase={queryModal.query?.database ?? historyToFavoriteDB}
          databases={isMultiDb ? selectedDatabases : undefined}
          onSave={async (name: string, sql: string, database?: string | null) => {
            if (queryModal.query) {
              await updateQuery(queryModal.query.id, name, sql, database);
            } else if (historyToFavoriteSQL) {
              await saveQuery(name, sql, database ?? historyToFavoriteDB);
            }
            setHistoryToFavoriteSQL(null);
            setHistoryToFavoriteDB(null);
          }}
        />
      )}

      {modifyColumnModal.isOpen && activeConnectionId && (
        <ModifyColumnModal
          isOpen={modifyColumnModal.isOpen}
          onClose={() => setModifyColumnModal({ ...modifyColumnModal, isOpen: false })}
          onSuccess={() => setSchemaVersion((v) => v + 1)}
          connectionId={activeConnectionId}
          tableName={modifyColumnModal.tableName}
          driver={activeDriver || "sqlite"}
          database={modifyColumnModal.database}
          schema={modifyColumnModal.schema}
          column={modifyColumnModal.column}
        />
      )}

      {createIndexModal.isOpen && activeConnectionId && (
        <CreateIndexModal
          isOpen={createIndexModal.isOpen}
          onClose={() => setCreateIndexModal({ ...createIndexModal, isOpen: false })}
          onSuccess={() => setSchemaVersion((v) => v + 1)}
          connectionId={activeConnectionId}
          tableName={createIndexModal.tableName}
          driver={activeDriver || "sqlite"}
          database={createIndexModal.database}
          schema={createIndexModal.schema}
        />
      )}

      {createForeignKeyModal.isOpen && activeConnectionId && (
        <CreateForeignKeyModal
          isOpen={createForeignKeyModal.isOpen}
          onClose={() => setCreateForeignKeyModal({ ...createForeignKeyModal, isOpen: false })}
          onSuccess={() => setSchemaVersion((v) => v + 1)}
          connectionId={activeConnectionId}
          tableName={createForeignKeyModal.tableName}
          driver={activeDriver || "sqlite"}
          database={createForeignKeyModal.database}
          schema={createForeignKeyModal.schema}
        />
      )}

      {generateSQLModal && (
        <GenerateSQLModal
          isOpen={true}
          tableName={generateSQLModal.tableName}
          database={generateSQLModal.database}
          schema={generateSQLModal.schema}
          onClose={() => setGenerateSQLModal(null)}
        />
      )}

      {dumpModal && activeConnectionId && (
        <DumpDatabaseModal
          isOpen={true}
          onClose={() => setDumpModal(null)}
          connectionId={activeConnectionId}
          databaseName={dumpModal.database || activeDatabaseName || "Database"}
          tables={(
            activeCapabilities?.schemas && activeSchema
              ? (schemaDataMap[activeSchema]?.tables ?? [])
              : (databaseDataMap[dumpModal.database]?.tables ?? tables)
          ).map((t) => t.name)}
        />
      )}

      {importModal && activeConnectionId && (
        <ImportDatabaseModal
          isOpen={true}
          onClose={() => setImportModal(null)}
          connectionId={activeConnectionId}
          databaseName={importModal.database || activeDatabaseName || "Database"}
          filePath={importModal.filePath}
          onSuccess={() => {
            if (refreshTables) refreshTables();
          }}
        />
      )}

      {viewEditorModal.isOpen && activeConnectionId && (
        <ViewEditorModal
          SqlEditor={SqlEditor}
          isOpen={viewEditorModal.isOpen}
          onClose={() => setViewEditorModal({ isOpen: false })}
          connectionId={activeConnectionId}
          viewName={viewEditorModal.viewName}
          database={viewEditorModal.database}
          schema={viewEditorModal.schema}
          isNewView={viewEditorModal.isNewView}
          onSuccess={() => {
            if (refreshViews) refreshViews();
          }}
        />
      )}

      {triggerEditorModal.isOpen && activeConnectionId && (
        <TriggerEditorModal
          SqlEditor={SqlEditor}
          isOpen={triggerEditorModal.isOpen}
          onClose={() => setTriggerEditorModal({ isOpen: false })}
          connectionId={activeConnectionId}
          triggerName={triggerEditorModal.triggerName}
          tableName={triggerEditorModal.tableName}
          database={triggerEditorModal.database}
          schema={triggerEditorModal.schema}
          driver={activeDriver ?? undefined}
          isNewTrigger={triggerEditorModal.isNewTrigger}
          onSuccess={() => {
            if (refreshTriggers) refreshTriggers();
          }}
        />
      )}

      {/* Delete favorite confirmation */}
      <ConfirmModal
        isOpen={favoriteDeleteConfirm !== null}
        onClose={() => setFavoriteDeleteConfirm(null)}
        title={t("sidebar.confirmDeleteTitle")}
        message={t("sidebar.confirmDeleteQuery", { name: queries.find((q) => q.id === favoriteDeleteConfirm)?.name ?? "" })}
        onConfirm={() => {
          if (favoriteDeleteConfirm) {
            deleteQuery(favoriteDeleteConfirm);
          }
          setFavoriteDeleteConfirm(null);
        }}
      />

      {/* Delete single history entry confirmation */}
      <ConfirmModal
        isOpen={historyDeleteConfirm !== null}
        onClose={() => setHistoryDeleteConfirm(null)}
        title={t("sidebar.confirmDeleteTitle")}
        message={t("sidebar.confirmDeleteHistoryEntry")}
        onConfirm={() => {
          if (historyDeleteConfirm) {
            deleteHistoryEntry(historyDeleteConfirm);
          }
          setHistoryDeleteConfirm(null);
        }}
      />

      {/* Clear all history confirmation */}
      <ConfirmModal
        isOpen={historyClearConfirm}
        onClose={() => setHistoryClearConfirm(false)}
        title={t("sidebar.confirmClearHistoryTitle")}
        message={t("sidebar.confirmClearHistory")}
        onConfirm={() => {
          clearHistory();
          setHistoryClearConfirm(false);
        }}
      />

      {/* Run routine with parameters */}
      {runRoutineModal && activeConnectionId && (
        <RunRoutineModal
          isOpen={true}
          onClose={() => setRunRoutineModal(null)}
          connectionId={activeConnectionId}
          routine={runRoutineModal.routine}
          database={runRoutineModal.database}
          schema={runRoutineModal.schema}
          onRun={(sql) => {
            runQuery(sql, `${t("routines.runTabPrefix")} ${runRoutineModal.routine.name}`, undefined, false, runRoutineModal.schema, undefined, runRoutineModal.database);
          }}
        />
      )}

      <ConfirmModal
        isOpen={databaseDropConfirm !== null}
        onClose={() => setDatabaseDropConfirm(null)}
        title={t("sidebar.dropDatabase")}
        message={t("sidebar.dropDatabaseConfirm", { database: databaseDropConfirm ?? "" })}
        confirmDelaySeconds={2}
        onConfirm={handleDropDatabase}
      />

      <ConfirmModal
        isOpen={tableTruncateConfirm !== null}
        onClose={() => setTableTruncateConfirm(null)}
        title={t("sidebar.truncateTable")}
        message={t("sidebar.truncateTableConfirm", { table: tableTruncateConfirm?.tableName ?? "" })}
        confirmDelaySeconds={2}
        onConfirm={handleTruncateTable}
      />

      {/* Drop routine confirmation */}
      <ConfirmModal
        isOpen={routineDropConfirm !== null}
        onClose={() => setRoutineDropConfirm(null)}
        title={t("routines.dropConfirmTitle")}
        message={t("routines.dropConfirmMessage", { name: routineDropConfirm?.name ?? "" })}
        onConfirm={handleDropRoutine}
      />
      </ExplorerModals>
    </>
  );
};
