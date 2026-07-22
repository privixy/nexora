import type { Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { buildPkMap, serializePkKey, type MergedRow } from "../lib/dataGrid";
import { MemoRow, type RowCtx } from "./DataGridRow";

interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

interface DataGridBodyProps {
  virtualItems: VirtualItem[];
  virtualPaddingTop: number;
  virtualPaddingBottom: number;
  totalColumnCount: number;
  tableRows: Row<unknown[]>[];
  mergedRows: MergedRow[];
  selectedRowIndices: Set<number>;
  pendingDeletions?: Record<string, unknown>;
  pkColumns?: string[] | null;
  pkIndexMaps: number[];
  editingCell: (CellPosition & { value: unknown }) | null;
  focusedCell: CellPosition | null;
  expandedCell: (CellPosition & { kind: "json" | "text" }) | null;
  rowContext: RowCtx;
}

export function DataGridBody({
  virtualItems,
  virtualPaddingTop,
  virtualPaddingBottom,
  totalColumnCount,
  tableRows,
  mergedRows,
  selectedRowIndices,
  pendingDeletions,
  pkColumns,
  pkIndexMaps,
  editingCell,
  focusedCell,
  expandedCell,
  rowContext,
}: DataGridBodyProps) {
  return (
    <tbody>
      {virtualPaddingTop > 0 && (
        <tr>
          <td
            colSpan={totalColumnCount}
            style={{ height: virtualPaddingTop, padding: 0, border: "none" }}
          />
        </tr>
      )}
      {virtualItems.map((virtualRow) => {
        const rowIndex = virtualRow.index;
        const row = tableRows[rowIndex];
        const rowOriginal = row.original as unknown[];
        const isSelected = selectedRowIndices.has(rowIndex);
        const mergedRow = mergedRows[rowIndex];
        const isInsertion = mergedRow?.type === "insertion";
        const pkVal =
          pkIndexMaps.length > 0 && pkColumns
            ? serializePkKey(buildPkMap(pkColumns, rowOriginal, pkIndexMaps))
            : null;
        const isPendingDelete =
          !isInsertion && pkVal
            ? pendingDeletions?.[pkVal] !== undefined
            : false;
        const isRowEditing = editingCell?.rowIndex === rowIndex;
        const isRowFocused = focusedCell?.rowIndex === rowIndex;
        const isRowExpanded = expandedCell?.rowIndex === rowIndex;
        return (
          <MemoRow
            key={row.id}
            ctx={rowContext}
            rowIndex={rowIndex}
            rowOriginal={rowOriginal}
            isSelected={isSelected}
            isInsertion={isInsertion}
            isPendingDelete={isPendingDelete}
            pkVal={pkVal}
            editingColIndex={isRowEditing ? editingCell.colIndex : null}
            editingValue={isRowEditing ? editingCell.value : undefined}
            focusedColIndex={isRowFocused ? focusedCell.colIndex : null}
            expandedColIndex={isRowExpanded ? expandedCell.colIndex : null}
            expandedKind={isRowExpanded ? expandedCell.kind : null}
          />
        );
      })}
      {virtualPaddingBottom > 0 && (
        <tr>
          <td
            colSpan={totalColumnCount}
            style={{ height: virtualPaddingBottom, padding: 0, border: "none" }}
          />
        </tr>
      )}
    </tbody>
  );
}
