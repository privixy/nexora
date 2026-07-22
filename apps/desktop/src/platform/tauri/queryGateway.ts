import { invokeTauri } from "./transport";

export const queryGateway = {
  executeQuery<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("execute_query", payload);
  },
};
