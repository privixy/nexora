import { invoke } from "@tauri-apps/api/core";
import type { ConnectionParams } from "..";

export interface SavedConnectionWithCredentials {
  id: string;
  name: string;
  params: ConnectionParams;
}

export async function fetchConnectionWithCredentials(
  id: string,
): Promise<SavedConnectionWithCredentials> {
  return await invoke<SavedConnectionWithCredentials>("get_connection_by_id", {
    id,
  });
}
