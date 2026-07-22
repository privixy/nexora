export type CreateTableTarget =
  | { kind: "connection"; database: null; schema: null }
  | { kind: "schema"; database: null; schema: string }
  | { kind: "database"; database: string; schema: null }
  | { kind: "database-schema"; database: string; schema: string };

export type CreateTableRefreshPlan =
  | { scope: "connection"; database: null; schema: null }
  | { scope: "schema"; database: null; schema: string }
  | { scope: "database"; database: string; schema: null }
  | { scope: "database-schema"; database: string; schema: string };

export const DEFAULT_CREATE_TABLE_TARGET: CreateTableTarget = {
  kind: "connection",
  database: null,
  schema: null,
};

export function getCreateTableRefreshPlan(target: CreateTableTarget): CreateTableRefreshPlan {
  if (target.kind === "schema") {
    return { scope: "schema", database: null, schema: target.schema };
  }

  if (target.kind === "database") {
    return { scope: "database", database: target.database, schema: null };
  }

  if (target.kind === "database-schema") {
    return {
      scope: "database-schema",
      database: target.database,
      schema: target.schema,
    };
  }

  return { scope: "connection", database: null, schema: null };
}

export function resolveCreateTableSchema(
  schemaOverride: string | null | undefined,
  activeSchema: string | null,
): string | null {
  return schemaOverride === undefined ? activeSchema : schemaOverride;
}
