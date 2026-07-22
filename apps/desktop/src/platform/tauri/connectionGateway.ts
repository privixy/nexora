import type { ConnectionParamsDto } from "./contracts/connections";
import { invokeTauri } from "./transport";

export const connectionGateway = {
  createConnection(payload: { params: ConnectionParamsDto }) {
    return invokeTauri("create_connection", payload);
  },
  updateConnection(payload: { params: ConnectionParamsDto; connection_id: string }) {
    return invokeTauri("update_connection", payload);
  },
  testConnection(payload: { params: ConnectionParamsDto; connection_id?: string }) {
    return invokeTauri<string>("test_connection", payload);
  },
  getConnections<T>() {
    return invokeTauri<T>("get_connections");
  },
};
