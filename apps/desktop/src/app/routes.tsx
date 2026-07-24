import type { ComponentProps } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./MainLayout";
import { APP_VERSION } from "./config/version";
import { ConnectionsPage, SshConnectionsManager } from "../features/connections";
import { EditorErrorBoundary, EditorPage, EditorSchemaDiagramPage, ResultsWindowPage, SqlEditorWrapper } from "../features/editor";
import { JsonViewerPage } from "../features/data-grid";
import { McpPage } from "../features/mcp";
import {
  AiActivityPanel,
  SettingsPage,
  SshTab,
  type VisualExplainTarget,
} from "../features/settings";
import { PluginSettingsPage, PluginsTab, useDrivers } from "../features/plugins";
import { TaskManagerPage } from "../features/tasks";
import { createNotebook, NotebookView, renameNotebook } from "../features/notebooks";
import {
  VisualExplainModal,
  VisualExplainPage,
} from "../features/visual-explain";

const renderVisualExplain = (
  target: VisualExplainTarget,
  onClose: () => void,
) => (
  <VisualExplainModal
    isOpen
    onClose={onClose}
    query={target.query}
    connectionId={target.connectionId}
    connectionLabel={target.connectionLabel}
  />
);

const renderAiActivity = () => (
  <AiActivityPanel renderVisualExplain={renderVisualExplain} />
);

export function AppRoutes() {
  const { allDrivers, installedPlugins, refresh } = useDrivers();
  const pluginTabs = new Map<string, { id: string; name: string }>();

  for (const driver of allDrivers) {
    if (driver.is_builtin && (driver.settings?.length ?? 0) === 0) continue;
    pluginTabs.set(driver.id, { id: driver.id, name: driver.name });
  }

  for (const plugin of installedPlugins) {
    pluginTabs.set(plugin.id, { id: plugin.id, name: plugin.name });
  }

  const pluginSettingsComposition = {
    appVersion: APP_VERSION,
    pluginTabs: Array.from(pluginTabs.values()),
    onPluginsChanged: refresh,
    renderPluginTab: (props: Omit<ComponentProps<typeof PluginsTab>, "appVersion">) => (
      <PluginsTab {...props} appVersion={APP_VERSION} />
    ),
    renderPluginSettings: (pluginId: string) => (
      <PluginSettingsPage key={pluginId} pluginId={pluginId} />
    ),
    renderSshTab: () => (
      <SshTab renderConnectionsManager={() => <SshConnectionsManager />} />
    ),
    renderAiActivity,
  };

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route
          index
          element={<Navigate to="/connections" replace />}
        />
        <Route
        path="connections"
        element={<ConnectionsPage SqlEditor={SqlEditorWrapper} />}
      />
        <Route
          path="editor"
          element={
            <EditorErrorBoundary>
              <EditorPage
                notebook={{
                  render: NotebookView,
                  create: createNotebook,
                  rename: renameNotebook,
                }}
                renderVisualExplain={(props) => <VisualExplainModal {...props} />}
              />
            </EditorErrorBoundary>
          }
        />
        <Route
          path="mcp"
          element={<McpPage renderAiActivity={renderAiActivity} />}
        />
        <Route
          path="settings"
          element={<SettingsPage {...pluginSettingsComposition} />}
        />
      </Route>
      <Route
        path="/schema-diagram"
        element={<EditorSchemaDiagramPage />}
      />
      <Route path="/task-manager" element={<TaskManagerPage />} />
      <Route path="/visual-explain" element={<VisualExplainPage />} />
      <Route path="/json-viewer" element={<JsonViewerPage />} />
      <Route
        path="/results-window"
        element={<ResultsWindowPage />}
      />
    </Routes>
  );
}
