import { quoteTableRef } from "../../../shared/lib/identifiers";

interface ExplorerActionsOptions {
  connectionId: string | null;
  driver: string | null;
  navigate: (path: string, options?: { state?: Record<string, unknown> }) => void;
  setActiveTableContext: (table: string, database?: string, schema?: string) => void;
}

export const useExplorerActions = ({
  connectionId,
  driver,
  navigate,
  setActiveTableContext,
}: ExplorerActionsOptions) => {
  const runQuery = (
    sql: string,
    queryName?: string,
    tableName?: string,
    preventAutoRun = false,
    schema?: string,
    readOnly?: boolean,
    database?: string,
  ) => {
    navigate("/editor", {
      state: {
        initialQuery: sql,
        queryName,
        tableName,
        preventAutoRun,
        database,
        schema,
        readOnly,
        targetConnectionId: connectionId,
      },
    });
  };

  const openTable = (tableName: string, database?: string, schema?: string) => {
    setActiveTableContext(tableName, database, schema);
    const quotedTable = quoteTableRef(tableName, driver, schema);
    navigate("/editor", {
      state: {
        initialQuery: `SELECT * FROM ${quotedTable}`,
        tableName,
        database,
        schema,
        ...(database ? { title: `${tableName} (${database})` } : {}),
        targetConnectionId: connectionId,
      },
    });
  };

  const openView = (viewName: string, database?: string, schema?: string, materialized = false) => {
    const quotedView = quoteTableRef(viewName, driver, schema);
    navigate("/editor", {
      state: {
        initialQuery: `SELECT * FROM ${quotedView}`,
        tableName: viewName,
        database,
        schema,
        materialized,
        ...(database ? { title: `${viewName} (${database})` } : {}),
        targetConnectionId: connectionId,
      },
    });
  };

  return {
    runQuery,
    runSavedQuery: (sql: string, queryName?: string, database?: string) =>
      runQuery(sql, queryName, undefined, false, undefined, undefined, database),
    selectTable: (tableName: string, database?: string, schema?: string) =>
      setActiveTableContext(tableName, database, schema),
    openTable,
    openView,
  };
};
