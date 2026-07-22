import type { EditorNotebookAdapter } from "../features/editor";
import {
  createNotebookFromState,
  flushAllPendingSaves,
  listNotebooks,
  loadNotebook,
} from "../utils/notebookStore";

export const legacyEditorNotebookAdapter: EditorNotebookAdapter = {
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
