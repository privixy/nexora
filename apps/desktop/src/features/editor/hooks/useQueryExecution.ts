export interface QueryContext {
  connectionId: string;
  database?: string;
  schema?: string;
}

function withQueryContext<T extends QueryContext>(payload: T) {
  const { connectionId, database, schema, ...rest } = payload;
  return {
    connectionId,
    ...rest,
    ...(database ? { database } : {}),
    ...(schema ? { schema } : {}),
  };
}

export function buildExecuteQueryPayload(payload: QueryContext & {
  query: string;
  limit: number;
  page: number;
}) {
  return withQueryContext(payload);
}

export function buildCountQueryPayload(payload: QueryContext & { query: string }) {
  return withQueryContext(payload);
}
