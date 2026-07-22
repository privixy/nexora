export type {
  CellChartConfig,
  CellExecutionEntry,
  ChartType,
  NotebookCell,
  NotebookCellType,
  NotebookEditorAdapter,
  NotebookFile,
  NotebookMetadata,
  NotebookParam,
  NotebookState,
  RunAllResult,
} from "./contracts";

export { NotebookView } from "./components/NotebookView";
export {
  NOTEBOOKS_CHANGED_EVENT,
  createNotebook,
  createNotebookFromState,
  deleteNotebook,
  flushAllPendingSaves,
  listNotebooks,
  loadNotebook,
  renameNotebook,
} from "./lib/notebookStore";
export { deserializeNotebook, serializeNotebook } from "./lib/notebookFile";
export { exportNotebookToHtml } from "./lib/notebookHtmlExport";

import type { EditorNotebookAdapter } from "../editor";
import {
  createNotebookFromState,
  flushAllPendingSaves,
  listNotebooks,
  loadNotebook,
} from "./lib/notebookStore";

export const editorNotebookAdapter: EditorNotebookAdapter = {
  loadNotebooks: listNotebooks,
  async openNotebook(notebookId, context) {
    await loadNotebook(notebookId, context.connectionId);
  },
  async migrateLegacyNotebook(input, context) {
    const title = "Notebook";
    const { notebookId } = await createNotebookFromState(title, input as never, context.connectionId);
    return { id: notebookId, title };
  },
  async flush() {
    await flushAllPendingSaves();
  },
};
