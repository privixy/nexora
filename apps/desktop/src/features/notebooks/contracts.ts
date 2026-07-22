import type { EditorNotebookAdapter, QueryResult } from "../editor";

export type NotebookCellType = "sql" | "markdown";
export type ChartType = "bar" | "line" | "pie";
export interface CellChartConfig {
  type: ChartType;
  labelColumn: string;
  valueColumns: string[];
}
export interface RunAllResult {
  total: number;
  executed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ cellId: string; cellIndex: number; error: string }>;
}
export interface NotebookParam {
  name: string;
  value: string;
}
export interface CellExecutionEntry {
  query: string;
  result: QueryResult | null;
  error?: string;
  executionTime: number | null;
  timestamp: number;
}
export interface NotebookCell {
  id: string;
  type: NotebookCellType;
  content: string;
  name?: string;
  schema?: string;
  result?: QueryResult | null;
  error?: string;
  executionTime?: number | null;
  isLoading?: boolean;
  isPreview?: boolean;
  chartConfig?: CellChartConfig | null;
  resultHeight?: number;
  isParallel?: boolean;
  isCollapsed?: boolean;
  isQueryCollapsed?: boolean;
  isResultCollapsed?: boolean;
  isChartVisible?: boolean;
  history?: CellExecutionEntry[];
}
export interface NotebookState {
  cells: NotebookCell[];
  stopOnError?: boolean;
  params?: NotebookParam[];
}
export interface NotebookFile {
  version: number;
  title: string;
  createdAt: string;
  connectionId?: string;
  cells: Array<{
    type: NotebookCellType;
    content: string;
    name?: string;
    schema?: string;
    chartConfig?: CellChartConfig | null;
    isParallel?: boolean;
    isCollapsed?: boolean;
    isQueryCollapsed?: boolean;
    isResultCollapsed?: boolean;
    isChartVisible?: boolean;
  }>;
  params?: NotebookParam[];
  stopOnError?: boolean;
}
export interface NotebookMetadata {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}
export type NotebookEditorAdapter = EditorNotebookAdapter;
