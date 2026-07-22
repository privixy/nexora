import { invokeTauri } from "./transport";

function invokeQuery<T>(command: string): Promise<T>;
function invokeQuery<T>(command: string, payload: Record<string, unknown>): Promise<T>;
function invokeQuery<T>(command: string, payload?: Record<string, unknown>) {
  return arguments.length === 1
    ? invokeTauri<T>(command)
    : invokeTauri<T>(command, payload as Record<string, unknown>);
}

export const queryGateway = {
  executeQuery<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("execute_query", payload);
  },
  executeBatch<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("execute_query_batch", payload);
  },
  cancelQuery(payload: Record<string, unknown>) {
    return invokeTauri("cancel_query", payload);
  },
  countQuery<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("count_query", payload);
  },
  invoke: invokeQuery,
};
