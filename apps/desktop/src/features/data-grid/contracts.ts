import type { PendingInsertion, TableColumn } from "../../shared/types/queryResults";
import type { ForeignKey } from "../../shared/lib/foreignKeys";

export interface DataGridSelection {
  rows: number[];
}

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

export type JsonInputMode = "code" | "tree" | "raw";

export interface JsonInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  disableExpand?: boolean;
  fillHeight?: boolean;
  originalValue?: unknown;
}

export interface JsonTreeViewProps {
  value: unknown;
  onChange?: (next: unknown) => void;
  readOnly?: boolean;
  searchQuery?: string;
  onCopy?: (text: string) => void;
  fillHeight?: boolean;
}

export interface RowEditorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  rowData: Record<string, unknown>;
  originalRowData?: Record<string, unknown>;
  rowIndex: number;
  isInsertion: boolean;
  columns: Array<{ name: string; type?: string; characterMaximumLength?: number }>;
  autoIncrementColumns?: string[];
  defaultValueColumns?: string[];
  nullableColumns?: string[];
  onChange: (colName: string, value: unknown) => void;
  focusField?: string;
  detectJsonInTextColumns?: boolean;
  connectionId?: string | null;
  database?: string | null;
  tableName?: string | null;
  pkColumns?: string[] | null;
  schema?: string | null;
}

export interface UseRowEditorOptions {
  initialData: Record<string, unknown>;
  onChange?: (fieldName: string, value: unknown) => void;
}

export interface UseRowEditorReturn {
  editedData: Record<string, unknown>;
  updateField: (fieldName: string, value: unknown) => void;
}
