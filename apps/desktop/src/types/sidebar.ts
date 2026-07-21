import type { SavedQuery } from "../contexts/SavedQueriesContext";
import type { RoutineInfo } from "../contexts/DatabaseContext";
import type { QueryHistoryEntry } from "./queryHistory";

export type ContextMenuData =
  | SavedQuery
  | { tableName: string; database?: string; schema?: string }
  | (RoutineInfo & { database?: string; schema?: string })
  | QueryHistoryEntry;
