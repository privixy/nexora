import type { ComponentProps } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { EditorErrorBoundary } from "../components/ui/EditorErrorBoundary";
import { ConnectionsPage, SshConnectionsManager } from "../features/connections";
import { Editor } from "../pages/Editor";
import { EditorSchemaDiagramPage } from "../features/editor";
import { JsonViewerPage } from "../pages/JsonViewerPage";
import { McpPage } from "../features/mcp";
import { ResultsWindowPage } from "../pages/ResultsWindowPage";
import { SettingsPage, SshTab } from "../features/settings";
import { PluginSettingsPage, PluginsTab, useDrivers } from "../features/plugins";
import { TaskManagerPage } from "../pages/TaskManagerPage";
import { VisualExplainPage } from "../pages/VisualExplainPage";

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
    pluginTabs: Array.from(pluginTabs.values()),
    onPluginsChanged: refresh,
    renderPluginTab: (props: ComponentProps<typeof PluginsTab>) => (
      <PluginsTab {...props} />
    ),
    renderPluginSettings: (pluginId: string) => (
      <PluginSettingsPage key={pluginId} pluginId={pluginId} />
    ),
    renderSshTab: () => (
      <SshTab renderConnectionsManager={() => <SshConnectionsManager />} />
    ),
  };

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route
          index
          element={<Navigate to="/connections" replace />}
        />
        <Route path="connections" element={<ConnectionsPage />} />
        <Route
          path="editor"
          element={
            <EditorErrorBoundary>
              <Editor />
            </EditorErrorBoundary>
          }
        />
        <Route path="mcp" element={<McpPage />} />
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
