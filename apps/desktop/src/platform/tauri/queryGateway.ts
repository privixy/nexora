import { invokeTauri } from "./transport";

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
  invoke<T>(command: string, payload: Record<string, unknown>) {
    return invokeTauri<T>(command, payload);
  },
};
