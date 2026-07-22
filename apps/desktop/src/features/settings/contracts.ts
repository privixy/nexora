import type { AppLanguage } from "../../i18n/config";

export type { AppLanguage };
export type CopyFormat = "csv" | "json" | "sql-insert";
export type AiProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "ollama"
  | "custom-openai"
  | "minimax";
export type ERDiagramLayout = "LR" | "TB";

export interface PluginConfig {
  interpreter?: string;
  settings?: Record<string, unknown>;
}

export interface Settings {
  resultPageSize: number;
  language: AppLanguage;
  displayTimezone?: string;
  fontFamily: string;
  fontSize: number;
  resultColorByType?: boolean;
  resultTypeColors?: Record<string, string>;
  stickyColumnHeaders?: boolean;
  aiEnabled: boolean;
  aiProvider: AiProvider | null;
  aiModel: string | null;
  aiCustomModels?: Record<string, string[]>;
  aiOllamaPort?: number;
  aiCustomOpenaiUrl?: string;
  aiCustomOpenaiModel?: string;
  autoCheckUpdatesOnStartup?: boolean;
  loggingEnabled?: boolean;
  maxLogEntries?: number;
  erDiagramDefaultLayout?: ERDiagramLayout;
  copyFormat?: CopyFormat;
  csvDelimiter?: string;
  csvIncludeHeaders?: boolean;
  activeExternalDrivers?: string[];
  plugins?: Record<string, PluginConfig>;
  editorTheme?: string;
  editorFontFamily?: string;
  editorFontSize?: number;
  editorLineHeight?: number;
  editorTabSize?: number;
  editorWordWrap?: boolean;
  editorShowLineNumbers?: boolean;
  editorAcceptSuggestionOnEnter?: boolean;
  pingInterval?: number;
  queryHistoryMaxEntries?: number;
  showWelcome?: boolean;
  autoConnectLastConnection?: boolean;
  startMaximized?: boolean;
  aiAuditEnabled?: boolean;
  aiAuditMaxEntries?: number;
  aiSessionGapMinutes?: number;
  mcpReadonlyDefault?: boolean;
  mcpReadonlyConnections?: string[];
  mcpApprovalMode?: "off" | "writes_only" | "all";
  mcpApprovalTimeoutSeconds?: number;
  mcpPreflightExplain?: boolean;
  mcpApprovalAlwaysOnTop?: boolean;
  mcpApprovalNotifySound?: boolean;
}

export interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  isLoading: boolean;
  isLanguageReady: boolean;
  isLanguageSettled: boolean;
}

export type AiQueryKind = "select" | "write" | "ddl" | "unknown";
export type AiActivityStatus =
  | "success"
  | "blocked_readonly"
  | "blocked_pending_approval"
  | "denied"
  | "error"
  | "timeout";
export type AiToolName =
  | "list_connections"
  | "list_databases"
  | "list_tables"
  | "describe_table"
  | "run_query"
  | (string & {});

export interface AiActivityEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  tool: AiToolName;
  connectionId: string | null;
  connectionName: string | null;
  query: string | null;
  queryKind: AiQueryKind | null;
  durationMs: number;
  status: AiActivityStatus;
  rows: number | null;
  error: string | null;
  clientHint: string | null;
  approvalId: string | null;
}

export interface AiSessionSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  runQueryCount: number;
  connectionNames: string[];
  clientHint: string | null;
}

export interface AiEventFilter {
  sessionId?: string;
  connectionId?: string;
  tool?: string;
  status?: AiActivityStatus;
  queryContains?: string;
  since?: string;
  until?: string;
}

export interface PendingApproval {
  id: string;
  createdAt: string;
  sessionId: string;
  connectionId: string;
  connectionName: string;
  query: string;
  queryKind: AiQueryKind;
  clientHint: string | null;
  explainPlan: unknown | null;
  explainError: string | null;
}

export type ApprovalDecisionKind = "approve" | "deny";
export interface ApprovalDecisionPayload {
  approvalId: string;
  decision: ApprovalDecisionKind;
  reason?: string;
  editedQuery?: string;
}
export type McpApprovalMode = "off" | "writes_only" | "all";

export interface AiNotebookExportCell {
  type: "sql" | "markdown";
  content: string;
  name?: string;
  schema?: string;
}

export interface AiNotebookExport {
  version: number;
  title: string;
  createdAt: string;
  cells: AiNotebookExportCell[];
}
