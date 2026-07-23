import {
  Ban,
  Braces,
  Clock,
  Copy,
  CopyPlus,
  Edit,
  Eraser,
  ExternalLink,
  FileDigit,
  PanelBottomOpen,
  Sparkles,
  Trash2,
  Undo,
} from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "../../../shared/ui/ContextMenu";
import { SlotAnchor } from "../../../features/plugins";
import { getDateInputMode } from "../../../utils/dateInput";
import { isJsonColumn } from "../../../utils/json";
import { supportsEmptyString } from "../../../shared/lib/text";
import { getForeignKeyForPreview } from "../../schema";
import type { ForeignKey } from "../../../types/editor";
import type { MergedRow } from "../lib/dataGrid";

export interface GridContextMenuState {
  x: number;
  y: number;
  row: unknown[];
  rowIndex: number;
  colIndex: number;
  colName: string;
  mergedRow?: MergedRow;
}

export interface GridHeaderContextMenuState {
  x: number;
  y: number;
  colName: string;
}

interface DataGridContextMenusProps {
  contextMenu: GridContextMenuState | null;
  headerContextMenu: GridHeaderContextMenuState | null;
  readonly: boolean | undefined;
  autoIncrementColumns?: string[];
  nullableColumns?: string[];
  defaultValueColumns?: string[];
  columnTypeMap: Map<string, string> | null;
  selectedRowIndices: Set<number>;
  pendingChanges?: Record<string, unknown>;
  pendingDeletions?: Record<string, unknown>;
  canRevert: boolean;
  fksByColumn: Map<string, ForeignKey>;
  onForeignKeyShowPanel?: (foreignKey: ForeignKey, value: unknown) => void;
  onForeignKeyNavigate?: (foreignKey: ForeignKey, value: unknown) => void;
  onPreviewReferenced: (foreignKey: ForeignKey, value: unknown) => void;
  onNavigateReferenced: (foreignKey: ForeignKey, value: unknown) => void;
  onCloseContextMenu: () => void;
  onCloseHeaderContextMenu: () => void;
  onSetGenerate: () => void;
  onSetNull: () => void;
  onSetDefault: () => void;
  onSetEmpty: () => void;
  onSetServerNow: () => void;
  onOpenJsonEditor: () => void;
  onCopyCell: () => void;
  onCopyRows: () => void;
  onOpenSidebar: () => void;
  onDuplicateRow: () => void;
  onDeleteRow: () => void;
  onRevertRow: () => void;
  onCopyHeaderName: () => void;
  onCopyHeaderNameQuoted: () => void;
  onCopyHeaderNameTable: () => void;
  connectionId?: string | null;
  tableName?: string | null;
  schema?: string | null;
  mergedRows: MergedRow[];
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function DataGridContextMenus({
  contextMenu,
  headerContextMenu,
  readonly,
  autoIncrementColumns,
  nullableColumns,
  defaultValueColumns,
  columnTypeMap,
  selectedRowIndices,
  canRevert,
  fksByColumn,
  onForeignKeyShowPanel,
  onForeignKeyNavigate,
  onPreviewReferenced,
  onNavigateReferenced,
  onCloseContextMenu,
  onCloseHeaderContextMenu,
  onSetGenerate,
  onSetNull,
  onSetDefault,
  onSetEmpty,
  onSetServerNow,
  onOpenJsonEditor,
  onCopyCell,
  onCopyRows,
  onOpenSidebar,
  onDuplicateRow,
  onDeleteRow,
  onRevertRow,
  onCopyHeaderName,
  onCopyHeaderNameQuoted,
  onCopyHeaderNameTable,
  connectionId,
  tableName,
  schema,
  mergedRows,
  t,
}: DataGridContextMenusProps) {
  let rowMenu: React.ReactNode = null;
  if (contextMenu) {
    const isInsertion = contextMenu.mergedRow?.type === "insertion";
    const deleteRowCount = selectedRowIndices.has(contextMenu.rowIndex)
      ? selectedRowIndices.size
      : 1;
    const { colName } = contextMenu;
    const menuItems: ContextMenuItem[] = [];

    if (!readonly) {
      if (autoIncrementColumns?.includes(colName) && isInsertion) {
        menuItems.push({ label: t("dataGrid.setGenerate"), icon: Sparkles, action: onSetGenerate });
      }
      if (nullableColumns?.includes(colName)) {
        menuItems.push({ label: t("dataGrid.setNull"), icon: Ban, action: onSetNull });
      }
      if (defaultValueColumns?.includes(colName)) {
        menuItems.push({ label: t("dataGrid.setDefault"), icon: FileDigit, action: onSetDefault });
      }
      const colDataType = columnTypeMap?.get(colName) ?? "";
      if (supportsEmptyString(colDataType)) {
        menuItems.push({ label: t("dataGrid.setEmpty"), icon: Eraser, action: onSetEmpty });
      }
      if (getDateInputMode(colDataType) !== null) {
        menuItems.push({ label: t("dataGrid.setServerNow"), icon: Clock, action: onSetServerNow });
      }
      if (isJsonColumn(colDataType)) {
        menuItems.push({ label: t("contextMenu.openJsonEditor"), icon: Braces, action: onOpenJsonEditor });
      }
      if (menuItems.length > 0) menuItems.push({ separator: true });
    }

    const contextValue = contextMenu.row[contextMenu.colIndex];
    const foreignKey = getForeignKeyForPreview(
      contextMenu.colName,
      contextValue,
      fksByColumn,
      { isInsertion },
    );
    if (foreignKey) {
      if (onForeignKeyShowPanel) {
        menuItems.push({
          label: t("dataGrid.previewReferenced"),
          icon: PanelBottomOpen,
          action: () => onPreviewReferenced(foreignKey, contextValue),
        });
      }
      if (onForeignKeyNavigate) {
        menuItems.push({
          label: t("dataGrid.openReferenced", { table: foreignKey.ref_table }),
          icon: ExternalLink,
          action: () => onNavigateReferenced(foreignKey, contextValue),
        });
      }
      if (onForeignKeyShowPanel || onForeignKeyNavigate) menuItems.push({ separator: true });
    }

    menuItems.push(
      { label: t("dataGrid.copyCell"), icon: Copy, action: onCopyCell },
      { label: t("dataGrid.copySelectedRows"), icon: Copy, action: onCopyRows },
    );
    if (!readonly) {
      menuItems.push(
        { label: t("contextMenu.openSidebar"), icon: Edit, action: onOpenSidebar },
        { label: t("dataGrid.duplicateRow"), icon: CopyPlus, action: onDuplicateRow },
        {
          label: deleteRowCount > 1
            ? t("dataGrid.deleteRows", { count: deleteRowCount })
            : t("dataGrid.deleteRow"),
          icon: Trash2,
          danger: true,
          action: onDeleteRow,
        },
        {
          label: t("dataGrid.revertSelected"),
          icon: Undo,
          action: onRevertRow,
          disabled: !canRevert,
        },
      );
    }

    rowMenu = (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={onCloseContextMenu}
        items={menuItems}
      >
        <SlotAnchor
          name="data-grid.context-menu.items"
          context={{
            connectionId,
            tableName,
            schema,
            columnName: contextMenu.colName,
            rowIndex: contextMenu.rowIndex,
            rowData: mergedRows[contextMenu.rowIndex]?.rowData as unknown as
              | Record<string, unknown>
              | undefined,
          }}
          className="border-t border-default mt-1 pt-1"
        />
      </ContextMenu>
    );
  }

  return (
    <>
      {rowMenu}
      {headerContextMenu && (
        <ContextMenu
          x={headerContextMenu.x}
          y={headerContextMenu.y}
          onClose={onCloseHeaderContextMenu}
          items={[
            { label: t("dataGrid.copyColumnName"), icon: Copy, action: onCopyHeaderName },
            { label: t("dataGrid.copyColumnNameQuoted"), icon: Copy, action: onCopyHeaderNameQuoted },
            { label: t("dataGrid.copyColumnNameTable"), icon: Copy, action: onCopyHeaderNameTable },
          ]}
        />
      )}
    </>
  );
}
