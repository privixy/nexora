import { quoteTableRef } from "./identifiers";

export interface NewConsoleSpec {
  sql: string;
  title: string;
  database?: string;
  schema?: string;
}

export function newConsoleForDatabase(databaseName: string): NewConsoleSpec {
  return { sql: "", title: databaseName, database: databaseName };
}

export function newConsoleForTable(
  tableName: string,
  driver: string | null | undefined,
  schema?: string,
): NewConsoleSpec {
  return {
    sql: `SELECT * FROM ${quoteTableRef(tableName, driver, schema)}`,
    title: tableName,
    schema,
  };
}
