import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export function listenTauri<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(event, ({ payload }) => handler(payload));
}

export function emitTauri<T>(event: string, payload: T): Promise<void> {
  return emit(event, payload);
}
