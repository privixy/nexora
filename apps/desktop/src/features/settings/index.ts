export type {
  AiActivityEvent,
  AiActivityStatus,
  AiEventFilter,
  AiNotebookExport,
  AiNotebookExportCell,
  AiProvider,
  AiQueryKind,
  AiSessionSummary,
  AiToolName,
  AppLanguage,
  ApprovalDecisionKind,
  ApprovalDecisionPayload,
  ApprovalExplainPlanRenderer,
  ApprovalExplainPlanRenderProps,
  ApprovalExplainViewMode,
  CopyFormat,
  ERDiagramLayout,
  McpApprovalMode,
  PendingApproval,
  PluginConfig,
  Settings,
  SettingsContextType,
} from "./contracts";

export { SettingsPage } from "./pages/SettingsPage";
export { SettingsProvider } from "./state/SettingsProvider";
export { ThemeProvider } from "./state/ThemeProvider";
export { UpdateProvider } from "./state/UpdateProvider";
export { DEFAULT_SETTINGS, SettingsContext } from "./state/SettingsContext";
export { ThemeContext } from "./state/ThemeContext";
export { useSettings } from "./hooks/useSettings";
export { useTheme } from "./hooks/useTheme";
export { useUpdate } from "./hooks/useUpdate";
export { useEditorTheme } from "./hooks/useEditorTheme";
export { AiActivityPanel } from "./components/AiActivityPanel";
export type { VisualExplainTarget } from "./components/AiActivityPanel";
export { parseVisualExplainDeepLink } from "./lib/aiActivity";
export { SshTab } from "./components/SshTab";
export {
  SettingButtonGroup,
  SettingNumberInput,
  SettingRow,
  SettingSection,
  SettingSlider,
  SettingToggle,
} from "./components/SettingControls";
export { AiApprovalGate } from "./components/AiApprovalGate";
export type { ApprovalAttentionAdapter } from './components/AiApprovalGate';
