import { invoke } from "@tauri-apps/api/core";

export function invokeTauri<T>(command: string): Promise<T>;
export function invokeTauri<T>(command: string, payload: Record<string, unknown>): Promise<T>;
export function invokeTauri<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  return arguments.length === 1 ? invoke<T>(command) : invoke<T>(command, payload);
}
