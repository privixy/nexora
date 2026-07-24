import type { QueryContext } from "./useQueryExecution";

export function buildExportQueryPayload(payload: QueryContext & {
  query: string;
  filePath: string;
  format: "csv" | "json";
  csvDelimiter?: string;
}) {
  const { connectionId, database, schema, ...rest } = payload;
  return {
    connectionId,
    ...rest,
    ...(database ? { database } : {}),
    ...(schema ? { schema } : {}),
  };
}
