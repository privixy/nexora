import type { ReactNode } from 'react';
import { DatabaseContext } from '../../features/connections/state/DatabaseContext';
import { useDatabase } from '../../features/connections';

interface Props {
  connectionId: string;
  children: ReactNode;
}

/** Overrides DatabaseContext for a single split panel with the given connectionId */
export const PanelDatabaseProvider = ({ connectionId, children }: Props) => {
  const sharedContext = useDatabase();
  const data = sharedContext.connectionDataMap[connectionId];

  return (
    <DatabaseContext.Provider
      value={{
        ...sharedContext,
        // Read fields — scoped to this panel's connection
        activeConnectionId: connectionId,
        activeDriver: data?.driver ?? null,
        activeCapabilities: data?.capabilities ?? null,
        activeConnectionName: data?.connectionName ?? null,
        activeDatabaseName: data?.databaseName ?? null,
        activeDatabase: data?.activeDatabase ?? null,
        tables: data?.tables ?? [],
        views: data?.views ?? [],
        routines: data?.routines ?? [],
        isLoadingTables: data?.isLoadingTables ?? false,
        isLoadingViews: data?.isLoadingViews ?? false,
        isLoadingRoutines: data?.isLoadingRoutines ?? false,
        schemas: data?.schemas ?? [],
        isLoadingSchemas: data?.isLoadingSchemas ?? false,
        schemaDataMap: data?.schemaDataMap ?? {},
        activeSchema: data?.activeSchema ?? null,
        selectedSchemas: data?.selectedSchemas ?? [],
        needsSchemaSelection: data?.needsSchemaSelection ?? false,
        selectedDatabases: data?.selectedDatabases ?? [],
        databaseDataMap: data?.databaseDataMap ?? {},
        // Mutation functions — bound to this panel's connectionId
        setActiveTableContext: (table: string | null, database?: string | null, schema?: string | null) => sharedContext.setActiveTableContext(table, database, schema),
        refreshTables: () => sharedContext.refreshTables(connectionId),
        refreshViews: () => sharedContext.refreshViews(connectionId),
        refreshRoutines: () => sharedContext.refreshRoutines(connectionId),
        loadSchemaData: (schema: string) => sharedContext.loadSchemaData(schema, connectionId),
        refreshSchemaData: (schema: string) => sharedContext.refreshSchemaData(schema, connectionId),
        setSelectedSchemas: (schemas: string[]) => sharedContext.setSelectedSchemas(schemas, connectionId),
        loadDatabaseData: (database: string) => sharedContext.loadDatabaseData(database, connectionId),
        refreshDatabaseData: (database: string) => sharedContext.refreshDatabaseData(database, connectionId),
        loadDatabaseSchemaData: (database: string, schema: string) => sharedContext.loadDatabaseSchemaData(database, schema, connectionId),
        refreshDatabaseSchemaData: (database: string, schema: string) => sharedContext.refreshDatabaseSchemaData(database, schema, connectionId),
        setSelectedDatabases: (databases: string[]) => sharedContext.setSelectedDatabases(databases, connectionId),
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
