import type { RoutineInfo } from "../connections";

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connection_id: string;
  database: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface QueryHistoryEntry {
  id: string;
  sql: string;
  executedAt: string;
  executionTimeMs: number | null;
  status: "success" | "error";
  rowsAffected: number | null;
  error: string | null;
  database: string | null;
}
export interface ExplorerObjectContext {
  database?: string;
  schema?: string;
}

export interface ExplorerTableContext extends ExplorerObjectContext {
  tableName: string;
}

export type ContextMenuData =
  | SavedQuery
  | ExplorerTableContext
  | (RoutineInfo & ExplorerObjectContext)
  | QueryHistoryEntry;
