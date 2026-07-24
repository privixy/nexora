import type { QueryContext } from "./useQueryExecution";

export function buildBatchQueryPayload(payload: QueryContext & {
  queries: string[];
  limit: number;
  page: number;
  batchId: string;
}) {
  const { connectionId, database, schema, ...rest } = payload;
  return {
    connectionId,
    ...rest,
    ...(database ? { database } : {}),
    ...(schema ? { schema } : {}),
  };
}
