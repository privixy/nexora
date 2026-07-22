import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { recordGateway } from "../../../platform/tauri";
import { useAlert } from "../../../hooks/useAlert";
import {
  USE_DEFAULT_SENTINEL,
  formatCellValue,
  getColumnSortState,
  getResultValueType,
  buildPkMap,
  serializePkKey,
  type MergedRow,
} from "../lib/dataGrid";
import { useSettings } from "../../settings";
import { isGeometricType, formatGeometricValue } from "../../../utils/geometry";
import { isBlobColumn, isBlobWireFormat } from "../../../utils/blob";
import { isJsonColumn, isJsonContent } from "../../../utils/json";
import { pickPrimaryForeignKeyByColumn } from "../../schema";
import {
  getDateInputMode,
  parseDateTime,
  formatDateTime,
} from "../../../utils/dateInput";
import { RowEditorSidebar } from "./RowEditorSidebar";
import { useDatabase } from "../../connections";
import { getSelectedRows, copyTextToClipboard } from "../../../utils/clipboard";
import type {
  PendingInsertion,
  TableColumn,
  ForeignKey,
} from "../../../types/editor";
import type { RowCtx } from "./DataGridRow";
import { useGridSelection } from "../hooks/useGridSelection";
import { useJsonViewerSession } from "../hooks/useJsonViewerSession";
import { useGridClipboard } from "../hooks/useGridClipboard";
import { useCellEditing } from "../hooks/useCellEditing";
import { DataGridHeader } from "./DataGridHeader";
import { DataGridBody } from "./DataGridBody";
import {
  DataGridContextMenus,
  type GridContextMenuState,
  type GridHeaderContextMenuState,
} from "./DataGridContextMenus";

export interface DataGridProps {
  columns: string[];
  data: unknown[][];
  tableName?: string | null;
  pkColumns?: string[] | null;
  autoIncrementColumns?: string[];
  defaultValueColumns?: string[];
  nullableColumns?: string[];
  columnMetadata?: TableColumn[];
  foreignKeys?: ForeignKey[];
  onForeignKeyNavigate?: (fk: ForeignKey, value: unknown) => void;
  onForeignKeyShowPanel?: (fk: ForeignKey, value: unknown) => void;
  onForeignKeyHidePanel?: () => void;
  connectionId?: string | null;
  database?: string;
  schema?: string;
  onRefresh?: () => void;
  pendingChanges?: Record<
    string,
    { pkOriginalValue: unknown; changes: Record<string, unknown> }
  >;
  pendingDeletions?: Record<string, unknown>;
  pendingInsertions?: Record<string, PendingInsertion>;
  onPendingChange?: (pkVal: unknown, colName: string, value: unknown) => void;
  onPendingInsertionChange?: (
    tempId: string,
    colName: string,
    value: unknown,
  ) => void;
  onDiscardInsertion?: (tempId: string) => void;
  onRevertDeletion?: (pkVal: unknown) => void;
  onMarkForDeletion?: (pkVal: unknown) => void;
  onMarkMultipleForDeletion?: (pkVals: unknown[]) => void;
  onDuplicateRow?: (rowData: Record<string, unknown>) => void;
  selectedRows?: Set<number>;
  onSelectionChange?: (indices: Set<number>) => void;
  copyFormat?: "csv" | "json" | "sql-insert";
  csvDelimiter?: string;
  csvIncludeHeaders?: boolean;
  sortClause?: string;
  onSort?: (colName: string) => void;
  readonly?: boolean;
}

export const DataGrid = React.memo(
  ({
    columns,
    data,
    tableName,
    pkColumns,
    autoIncrementColumns,
    defaultValueColumns,
    nullableColumns,
    columnMetadata,
    foreignKeys,
    onForeignKeyNavigate,
    onForeignKeyShowPanel,
    onForeignKeyHidePanel,
    connectionId,
    database,
    schema,
    onRefresh,
    pendingChanges,
    pendingDeletions,
    pendingInsertions,
    onPendingChange,
    onPendingInsertionChange,
    onDiscardInsertion,
    onRevertDeletion,
    onMarkForDeletion,
    onMarkMultipleForDeletion,
    onDuplicateRow,
    selectedRows: externalSelectedRows,
    onSelectionChange,
    copyFormat,
    csvDelimiter = ",",
    csvIncludeHeaders = true,
    sortClause,
    onSort,
    readonly: readonlyProp,
  }: DataGridProps) => {
    const { t } = useTranslation();
    const { activeDatabase, activeSchema, connections } = useDatabase();
    const { showAlert } = useAlert();
    const { settings } = useSettings();
    const colorByType = settings.resultColorByType ?? false;
    const stickyColumnHeaders = settings.stickyColumnHeaders ?? true;

    const detectJsonInTextColumns = useMemo(() => {
      if (!connectionId) return false;
      return (
        connections.find((c) => c.id === connectionId)
          ?.detect_json_in_text_columns === true
      );
    }, [connections, connectionId]);

    const [contextMenu, setContextMenu] =
      useState<GridContextMenuState | null>(null);
    const [headerContextMenu, setHeaderContextMenu] =
      useState<GridHeaderContextMenuState | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarRowData, setSidebarRowData] = useState<{
      data: Record<string, unknown>;
      rowIndex: number;
      focusField?: string;
    } | null>(null);
    const [expandedCell, setExpandedCell] = useState<{
      rowIndex: number;
      colIndex: number;
      kind: "json" | "text";
    } | null>(null);

    useEffect(() => {
      setExpandedCell(null);
    }, [data]);

    const [focusedCell, setFocusedCell] = useState<{
      rowIndex: number;
      colIndex: number;
    } | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const { selectedRowIndices, updateSelection, handleRowClick } =
      useGridSelection({
        selectedRows: externalSelectedRows,
        onSelectionChange,
      });

    // Pre-calculate pkIndex array once for O(1) lookup instead of O(n) in render loop
    const pkIndexMaps = useMemo((): number[] => {
      if (!pkColumns || pkColumns.length === 0) return [];
      const indices = pkColumns.map((col) => columns.indexOf(col));
      // If any PK column is absent from the result set, disable editing entirely
      // to avoid partial WHERE clauses that could match multiple rows.
      if (indices.some((idx) => idx < 0)) return [];
      return indices;
    }, [columns, pkColumns]);

    // Create column type map for O(1) lookup during cell rendering
    const columnTypeMap = useMemo(() => {
      if (!columnMetadata) return null;
      return new Map(columnMetadata.map((col) => [col.name, col.data_type]));
    }, [columnMetadata]);

    // Create column length map for O(1) lookup during blob rendering decisions
    const columnLengthMap = useMemo(() => {
      if (!columnMetadata) return null;
      return new Map(
        columnMetadata.map((col) => [col.name, col.character_maximum_length]),
      );
    }, [columnMetadata]);

    // Precompute the result-coloring class per column once (the type is fixed
    // per column), so rows don't reclassify every cell on each render. `null`
    // when the feature is off, which makes rows skip the wrapper entirely.
    const resultColorClassMap = useMemo(() => {
      if (!colorByType) return null;
      const map = new Map<string, string>();
      for (const colName of columns) {
        const colType = columnTypeMap?.get(colName);
        if (colType) map.set(colName, `rcell-${getResultValueType(undefined, colType)}`);
      }
      return map;
    }, [colorByType, columns, columnTypeMap]);

    const isJsonCellTarget = useCallback(
      (colType: string | undefined, value: unknown): boolean => {
        if (colType && isJsonColumn(colType)) return true;
        if (!detectJsonInTextColumns) return false;
        if (Array.isArray(value)) return true;
        if (isJsonContent(value)) return true;
        return false;
      },
      [detectJsonInTextColumns],
    );

    const buildRowLabel = useCallback(
      (rowData: unknown[], rowIndex: number, isInsertion: boolean): string => {
        if (isInsertion) return t("dataGrid.newRow", { defaultValue: "NEW" });
        if (pkColumns && pkColumns.length > 0 && pkIndexMaps.length > 0) {
          const pkVal = rowData[pkIndexMaps[0]];
          if (pkVal !== null && pkVal !== undefined && pkVal !== "") {
            return `${pkColumns[0]}=${String(pkVal)}`;
          }
        }
        return `Row ${rowIndex + 1}`;
      },
      [pkColumns, pkIndexMaps, t],
    );

    const { openJsonViewerWindow: openJsonViewerSession } = useJsonViewerSession({
      pkColumns,
      pkIndexMaps,
      onPendingChange,
      onPendingInsertionChange,
    });

    const openJsonViewerWindow = useCallback(
      (
        value: unknown,
        originalValue: unknown,
        colName: string,
        rowData: unknown[],
        rowIndex: number,
        isInsertion: boolean,
        tempId: string | undefined,
        readOnly: boolean,
      ) =>
        openJsonViewerSession({
          value,
          originalValue,
          colName,
          rowData,
          rowIndex,
          isInsertion,
          tempId,
          readOnly,
          rowLabel: buildRowLabel(rowData, rowIndex, isInsertion),
        }),
      [buildRowLabel, openJsonViewerSession],
    );

    const fksByColumn = useMemo(
      () => pickPrimaryForeignKeyByColumn(foreignKeys),
      [foreignKeys],
    );

    // Merge existing rows with pending insertions
    const mergedRows = useMemo(() => {
      const rows: MergedRow[] = [];

      // Add existing rows first (displayIndex 0, 1, 2, ...)
      data.forEach((rowData, idx) => {
        rows.push({
          type: "existing",
          rowData,
          displayIndex: idx,
        });
      });

      // Add pending insertions at the end
      if (pendingInsertions) {
        const existingRowCount = data.length;
        let insertionIndex = 0;
        Object.entries(pendingInsertions).forEach(([tempId, insertion]) => {
          const rowData = columns.map((col) => insertion.data[col] ?? null);
          rows.push({
            type: "insertion",
            rowData,
            displayIndex: existingRowCount + insertionIndex,
            tempId,
          });
          insertionIndex++;
        });
      }

      // Sort by displayIndex (insertions are now at the end)
      return rows.sort((a, b) => a.displayIndex - b.displayIndex);
    }, [data, pendingInsertions, columns]);

    const { copyToClipboard, formatRows, copySelectedCells } = useGridClipboard({
      columns,
      data,
      selectedRowIndices,
      copyFormat,
      tableName,
      csvDelimiter,
      csvIncludeHeaders,
      showAlert,
      t,
    });

    const handleSelectAll = useCallback(() => {
      setFocusedCell(null);
      onForeignKeyHidePanel?.();
      if (selectedRowIndices.size === mergedRows.length) {
        updateSelection(new Set());
      } else {
        const allIndices = new Set(mergedRows.map((_, i) => i));
        updateSelection(allIndices);
        copyTextToClipboard(formatRows(mergedRows.map((r) => r.rowData))).catch((e) => {
          showAlert(t("common.error") + ": " + e, { title: t("common.error"), kind: "error" });
        });
      }
    }, [
      selectedRowIndices.size,
      mergedRows,
      updateSelection,
      onForeignKeyHidePanel,
      formatRows,
      showAlert,
      t,
    ]);

    const buildRowDataWithPending = useCallback(
      (rowArray: unknown[], isInsertion: boolean): Record<string, unknown> => {
        const rowData: Record<string, unknown> = {};
        columns.forEach((col, idx) => {
          rowData[col] = rowArray[idx];
        });
        if (!isInsertion && pkIndexMaps.length > 0) {
          const pkMapVal = buildPkMap(pkColumns!, rowArray, pkIndexMaps);
          const pending = pendingChanges?.[serializePkKey(pkMapVal)]?.changes;
          if (pending) Object.assign(rowData, pending);
        }
        return rowData;
      },
      [columns, pkIndexMaps, pkColumns, pendingChanges],
    );

    const {
      editingCell,
      setEditingCell,
      handleEditCommit,
      handleKeyDown,
      commitEditWithValue,
    } = useCellEditing({
      columns,
      mergedRows,
      tableName,
      pkColumns,
      pkIndexMaps,
      connectionId,
      database,
      schema,
      activeDatabase,
      activeSchema,
      onRefresh,
      onPendingChange,
      onPendingInsertionChange,
      showAlert,
      t,
    });

    const handleCellDoubleClick = useCallback(
      (rowIndex: number, colIndex: number, value: unknown) => {
      if (!tableName || readonlyProp) return;

      const mergedRow = mergedRows[rowIndex];
      if (!mergedRow) return;
      // No primary key defined for the table at all → editing impossible.
      if (
        mergedRow.type !== "insertion" &&
        (!pkColumns || pkColumns.length === 0)
      )
        return;

      const colName = columns[colIndex];

      // For existing rows we must be able to build a safe UPDATE. Two guards,
      // each running whenever the data it depends on is available, so they
      // don't silently no-op when a driver omits result metadata:
      //
      // 1. Every primary key column must be present in the result set (needed
      //    for the WHERE clause). Depends only on pkColumns + columns.
      // 2. The edited column must map to a real physical column of the table
      //    (prevents malformed UPDATEs on aliased/computed columns). Requires
      //    columnMetadata; skipped when it's unavailable.
      if (mergedRow.type !== "insertion") {
        const missingPk = (pkColumns ?? []).filter(
          (pk) => !columns.some((c) => c.toLowerCase() === pk.toLowerCase()),
        );
        if (missingPk.length > 0) {
          showAlert(
            t("dataGrid.pkRequiredToEdit", {
              pk: missingPk.join(", "),
              defaultValue:
                'To edit this result, include the primary key column "{{pk}}" in your SELECT.',
            }),
            { title: t("common.error"), kind: "warning" },
          );
          return;
        }

        if (columnMetadata && columnMetadata.length > 0) {
          const realColumns = new Set(
            columnMetadata.map((c) => c.name.toLowerCase()),
          );
          if (!realColumns.has(colName.toLowerCase())) {
            showAlert(
              t("dataGrid.columnNotEditable", {
                column: colName,
                table: tableName,
                defaultValue:
                  'Column "{{column}}" can\'t be edited — it is not a direct column of table "{{table}}" (likely an alias or computed value).',
              }),
              { title: t("common.error"), kind: "warning" },
            );
            return;
          }
        }
      }

      const colType = columnTypeMap?.get(colName);

      if (
        colType &&
        (isBlobColumn(colType, columnLengthMap?.get(colName)) ||
          isBlobWireFormat(value))
      ) {
        setSidebarRowData({
          data: buildRowDataWithPending(
            mergedRow.rowData,
            mergedRow.type === "insertion",
          ),
          rowIndex,
          focusField: colName,
        });
        setSidebarOpen(true);
        return;
      }

      if (colType && isJsonColumn(colType)) {
        const isInsertion = mergedRow.type === "insertion";
        openJsonViewerWindow(
          value,
          mergedRow.rowData[colIndex],
          colName,
          mergedRow.rowData,
          rowIndex,
          isInsertion,
          mergedRow.tempId,
          readonlyProp ?? false,
        );
        return;
      }

      let editValue = value;
      if (
        colType &&
        isGeometricType(colType) &&
        value !== null &&
        value !== undefined
      ) {
        editValue = formatGeometricValue(value);
      }

      setEditingCell({ rowIndex, colIndex, value: editValue });
    },
      [
        tableName,
        readonlyProp,
        mergedRows,
        pkColumns,
        columns,
        columnTypeMap,
        columnLengthMap,
        columnMetadata,
        buildRowDataWithPending,
        openJsonViewerWindow,
        showAlert,
        setEditingCell,
        t,
      ],
    );

    useEffect(() => {
      if (editingCell && editInputRef.current) {
        editInputRef.current.focus();
      }
    }, [editingCell]);

    const columnHelper = useMemo(() => createColumnHelper<unknown[]>(), []);

    const coreRowModel = useMemo(() => getCoreRowModel(), []);

    const tableColumns = React.useMemo(
      () =>
        columns.map((colName, index) =>
          columnHelper.accessor((row) => row[index], {
            // react-table requires a non-empty `id` when an accessorFn is used.
            // Some drivers (e.g. SQL Server `SELECT @@VERSION`, Postgres `SELECT 1 AS ""`)
            // return columns with an empty name, which would otherwise crash the grid.
            id: colName !== "" ? colName : `__unnamed_${index}__`,
            header: () => {
              const sortState = getColumnSortState(colName, sortClause);
              const displaySortState: "none" | "asc" | "desc" =
                sortState ?? "none";
              // Column data type for the DataGrip-style header hover tooltip.
              // Only populated when column metadata is present (i.e. table
              // browse), not for arbitrary query results.
              const colType = columnTypeMap?.get(colName);

              return (
                <div
                  role={onSort ? "button" : undefined}
                  tabIndex={onSort ? 0 : undefined}
                  aria-label={onSort ? (
                    displaySortState === "none"
                      ? t("dataGrid.sortByAsc", { col: colName })
                      : displaySortState === "asc"
                        ? t("dataGrid.sortByDesc", { col: colName })
                        : t("dataGrid.clearSort")
                  ) : undefined}
                  className={`relative flex items-center gap-2 select-none group/header ${onSort ? "cursor-pointer" : ""}`}
                  onClick={() => onSort && onSort(colName)}
                  onKeyDown={(e) => { if (onSort && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSort(colName); } }}
                  title={
                    // Suppress the native sort-hint title while the type tooltip
                    // is shown, to avoid two overlapping tooltips on hover.
                    colType
                      ? undefined
                      : onSort
                        ? displaySortState === "none"
                          ? t("dataGrid.sortByAsc", { col: colName })
                          : displaySortState === "asc"
                            ? t("dataGrid.sortByDesc", { col: colName })
                            : t("dataGrid.clearSort")
                        : undefined
                  }
                >
                  <span>{colName}</span>
                  {onSort && (
                    <span className="flex flex-col items-center justify-center">
                      {displaySortState === "asc" && (
                        <ArrowUp size={14} className="text-blue-400" />
                      )}
                      {displaySortState === "desc" && (
                        <ArrowDown size={14} className="text-blue-400" />
                      )}
                      {displaySortState === "none" && (
                        <ArrowUpDown
                          size={14}
                          className="text-secondary/60 opacity-50 group-hover/header:opacity-100 transition-opacity"
                        />
                      )}
                    </span>
                  )}
                  {colType && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-lg border border-strong bg-tooltip px-2 py-1 text-xs font-normal normal-case tracking-normal text-secondary opacity-0 shadow-xl transition-opacity duration-100 group-hover/header:opacity-100"
                    >
                      <span className="text-primary">{colName}</span>: {colType}
                    </span>
                  )}
                </div>
              );
            },
          }),
        ),
      [
        columns,
        columnHelper,
        t,
        sortClause,
        onSort,
        columnTypeMap,
      ],
    );

    const parentRef = useRef<HTMLDivElement>(null);
    const [parentViewportWidth, setParentViewportWidth] = useState(0);

    useEffect(() => {
      const el = parentRef.current;
      if (!el) return;
      const update = () => setParentViewportWidth(el.clientWidth);
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Memoize table data to prevent unnecessary re-renders
    const tableData = useMemo(
      () => mergedRows.map((r) => r.rowData),
      [mergedRows],
    );

    const table = useReactTable({
      data: tableData,
      columns: tableColumns,
      getCoreRowModel: coreRowModel,
    });

    const { rows: tableRows } = table.getRowModel();

    const rowVirtualizer = useVirtualizer({
      count: tableRows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 35,
      overscan: 10,
    });

    // Track insertion count to auto-scroll to bottom when new rows are added
    const prevInsertionCountRef = useRef(0);
    useEffect(() => {
      const insertionCount = pendingInsertions
        ? Object.keys(pendingInsertions).length
        : 0;
      if (
        insertionCount > prevInsertionCountRef.current &&
        tableRows.length > 0
      ) {
        rowVirtualizer.scrollToIndex(tableRows.length - 1, { align: "end" });
      }
      prevInsertionCountRef.current = insertionCount;
    }, [pendingInsertions, tableRows.length, rowVirtualizer]);

    const handleContextMenu = useCallback(
      (
        e: React.MouseEvent,
        row: unknown[],
        rowIndex: number,
        colIndex: number,
        colName: string,
      ) => {
        if (tableName) {
          e.preventDefault();
          // Find the merged row corresponding to this DOM element
          const mergedRow = mergedRows.find((mr) => mr.rowData === row);
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            row,
            rowIndex,
            colIndex,
            colName,
            mergedRow,
          });
        }
      },
      [tableName, mergedRows],
    );

    const revertSelectedRow = useCallback(() => {
      if (!contextMenu) return;

      const isInsertion = contextMenu.mergedRow?.type === "insertion";
      const tempId = contextMenu.mergedRow?.tempId;

      // Handle insertion row revert (discard)
      if (isInsertion && tempId && onDiscardInsertion) {
        onDiscardInsertion(tempId);
        setContextMenu(null);
        return;
      }

      // For existing rows, need pkColumns
      if (!pkColumns || pkIndexMaps.length === 0) return;

      const pkMapVal = buildPkMap(pkColumns, contextMenu.row, pkIndexMaps);
      const pkValStr = serializePkKey(pkMapVal);

      // Handle pending deletion revert
      const isPendingDelete = pendingDeletions?.[pkValStr] !== undefined;
      if (isPendingDelete && onRevertDeletion) {
        onRevertDeletion(pkMapVal);
        setContextMenu(null);
        return;
      }

      // Handle pending changes revert
      const rowPendingChanges = pendingChanges?.[pkValStr];
      if (rowPendingChanges && onPendingChange) {
        // Revert all pending changes for this row by setting them to undefined
        Object.keys(rowPendingChanges.changes).forEach((colName) => {
          onPendingChange(pkMapVal, colName, undefined);
        });
        setContextMenu(null);
        return;
      }

      setContextMenu(null);
    }, [
      contextMenu,
      onPendingChange,
      onRevertDeletion,
      onDiscardInsertion,
      pkColumns,
      pkIndexMaps,
      pendingChanges,
      pendingDeletions,
    ]);

    const deleteRowsByIndices = useCallback((indicesToDelete: number[]) => {
      const pkVals: unknown[] = [];
      for (const idx of indicesToDelete) {
        const mergedRow = mergedRows[idx];
        if (!mergedRow) continue;

        if (mergedRow.type === "insertion" && mergedRow.tempId && onDiscardInsertion) {
          onDiscardInsertion(mergedRow.tempId);
        } else if (mergedRow.type === "existing" && pkColumns && pkIndexMaps.length > 0) {
          pkVals.push(buildPkMap(pkColumns, mergedRow.rowData, pkIndexMaps));
        }
      }

      // Use batch handler to avoid stale-closure overwrites when called per-row.
      if (pkVals.length > 0) {
        if (onMarkMultipleForDeletion) {
          onMarkMultipleForDeletion(pkVals);
        } else if (onMarkForDeletion) {
          pkVals.forEach((v) => onMarkForDeletion(v));
        }
      }
    }, [mergedRows, onDiscardInsertion, onMarkForDeletion, onMarkMultipleForDeletion, pkColumns, pkIndexMaps]);

    const deleteSelectedRow = useCallback(() => {
      if (!contextMenu) return;

      // If the right-clicked row is part of a multi-selection, delete all selected rows.
      // Otherwise fall back to deleting just the right-clicked row.
      const rightClickedIsSelected = selectedRowIndices.has(contextMenu.rowIndex);
      const indicesToDelete =
        rightClickedIsSelected && selectedRowIndices.size > 1
          ? Array.from(selectedRowIndices)
          : [contextMenu.rowIndex];

      deleteRowsByIndices(indicesToDelete);
      setContextMenu(null);
    }, [contextMenu, selectedRowIndices, deleteRowsByIndices]);

    const duplicateSelectedRow = useCallback(() => {
      if (!contextMenu || !onDuplicateRow) return;

      const mergedRow = contextMenu.mergedRow;
      const rowData: Record<string, unknown> = {};

      if (mergedRow?.type === "insertion" && mergedRow.tempId && pendingInsertions) {
        const insertion = pendingInsertions[mergedRow.tempId];
        if (insertion) {
          Object.assign(rowData, insertion.data);
        }
      } else {
        columns.forEach((col, idx) => {
          rowData[col] = contextMenu.row[idx];
        });
      }

      onDuplicateRow(rowData);
      setContextMenu(null);
    }, [contextMenu, columns, pendingInsertions, onDuplicateRow]);

    const openSidebarEditor = useCallback(() => {
      if (!contextMenu) return;
      const isInsertion = contextMenu.mergedRow?.type === "insertion";
      setSidebarRowData({
        data: buildRowDataWithPending(contextMenu.row, isInsertion ?? false),
        rowIndex: contextMenu.rowIndex,
      });
      setSidebarOpen(true);
      setContextMenu(null);
    }, [contextMenu, buildRowDataWithPending]);

    const openJsonEditor = useCallback(() => {
      if (!contextMenu) return;
      const isInsertion = contextMenu.mergedRow?.type === "insertion";

      openJsonViewerWindow(
        contextMenu.row[contextMenu.colIndex],
        contextMenu.row[contextMenu.colIndex],
        contextMenu.colName,
        contextMenu.row,
        contextMenu.rowIndex,
        isInsertion,
        contextMenu.mergedRow?.tempId,
        readonlyProp ?? false,
      );
      setContextMenu(null);
    }, [contextMenu, openJsonViewerWindow, readonlyProp]);

    // Unified handler for setting cell values from context menu actions
    const setCellValue = useCallback(
      (value: unknown) => {
        if (!contextMenu) return;
        const { colName, mergedRow } = contextMenu;
        const isInsertion = mergedRow?.type === "insertion";

        if (isInsertion && onPendingInsertionChange && mergedRow.tempId) {
          onPendingInsertionChange(mergedRow.tempId, colName, value);
        } else if (onPendingChange && pkIndexMaps.length > 0) {
          const pkMapVal = buildPkMap(pkColumns!, contextMenu.row, pkIndexMaps);
          onPendingChange(pkMapVal, colName, value);
        }
        setContextMenu(null);
      },
      [contextMenu, onPendingInsertionChange, onPendingChange, pkIndexMaps, pkColumns],
    );

    const setCellGenerate = useCallback(
      () => setCellValue(null),
      [setCellValue],
    );
    const setCellNull = useCallback(() => setCellValue(null), [setCellValue]);
    const setCellDefault = useCallback(() => {
      if (!contextMenu) return;
      const isInsertion = contextMenu.mergedRow?.type === "insertion";
      // For insertions, null triggers <default> display; for existing rows, use sentinel
      setCellValue(isInsertion ? null : USE_DEFAULT_SENTINEL);
    }, [contextMenu, setCellValue]);
    const setCellEmpty = useCallback(() => setCellValue(""), [setCellValue]);

    const setCellServerNow = useCallback(() => {
      if (!contextMenu || !connectionId) return;
      const { colName, mergedRow, row } = contextMenu;
      const isInsertion = mergedRow?.type === "insertion";
      const colDataType = columnTypeMap?.get(colName) ?? "";
      const dateMode = getDateInputMode(colDataType);
      if (!dateMode) return;

      setContextMenu(null);
      recordGateway.getServerNow<string>({ connectionId })
        .then((raw) => {
          const formatted = formatDateTime(parseDateTime(raw), dateMode);
          if (isInsertion && onPendingInsertionChange && mergedRow?.tempId) {
            onPendingInsertionChange(mergedRow.tempId, colName, formatted);
          } else if (onPendingChange && pkIndexMaps.length > 0) {
            const pkMapVal = buildPkMap(pkColumns!, row, pkIndexMaps);
            onPendingChange(pkMapVal, colName, formatted);
          }
        })
        .catch((err) => {
          showAlert(String(err), { title: t("general.error"), kind: "error" });
        });
    }, [
      contextMenu,
      connectionId,
      columnTypeMap,
      onPendingInsertionChange,
      onPendingChange,
      pkIndexMaps,
      pkColumns,
      t,
      showAlert,
    ]);

    const copySelectedOrContextRow = useCallback(async () => {
      if (!contextMenu) return;

      const rows =
        selectedRowIndices.size > 0
          ? getSelectedRows(data, selectedRowIndices)
          : [contextMenu.row];

      await copyToClipboard(formatRows(rows, true));
    }, [contextMenu, selectedRowIndices, data, formatRows, copyToClipboard]);

    const copyHeaderName = useCallback(async () => {
      if (!headerContextMenu) return;
      await copyToClipboard(headerContextMenu.colName);
      setHeaderContextMenu(null);
    }, [headerContextMenu, copyToClipboard]);

    const copyHeaderNameQuoted = useCallback(async () => {
      if (!headerContextMenu) return;
      await copyToClipboard(`\`${headerContextMenu.colName}\``);
      setHeaderContextMenu(null);
    }, [headerContextMenu, copyToClipboard]);

    const copyHeaderNameTable = useCallback(async () => {
      if (!headerContextMenu) return;
      const tName = tableName ? `${tableName}.` : "";
      await copyToClipboard(`${tName}${headerContextMenu.colName}`);
      setHeaderContextMenu(null);
    }, [headerContextMenu, tableName, copyToClipboard]);

    const copyCellValue = useCallback(
      async (rowIndex: number, colIndex: number) => {
        const mergedRow = mergedRows[rowIndex];
        if (!mergedRow) return;
        const rawValue = mergedRow.rowData[colIndex];
        const colName = columns[colIndex];
        const colType = columnTypeMap?.get(colName);
        const colLength = columnLengthMap?.get(colName);
        const text = formatCellValue(rawValue, "null", colType, colLength);
        await copyToClipboard(text);
      },
      [mergedRows, columns, columnTypeMap, columnLengthMap, copyToClipboard],
    );

    const copyCellFromContext = useCallback(async () => {
      if (!contextMenu) return;
      await copyCellValue(contextMenu.rowIndex, contextMenu.colIndex);
      setContextMenu(null);
    }, [contextMenu, copyCellValue]);

    // Handle keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // CMD/CTRL + C
        if ((e.metaKey || e.ctrlKey) && e.key === "c") {
          // Only handle if not editing a cell
          if (!editingCell) {
            if (focusedCell) {
              e.preventDefault();
              copyCellValue(focusedCell.rowIndex, focusedCell.colIndex);
            } else if (selectedRowIndices.size > 0) {
              e.preventDefault();
              copySelectedCells();
            }
          }
        }

        // Delete / Backspace — delete selected rows
        if ((e.key === "Delete" || e.key === "Backspace") && !editingCell && !readonlyProp && selectedRowIndices.size > 0) {
          e.preventDefault();
          deleteRowsByIndices(Array.from(selectedRowIndices));
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [editingCell, selectedRowIndices, focusedCell, copyCellValue, copySelectedCells, readonlyProp, deleteRowsByIndices]);

    // Stable per-row dependency bundle. Memoizing it lets React.memo on MemoRow
    // skip re-rendering rows that didn't change during scroll.
    const rowCtx: RowCtx = useMemo(
      () => ({
        columns,
        autoIncrementColumns,
        defaultValueColumns,
        nullableColumns,
        pkColumns,
        pendingChanges,
        columnTypeMap,
        columnLengthMap,
        resultColorClassMap,
        isJsonCellTarget,
        fksByColumn,
        t,
        mergedRows,
        pkIndexMaps,
        parentViewportWidth,
        readonly: readonlyProp,
        updateSelection,
        setFocusedCell,
        setExpandedCell,
        setEditingCell,
        setSidebarRowData,
        setSidebarOpen,
        handleRowClick,
        handleCellDoubleClick,
        handleContextMenu,
        handleEditCommit,
        commitEditWithValue,
        handleKeyDown,
        onForeignKeyShowPanel,
        onForeignKeyHidePanel,
        onForeignKeyNavigate,
        onPendingChange,
        onPendingInsertionChange,
        openJsonViewerWindow,
        buildRowDataWithPending,
        editInputRef,
      }),
      [
        columns,
        autoIncrementColumns,
        defaultValueColumns,
        nullableColumns,
        pkColumns,
        pendingChanges,
        columnTypeMap,
        columnLengthMap,
        resultColorClassMap,
        isJsonCellTarget,
        fksByColumn,
        t,
        mergedRows,
        pkIndexMaps,
        parentViewportWidth,
        readonlyProp,
        updateSelection,
        setFocusedCell,
        setExpandedCell,
        setEditingCell,
        setSidebarRowData,
        setSidebarOpen,
        handleRowClick,
        handleCellDoubleClick,
        handleContextMenu,
        handleEditCommit,
        commitEditWithValue,
        handleKeyDown,
        onForeignKeyShowPanel,
        onForeignKeyHidePanel,
        onForeignKeyNavigate,
        onPendingChange,
        onPendingInsertionChange,
        openJsonViewerWindow,
        buildRowDataWithPending,
        editInputRef,
      ],
    );

    const contextPkVal =
      contextMenu && pkIndexMaps.length > 0 && pkColumns
        ? serializePkKey(buildPkMap(pkColumns, contextMenu.row, pkIndexMaps))
        : null;
    const contextIsInsertion = contextMenu?.mergedRow?.type === "insertion";
    const canRevertContextRow = Boolean(
      contextMenu &&
        (contextIsInsertion ||
          (!contextIsInsertion &&
            contextPkVal &&
            (pendingChanges?.[contextPkVal] !== undefined ||
              pendingDeletions?.[contextPkVal] !== undefined))),
    );

    const previewReferencedFromContext = useCallback(
      (foreignKey: ForeignKey, value: unknown) => {
        if (!contextMenu || !onForeignKeyShowPanel) return;
        setFocusedCell({
          rowIndex: contextMenu.rowIndex,
          colIndex: contextMenu.colIndex,
        });
        updateSelection(new Set());
        onForeignKeyShowPanel(foreignKey, value);
        setContextMenu(null);
      },
      [contextMenu, onForeignKeyShowPanel, updateSelection],
    );

    const navigateReferencedFromContext = useCallback(
      (foreignKey: ForeignKey, value: unknown) => {
        if (!onForeignKeyNavigate) return;
        onForeignKeyNavigate(foreignKey, value);
        setContextMenu(null);
      },
      [onForeignKeyNavigate],
    );

    const handleHeaderContextMenu = useCallback(
      (event: React.MouseEvent, colName: string) => {
        event.preventDefault();
        setHeaderContextMenu({
          x: event.clientX,
          y: event.clientY,
          colName,
        });
      },
      [],
    );

    const virtualItems = rowVirtualizer.getVirtualItems();
    const virtualPaddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const virtualPaddingBottom =
      virtualItems.length > 0
        ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
        : 0;
    const totalColumnCount = tableColumns.length + 1;

    if (columns.length === 0) {
      return (
        <div className="h-full flex items-center justify-center text-muted">
          {t("dataGrid.noData")}
        </div>
      );
    }

    return (
      <>
        <div
          ref={parentRef}
          className="h-full overflow-auto border border-default rounded bg-elevated relative"
        >
          <table className="w-full text-left border-collapse">
            <DataGridHeader
              headerGroups={table.getHeaderGroups()}
              sticky={stickyColumnHeaders}
              onSelectAll={handleSelectAll}
              onHeaderContextMenu={handleHeaderContextMenu}
            />
            <DataGridBody
              virtualItems={virtualItems}
              virtualPaddingTop={virtualPaddingTop}
              virtualPaddingBottom={virtualPaddingBottom}
              totalColumnCount={totalColumnCount}
              tableRows={tableRows}
              mergedRows={mergedRows}
              selectedRowIndices={selectedRowIndices}
              pendingDeletions={pendingDeletions}
              pkColumns={pkColumns}
              pkIndexMaps={pkIndexMaps}
              editingCell={editingCell}
              focusedCell={focusedCell}
              expandedCell={expandedCell}
              rowContext={rowCtx}
            />
          </table>

          <DataGridContextMenus
            contextMenu={contextMenu}
            headerContextMenu={headerContextMenu}
            readonly={readonlyProp}
            autoIncrementColumns={autoIncrementColumns}
            nullableColumns={nullableColumns}
            defaultValueColumns={defaultValueColumns}
            columnTypeMap={columnTypeMap}
            selectedRowIndices={selectedRowIndices}
            pendingChanges={pendingChanges}
            pendingDeletions={pendingDeletions}
            canRevert={canRevertContextRow}
            fksByColumn={fksByColumn}
            onForeignKeyShowPanel={onForeignKeyShowPanel}
            onForeignKeyNavigate={onForeignKeyNavigate}
            onPreviewReferenced={previewReferencedFromContext}
            onNavigateReferenced={navigateReferencedFromContext}
            onCloseContextMenu={() => setContextMenu(null)}
            onCloseHeaderContextMenu={() => setHeaderContextMenu(null)}
            onSetGenerate={setCellGenerate}
            onSetNull={setCellNull}
            onSetDefault={setCellDefault}
            onSetEmpty={setCellEmpty}
            onSetServerNow={setCellServerNow}
            onOpenJsonEditor={openJsonEditor}
            onCopyCell={copyCellFromContext}
            onCopyRows={copySelectedOrContextRow}
            onOpenSidebar={openSidebarEditor}
            onDuplicateRow={duplicateSelectedRow}
            onDeleteRow={deleteSelectedRow}
            onRevertRow={revertSelectedRow}
            onCopyHeaderName={copyHeaderName}
            onCopyHeaderNameQuoted={copyHeaderNameQuoted}
            onCopyHeaderNameTable={copyHeaderNameTable}
            connectionId={connectionId}
            tableName={tableName}
            schema={activeSchema}
            mergedRows={mergedRows}
            t={t}
          />

          {/* Row Editor Sidebar */}
          {sidebarOpen &&
            sidebarRowData &&
            (() => {
              const mergedRow = mergedRows[sidebarRowData.rowIndex];
              const isInsertion = mergedRow?.type === "insertion";
              const originalRowData =
                mergedRow && mergedRow.type === "existing"
                  ? columns.reduce<Record<string, unknown>>((acc, col, idx) => {
                      acc[col] = mergedRow.rowData[idx];
                      return acc;
                    }, {})
                  : undefined;

              return (
                <RowEditorSidebar
                  isOpen={sidebarOpen}
                  onClose={() => {
                    setSidebarOpen(false);
                    setSidebarRowData(null);
                  }}
                  rowData={sidebarRowData.data}
                  originalRowData={originalRowData}
                  detectJsonInTextColumns={detectJsonInTextColumns}
                  rowIndex={sidebarRowData.rowIndex}
                  isInsertion={isInsertion}
                  columns={columns.map((colName) => {
                    const meta = columnMetadata?.find(
                      (c) => c.name === colName,
                    );
                    return {
                      name: colName,
                      type: meta?.data_type,
                      characterMaximumLength:
                        meta?.character_maximum_length,
                    };
                  })}
                  autoIncrementColumns={autoIncrementColumns}
                  defaultValueColumns={defaultValueColumns}
                  nullableColumns={nullableColumns}
                  focusField={sidebarRowData.focusField}
                  connectionId={connectionId}
                  tableName={tableName}
                  pkColumns={pkColumns}
                  schema={activeSchema}
                  onChange={(colName, value) => {
                    // Get the merged row to determine if it's an insertion or existing row
                    const mergedRow = mergedRows[sidebarRowData.rowIndex];
                    if (!mergedRow) return;

                    const isInsertion = mergedRow.type === "insertion";

                    // Apply change immediately
                    if (
                      isInsertion &&
                      onPendingInsertionChange &&
                      mergedRow.tempId
                    ) {
                      // Handle insertion row updates
                      onPendingInsertionChange(
                        mergedRow.tempId,
                        colName,
                        value,
                      );
                    } else if (
                      !isInsertion &&
                      onPendingChange &&
                      pkColumns &&
                      pkIndexMaps.length > 0
                    ) {
                      // Handle existing row updates
                      const rowData = mergedRow.rowData;
                      if (rowData) {
                        const pkMapVal = buildPkMap(pkColumns, rowData, pkIndexMaps);
                        onPendingChange(pkMapVal, colName, value);
                      }
                    }
                  }}
                />
              );
            })()}
        </div>
      </>
    );
  },
);
