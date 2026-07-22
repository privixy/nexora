import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeTauri } from "./transport";

export const windowGateway = {
  getCurrentWindow,
  openConnectionWindow(payload: Record<string, unknown>) {
    return invokeTauri("open_connection_window", payload);
  },
  openJsonViewer<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("open_json_viewer_window", payload);
  },
  getJsonViewerSession<T>(payload: { sessionId: string }) {
    return invokeTauri<T>("get_json_viewer_session", payload);
  },
  completeJsonViewerSession(payload: { sessionId: string; value: unknown }) {
    return invokeTauri("complete_json_viewer_session", payload);
  },
  setWindowTitle(payload: { title: string }) {
    return invokeTauri("set_window_title", payload);
  },
};
