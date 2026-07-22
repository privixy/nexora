import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeTauri } from "./transport";

export const windowGateway = {
  getCurrentWindow,
  openConnectionWindow(payload: Record<string, unknown>) {
    return invokeTauri("open_connection_window", payload);
  },
  setWindowTitle(payload: { title: string }) {
    return invokeTauri("set_window_title", payload);
  },
};
