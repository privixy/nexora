import type { ConnectionParamsDto } from "./contracts/connections";
import { invokeTauri } from "./transport";

function invokeConnection<T>(command: string): Promise<T>;
function invokeConnection<T>(command: string, payload: Record<string, unknown>): Promise<T>;
function invokeConnection<T>(command: string, payload?: Record<string, unknown>) {
  return arguments.length === 1
    ? invokeTauri<T>(command)
    : invokeTauri<T>(command, payload as Record<string, unknown>);
}

export const connectionGateway = {
  invoke: invokeConnection,
  createConnection(payload: { params: ConnectionParamsDto }) {
    return invokeTauri("create_connection", payload);
  },
  updateConnection(payload: { params: ConnectionParamsDto; connection_id: string }) {
    return invokeTauri("update_connection", payload);
  },
  testConnection(payload: Record<string, unknown>) {
    return invokeTauri<string>("test_connection", payload);
  },
  getConnections<T>() {
    return invokeTauri<T>("get_connections");
  },
  listDatabases<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("list_databases", payload);
  },
  saveConnection<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("save_connection", payload);
  },
  updateSavedConnection(payload: Record<string, unknown>) {
    return invokeTauri("update_connection", payload);
  },
  setConnectionAppearance(payload: Record<string, unknown>) {
    return invokeTauri("set_connection_appearance", payload);
  },
  deleteConnectionIcon(payload: { relativePath: string }) {
    return invokeTauri("delete_connection_icon", payload);
  },
};
