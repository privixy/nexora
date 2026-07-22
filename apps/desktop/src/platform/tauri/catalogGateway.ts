import { invokeTauri } from "./transport";

export const catalogGateway = {
  getDatabases<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("get_databases", payload);
  },
  getSchemas<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("get_schemas", payload);
  },
  getTables<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("get_tables", payload);
  },
  getColumns<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("get_columns", payload);
  },
  getForeignKeys<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("get_foreign_keys", payload);
  },
};
