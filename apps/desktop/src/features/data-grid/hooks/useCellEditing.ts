import { useCallback, useEffect, useRef, useState } from "react";
import { recordGateway } from "../../../platform/tauri";
import { buildPkMap, type MergedRow } from "../lib/dataGrid";

export interface EditingCell {
  rowIndex: number;
  colIndex: number;
  value: unknown;
  isRawSql?: boolean;
}

interface UseCellEditingOptions {
  columns: string[];
  mergedRows: MergedRow[];
  tableName?: string | null;
  pkColumns?: string[] | null;
  pkIndexMaps: number[];
  connectionId?: string | null;
  database?: string;
  schema?: string;
  activeDatabase?: string | null;
  activeSchema?: string | null;
  onRefresh?: () => void;
  onPendingChange?: (pkVal: unknown, colName: string, value: unknown) => void;
  onPendingInsertionChange?: (
    tempId: string,
    colName: string,
    value: unknown,
  ) => void;
  showAlert: (
    message: string,
    options: { title: string; kind: "error" },
  ) => void;
  t: (key: string) => string;
}

export function useCellEditing({
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
}: UseCellEditingOptions) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const editingCellRef = useRef(editingCell);
  const isCommittingRef = useRef(false);

  useEffect(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);

  const handleEditCommit = useCallback(async () => {
    if (isCommittingRef.current) return;
    const currentEditingCell = editingCellRef.current;
    if (!currentEditingCell || !tableName) {
      setEditingCell(null);
      return;
    }

    isCommittingRef.current = true;

    try {
      const { rowIndex, colIndex, value } = currentEditingCell;
      if (!mergedRows || rowIndex >= mergedRows.length) {
        console.warn("Invalid rowIndex in handleEditCommit");
        setEditingCell(null);
        return;
      }

      const mergedRow = mergedRows[rowIndex];
      if (mergedRow?.type === "insertion") {
        if (onPendingInsertionChange && mergedRow.tempId) {
          onPendingInsertionChange(mergedRow.tempId, columns[colIndex], value);
        }
        setEditingCell(null);
        return;
      }

      const row = mergedRow.rowData;
      if (!row) {
        console.warn("Invalid row data in handleEditCommit");
        setEditingCell(null);
        return;
      }

      const originalValue = row[colIndex];
      const isUnchanged = String(value) === String(originalValue);
      if (isUnchanged && !onPendingChange) {
        setEditingCell(null);
        return;
      }
      if (pkIndexMaps.length === 0 || !pkColumns) {
        setEditingCell(null);
        return;
      }

      const pkMapVal = buildPkMap(pkColumns, row, pkIndexMaps);
      const colName = columns[colIndex];
      if (onPendingChange) {
        onPendingChange(pkMapVal, colName, isUnchanged ? undefined : value);
        setEditingCell(null);
        return;
      }
      if (!connectionId) return;

      try {
        await recordGateway.updateRecord({
          connectionId,
          table: tableName,
          pkMap: pkMapVal,
          colName,
          newVal: value,
          ...(database ?? activeDatabase
            ? { database: database ?? activeDatabase }
            : {}),
          ...(schema ?? activeSchema ? { schema: schema ?? activeSchema } : {}),
        });
        if (onRefresh) onRefresh();
      } catch (e) {
        console.error("Update failed:", e);
        showAlert(t("dataGrid.updateFailed") + e, {
          title: t("common.error"),
          kind: "error",
        });
      }
      setEditingCell(null);
    } finally {
      isCommittingRef.current = false;
    }
  }, [
    tableName,
    mergedRows,
    columns,
    onPendingInsertionChange,
    onPendingChange,
    pkIndexMaps,
    pkColumns,
    connectionId,
    database,
    schema,
    activeDatabase,
    activeSchema,
    onRefresh,
    showAlert,
    t,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentEditingCell = editingCellRef.current;
      if (event.key === "Enter") {
        handleEditCommit();
      } else if (event.key === "Escape") {
        setEditingCell(null);
      } else if (event.key === "Tab") {
        event.preventDefault();
        if (!currentEditingCell) return;
        handleEditCommit();

        const { rowIndex, colIndex } = currentEditingCell;
        let nextRowIndex = rowIndex;
        let nextColIndex = colIndex + 1;
        if (nextColIndex >= columns.length) {
          nextColIndex = 0;
          nextRowIndex = rowIndex + 1;
          if (nextRowIndex >= mergedRows.length) {
            nextRowIndex = 0;
          }
        }

        const nextRow = mergedRows[nextRowIndex];
        if (nextRow) {
          const nextValue = nextRow.rowData[nextColIndex];
          setTimeout(() => {
            setEditingCell({
              rowIndex: nextRowIndex,
              colIndex: nextColIndex,
              value: nextValue,
            });
          }, 0);
        }
      }
    },
    [handleEditCommit, mergedRows, columns],
  );

  const commitEditWithValue = useCallback(
    (value: unknown) => {
      if (editingCellRef.current) {
        editingCellRef.current = { ...editingCellRef.current, value };
      }
      handleEditCommit();
    },
    [handleEditCommit],
  );

  return {
    editingCell,
    setEditingCell,
    editingCellRef,
    handleEditCommit,
    handleKeyDown,
    commitEditWithValue,
  };
}
