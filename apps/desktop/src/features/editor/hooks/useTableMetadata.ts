import type { QueryContext } from "./useQueryExecution";

export function buildTableMetadataPayload(payload: QueryContext & { table: string }) {
  const { connectionId, table, database, schema } = payload;
  return {
    connectionId,
    tableName: table,
    ...(database ? { database } : {}),
    ...(schema ? { schema } : {}),
  };
}
