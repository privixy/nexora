import type { ConnectionData } from "./DatabaseContext";

export function createEmptyConnectionData(
  driver = "",
  name = "",
  dbName = "",
): ConnectionData {
  return {
    driver,
    capabilities: null,
    connectionName: name,
    databaseName: dbName,
    tables: [],
    views: [],
    routines: [],
    triggers: [],
    isLoadingTables: false,
    isLoadingViews: false,
    isLoadingRoutines: false,
    isLoadingTriggers: false,
    schemas: [],
    isLoadingSchemas: false,
    schemaDataMap: {},
    activeDatabase: dbName || null,
    activeSchema: null,
    selectedSchemas: [],
    needsSchemaSelection: false,
    selectedDatabases: [],
    databaseDataMap: {},
    isConnecting: false,
    isConnected: false,
  };
}
