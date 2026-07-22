import { invokeTauri } from "./transport";

function invokeOwner<T>(command: string): Promise<T>;
function invokeOwner<T>(command: string, payload: Record<string, unknown>): Promise<T>;
function invokeOwner<T>(command: string, payload?: Record<string, unknown>) {
  return arguments.length === 1
    ? invokeTauri<T>(command)
    : invokeTauri<T>(command, payload as Record<string, unknown>);
}

export const schemaGateway = { invoke: invokeOwner };
