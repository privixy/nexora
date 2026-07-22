import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { EditorErrorBoundary } from "../components/ui/EditorErrorBoundary";
import { Connections } from "../pages/Connections";
import { Editor } from "../pages/Editor";
import { JsonViewerPage } from "../pages/JsonViewerPage";
import { McpPage } from "../pages/McpPage";
import { ResultsWindowPage } from "../pages/ResultsWindowPage";
import { SchemaDiagramPage } from "../pages/SchemaDiagramPage";
import { Settings } from "../pages/Settings";
import { TaskManagerPage } from "../pages/TaskManagerPage";
import { VisualExplainPage } from "../pages/VisualExplainPage";

export function AppRoutes() {
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
        <Route path="settings" element={<Settings />} />
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
