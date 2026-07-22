import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { EditorErrorBoundary } from "../components/ui/EditorErrorBoundary";
import { Connections } from "../pages/Connections";
import { Editor } from "../pages/Editor";
import { JsonViewerPage } from "../pages/JsonViewerPage";
import { McpPage } from "../pages/McpPage";
import { ResultsWindowPage } from "../pages/ResultsWindowPage";
import { SchemaDiagramPage } from "../features/schema";
import { SettingsPage } from "../features/settings";
import { TaskManagerPage } from "../pages/TaskManagerPage";
import { VisualExplainPage } from "../pages/VisualExplainPage";
import { useLegacyPluginSettingsComposition } from "./legacy/pluginSettingsComposition";

export function AppRoutes() {
  const pluginSettingsComposition = useLegacyPluginSettingsComposition();

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route
          index
          element={<Navigate to="/connections" replace />}
        />
        <Route path="connections" element={<Connections />} />
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
        element={<SchemaDiagramPage />}
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
