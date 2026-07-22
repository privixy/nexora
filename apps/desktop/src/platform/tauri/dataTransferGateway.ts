import { invokeTauri } from "./transport";

function invokeDataTransfer<T>(command: string): Promise<T>;
function invokeDataTransfer<T>(command: string, payload: Record<string, unknown>): Promise<T>;
function invokeDataTransfer<T>(command: string, payload?: Record<string, unknown>) {
  return arguments.length === 1
    ? invokeTauri<T>(command)
    : invokeTauri<T>(command, payload as Record<string, unknown>);
}

export const dataTransferGateway = {
  invoke: invokeDataTransfer,
  dumpDatabase(payload: Record<string, unknown>) {
    return invokeTauri("dump_database", payload);
  },
  importDatabase(payload: Record<string, unknown>) {
    return invokeTauri("import_database", payload);
  },
  cancelExport(payload: Record<string, unknown>) {
    return invokeTauri("cancel_export", payload);
  },
  exportQueryToFile(payload: Record<string, unknown>) {
    return invokeTauri("export_query_to_file", payload);
  },
};
