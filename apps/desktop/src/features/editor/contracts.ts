import type { Edge, Node } from "@xyflow/react";
import type { ForeignKey, SchemaTable } from "../schema";
import type { DatabaseContextTuple } from "../connections";

export interface Pagination {
  page: number;
  page_size: number;
  total_rows: number | null;
  has_more: boolean;
}
export interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
  default_value?: string;
  character_maximum_length?: number;
}
export type TableSchema = SchemaTable;
export interface SchemaCache {
  data: TableSchema[];
  version: number;
  timestamp: number;
}
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  affected_rows: number;
  truncated?: boolean;
  pagination?: Pagination;
  additional_results?: QueryResult[];
}
export interface BatchStatementResult {
  result: QueryResult | null;
  error: string | null;
  execution_time_ms: number | null;
}
export interface QueryResultEntry {
  id: string;
  queryIndex: number;
  query: string;
  label?: string;
  result: QueryResult | null;
  error: string;
  executionTime: number | null;
  isLoading: boolean;
  page: number;
  activeTable: string | null;
  pkColumns: string[] | null;
}
export interface FlowState {
  nodes: Node[];
  edges: Edge[];
}
export interface PendingInsertion {
  tempId: string;
  data: Record<string, unknown>;
  displayIndex: number;
}
export type LegacyNotebookCellType = "sql" | "markdown";
export type LegacyNotebookChartType = "bar" | "line" | "pie";
export interface LegacyNotebookCellChartConfig {
  type: LegacyNotebookChartType;
  labelColumn: string;
  valueColumns: string[];
}
export interface LegacyNotebookParam {
  name: string;
  value: string;
}
export interface LegacyNotebookCellExecutionEntry {
  query: string;
  result: QueryResult | null;
  error?: string;
  executionTime: number | null;
  timestamp: number;
}
export interface LegacyNotebookCell {
  id: string;
  type: LegacyNotebookCellType;
  content: string;
  name?: string;
  schema?: string;
  result?: QueryResult | null;
  error?: string;
  executionTime?: number | null;
  isLoading?: boolean;
  isPreview?: boolean;
  chartConfig?: LegacyNotebookCellChartConfig | null;
  resultHeight?: number;
  isParallel?: boolean;
  isCollapsed?: boolean;
  isQueryCollapsed?: boolean;
  isResultCollapsed?: boolean;
  isChartVisible?: boolean;
  history?: LegacyNotebookCellExecutionEntry[];
}
export interface LegacyNotebookState {
  cells: LegacyNotebookCell[];
  stopOnError?: boolean;
  params?: LegacyNotebookParam[];
}
export interface Tab {
  id: string;
  title: string;
  type: "console" | "table" | "query_builder" | "notebook";
  query: string;
  result: QueryResult | null;
  error: string;
  executionTime: number | null;
  page: number;
  activeTable: string | null;
  pkColumns: string[] | null;
  autoIncrementColumns?: string[];
  defaultValueColumns?: string[];
  nullableColumns?: string[];
  columnMetadata?: TableColumn[];
  foreignKeys?: ForeignKey[];
  isLoading?: boolean;
  connectionId: string;
  flowState?: FlowState;
  pendingChanges?: Record<string, { pkOriginalValue: unknown; changes: Record<string, unknown> }>;
  pendingDeletions?: Record<string, unknown>;
  pendingInsertions?: Record<string, PendingInsertion>;
  selectedRows?: number[];
  isEditorOpen?: boolean;
  filterClause?: string;
  sortClause?: string;
  limitClause?: number;
  queryParams?: Record<string, string>;
  database?: string;
  schema?: string;
  readOnly?: boolean;
  materialized?: boolean;
  results?: QueryResultEntry[];
  activeResultId?: string;
  notebookId?: string;
  notebookState?: LegacyNotebookState;
}
export interface EditorPreferences {
  tabs: Tab[];
  active_tab_id: string | null;
}
export interface NotebookMetadata {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface EditorNotebookAdapter {
  loadNotebooks(connectionId: string): Promise<readonly NotebookMetadata[]>;
  openNotebook(notebookId: string, context: DatabaseContextTuple): Promise<void>;
  migrateLegacyNotebook(input: unknown, context: DatabaseContextTuple): Promise<NotebookMetadata>;
  flush(connectionId: string): Promise<void>;
}
export interface EditorContextType {
  tabs: Tab[];
  activeTabId: string | null;
  activeTab: Tab | null;
  addTab: (tab?: Partial<Tab>) => string;
  openNotebook: (connectionId: string, notebookId: string, title: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToLeft: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  updateTab: (id: string, partial: Partial<Tab>) => void;
  updateResultEntry: (tabId: string, entryId: string, partial: Partial<QueryResultEntry>) => void;
  setActiveTabId: (id: string) => void;
  getSchema: (connectionId: string, schemaVersion?: number, schema?: string, database?: string) => Promise<TableSchema[]>;
}
export interface ColumnAggregation {
  function?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "COUNT_DISTINCT";
  alias?: string;
  order?: number;
}
export interface ColumnAlias {
  alias?: string;
  order?: number;
}
export interface TableNodeData extends Record<string, unknown> {
  label: string;
  database?: string;
  schema?: string;
  columns: { name: string; type: string }[];
  selectedColumns: Record<string, boolean>;
  columnAggregations: Record<string, ColumnAggregation>;
  columnAliases: Record<string, ColumnAlias>;
  onColumnCheck: (column: string, checked: boolean) => void;
  onColumnAggregation: (column: string, aggregation: ColumnAggregation) => void;
  onColumnAlias: (column: string, alias: string, order?: number) => void;
  onDelete?: () => void;
}
