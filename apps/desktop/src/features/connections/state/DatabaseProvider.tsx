import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { connectionGateway, listenTauri, windowGateway } from '../../../platform/tauri';
import {
  DatabaseContext,
  type TableInfo,
  type ViewInfo,
  type RoutineInfo,
  type TriggerInfo,
  type SavedConnection,
  type ConnectionData,
  type DatabaseData,
  type ConnectionGroup,
  type ConnectionsFile,
} from './DatabaseContext';
import type { ReactNode } from 'react';
import type { PluginManifest } from '../../plugins';
import { toErrorMessage } from '../../../shared/lib/errors';
import { useSettings } from '../../settings';
import { findConnectionsForDrivers } from '../lib/connectionManager';
import { isMultiDatabaseCapable, getEffectiveDatabase, getDatabaseList } from '../../plugins';
import { formatWindowTitle } from '../lib/windowTitle';
import { createEmptyConnectionData } from './createEmptyConnectionData';

const invoke = connectionGateway.invoke;
const noopClearAutocompleteCache = () => {};
export const DatabaseProvider = ({ children, clearAutocompleteCache = noopClearAutocompleteCache }: { children: ReactNode; clearAutocompleteCache?: (connectionId?: string) => void }) => {
  const { settings } = useSettings();
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [openConnectionIds, setOpenConnectionIds] = useState<string[]>([]);
  const [connectionDataMap, setConnectionDataMap] = useState<Record<string, ConnectionData>>({});
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [connectionGroups, setConnectionGroups] = useState<ConnectionGroup[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  // Connection ids open anywhere in the app (shared backend, all windows).
  // Kept in sync via the `connections:active-changed` broadcast so each window
  // can show accurate cross-window connection status.
  const [globallyOpenConnectionIds, setGloballyOpenConnectionIds] = useState<string[]>([]);

  // Refs used in the plugin-disable effect to avoid stale closures
  const openConnectionIdsRef = useRef(openConnectionIds);
  openConnectionIdsRef.current = openConnectionIds;
  const connectionDataMapRef = useRef(connectionDataMap);
  connectionDataMapRef.current = connectionDataMap;
  const prevActiveExtRef = useRef<string[] | undefined>(undefined);

  const getActiveConnectionData = useCallback((): ConnectionData | undefined => {
    if (!activeConnectionId) return undefined;
    return connectionDataMap[activeConnectionId];
  }, [activeConnectionId, connectionDataMap]);

  const activeData = getActiveConnectionData();

  const activeDriver = activeData?.driver ?? null;
  const activeCapabilities = activeData?.capabilities ?? null;
  const activeConnectionName = activeData?.connectionName ?? null;
  const activeDatabaseName = activeData?.databaseName ?? null;
  const activeDatabase = activeData?.activeDatabase ?? null;
  const tables = activeData?.tables ?? [];
  const views = activeData?.views ?? [];
  const routines = activeData?.routines ?? [];
  const triggers = activeData?.triggers ?? [];
  const isLoadingTables = activeData?.isLoadingTables ?? false;
  const isLoadingViews = activeData?.isLoadingViews ?? false;
  const isLoadingRoutines = activeData?.isLoadingRoutines ?? false;
  const isLoadingTriggers = activeData?.isLoadingTriggers ?? false;
  const schemas = activeData?.schemas ?? [];
  const isLoadingSchemas = activeData?.isLoadingSchemas ?? false;
  const schemaDataMap = activeData?.schemaDataMap ?? {};
  const activeSchema = activeData?.activeSchema ?? null;
  // Materialized views are schema-scoped (Postgres only), so resolve them from
  // the active schema rather than the connection level (where they never load).
  const materializedViews = activeSchema
    ? (schemaDataMap[activeSchema]?.materializedViews ?? [])
    : [];
  const selectedSchemas = activeData?.selectedSchemas ?? [];
  const needsSchemaSelection = activeData?.needsSchemaSelection ?? false;
  const selectedDatabases = useMemo(() => activeData?.selectedDatabases ?? [], [activeData?.selectedDatabases]);
  const databaseDataMap = activeData?.databaseDataMap ?? {};

  useEffect(() => {
    const updateTitle = async () => {
      try {
        let title = formatWindowTitle();
        if (activeConnectionName && activeDatabaseName) {
          const schemaSuffix = activeSchema && activeCapabilities?.schemas === true ? `/${activeSchema}` : '';
          const dbDisplay =
            isMultiDatabaseCapable(activeCapabilities) && selectedDatabases.length > 1
              ? (activeDatabase ?? activeDatabaseName)
              : activeDatabaseName;
          title = formatWindowTitle(`${activeConnectionName} (${dbDisplay}${schemaSuffix})`);
        }
        await windowGateway.setWindowTitle({ title });
      } catch (e) {
        console.error('Failed to update window title', e);
      }
    };
    updateTitle();
  }, [activeConnectionName, activeDatabaseName, activeDatabase, activeSchema, activeCapabilities, selectedDatabases]);

  const updateConnectionData = useCallback((connectionId: string, updates: Partial<ConnectionData>) => {
    setConnectionDataMap(prev => {
      const current = prev[connectionId];
      const next = { ...current, ...updates };
      const database = next.activeDatabase;
      const hasSchemaUpdates =
        updates.schemas !== undefined ||
        updates.isLoadingSchemas !== undefined ||
        updates.schemaDataMap !== undefined ||
        updates.activeSchema !== undefined ||
        updates.selectedSchemas !== undefined ||
        updates.needsSchemaSelection !== undefined;

      if (
        current?.capabilities?.multiple_databases === true &&
        current.capabilities.schemas &&
        database &&
        hasSchemaUpdates
      ) {
        const existing = next.databaseDataMap[database] ?? {
          tables: [],
          views: [],
          routines: [],
          triggers: [],
          isLoading: false,
          isLoaded: false,
          schemaDataMap: {},
        };
        next.databaseDataMap = {
          ...next.databaseDataMap,
          [database]: {
            ...existing,
            ...(updates.schemas !== undefined ? { schemas: next.schemas } : {}),
            ...(updates.isLoadingSchemas !== undefined ? { isLoadingSchemas: next.isLoadingSchemas } : {}),
            ...(updates.schemaDataMap !== undefined ? { schemaDataMap: next.schemaDataMap } : {}),
            ...(updates.activeSchema !== undefined ? { activeSchema: next.activeSchema } : {}),
            ...(updates.selectedSchemas !== undefined ? { selectedSchemas: next.selectedSchemas } : {}),
            ...(updates.needsSchemaSelection !== undefined ? { needsSchemaSelection: next.needsSchemaSelection } : {}),
          },
        };
      }

      return { ...prev, [connectionId]: next };
    });
  }, []);

  const refreshTables = async (targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;
    updateConnectionData(connId, { isLoadingTables: true });
    try {
      const result = await invoke<TableInfo[]>('get_tables', { connectionId: connId });
      updateConnectionData(connId, { tables: result, isLoadingTables: false });
    } catch (e) {
      console.error('Failed to refresh tables:', e);
      updateConnectionData(connId, { isLoadingTables: false, error: toErrorMessage(e) });
    }
  };

  const refreshViews = async (targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;
    updateConnectionData(connId, { isLoadingViews: true });
    try {
      const result = await invoke<ViewInfo[]>('get_views', { connectionId: connId });
      updateConnectionData(connId, { views: result, isLoadingViews: false });
    } catch (e) {
      console.error('Failed to refresh views:', e);
      updateConnectionData(connId, { isLoadingViews: false, error: toErrorMessage(e) });
    }
  };

  const refreshRoutines = async (targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;
    updateConnectionData(connId, { isLoadingRoutines: true });
    try {
      const result = await invoke<RoutineInfo[]>('get_routines', { connectionId: connId });
      updateConnectionData(connId, { routines: result, isLoadingRoutines: false });
    } catch (e) {
      console.error('Failed to refresh routines:', e);
      updateConnectionData(connId, { isLoadingRoutines: false, error: toErrorMessage(e) });
    }
  };

  const refreshTriggers = async (targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;
    updateConnectionData(connId, { isLoadingTriggers: true });
    try {
      const result = await invoke<TriggerInfo[]>('get_triggers', { connectionId: connId });
      updateConnectionData(connId, { triggers: result, isLoadingTriggers: false });
    } catch (e) {
      console.error('Failed to refresh triggers:', e);
      updateConnectionData(connId, { isLoadingTriggers: false, error: toErrorMessage(e) });
    }
  };

  const loadSchemaData = useCallback(async (schema: string, targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    if (!currentData) return;

    const database = currentData.capabilities?.multiple_databases === true && currentData.capabilities.schemas
      ? currentData.activeDatabase ?? undefined
      : undefined;
    const existingSchemaData = currentData.schemaDataMap[schema];
    if (existingSchemaData?.isLoaded || existingSchemaData?.isLoading) return;

    updateConnectionData(connId, {
      schemaDataMap: {
        ...currentData.schemaDataMap,
        [schema]: { tables: [], views: [], routines: [], triggers: [], isLoading: true, isLoaded: false },
      },
    });

    try {
      const [tablesResult, viewsResult, materializedViewsResult, routinesResult, triggersResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: connId, ...(database ? { database } : {}), schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: connId, ...(database ? { database } : {}), schema }),
        (currentData.capabilities?.materialized_views
          ? invoke<ViewInfo[]>('get_materialized_views', { connectionId: connId, ...(database ? { database } : {}), schema }).catch(() => [] as ViewInfo[])
          : Promise.resolve([] as ViewInfo[])),
        invoke<RoutineInfo[]>('get_routines', { connectionId: connId, ...(database ? { database } : {}), schema }),
        invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, ...(database ? { database } : {}), schema }).catch(() => [] as TriggerInfo[]),
      ]);

      const freshData = connectionDataMap[connId];
      if (freshData) {
        updateConnectionData(connId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: {
              tables: tablesResult,
              views: viewsResult,
              materializedViews: materializedViewsResult,
              routines: routinesResult,
              triggers: triggersResult,
              isLoading: false,
              isLoaded: true,
            },
          },
        });
      }
    } catch (e) {
      console.error(`Failed to load schema data for ${schema}:`, e);
      const freshData = connectionDataMap[connId];
      if (freshData) {
        updateConnectionData(connId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: false },
          },
        });
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const loadDatabaseSchemaData = useCallback(async (database: string, schema: string, targetConnectionId?: string, activate = true) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    if (!currentData) return;

    const currentDatabaseData = currentData.databaseDataMap[database];
    const existingSchemaData = currentDatabaseData?.schemaDataMap?.[schema];
    if (existingSchemaData?.isLoaded || existingSchemaData?.isLoading) return;

    const nextSchemaDataMap = {
      ...(currentDatabaseData?.schemaDataMap ?? {}),
      [schema]: { tables: [], views: [], routines: [], triggers: [], isLoading: true, isLoaded: false },
    };

    updateConnectionData(connId, {
      ...(activate
        ? {
            activeDatabase: database,
            schemas: currentDatabaseData?.schemas ?? currentData.schemas,
            schemaDataMap: nextSchemaDataMap,
            activeSchema: schema,
            selectedSchemas: currentDatabaseData?.selectedSchemas ?? currentData.selectedSchemas,
            needsSchemaSelection: currentDatabaseData?.needsSchemaSelection ?? currentData.needsSchemaSelection,
          }
        : {}),
      databaseDataMap: {
        ...currentData.databaseDataMap,
        [database]: {
          ...(currentDatabaseData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
          schemaDataMap: nextSchemaDataMap,
          activeSchema: schema,
        },
      },
    });

    try {
      const [tablesResult, viewsResult, materializedViewsResult, routinesResult, triggersResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: connId, database, schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: connId, database, schema }),
        (currentData.capabilities?.materialized_views
          ? invoke<ViewInfo[]>('get_materialized_views', { connectionId: connId, database, schema }).catch(() => [] as ViewInfo[])
          : Promise.resolve([] as ViewInfo[])),
        invoke<RoutineInfo[]>('get_routines', { connectionId: connId, database, schema }),
        invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, database, schema }).catch(() => [] as TriggerInfo[]),
      ]);

      setConnectionDataMap(prev => {
        const freshData = prev[connId];
        if (!freshData) return prev;
        const freshDatabaseData = freshData.databaseDataMap[database];
        const freshSchemaDataMap = {
          ...(freshDatabaseData?.schemaDataMap ?? {}),
          [schema]: {
            tables: tablesResult,
            views: viewsResult,
            materializedViews: materializedViewsResult,
            routines: routinesResult,
            triggers: triggersResult,
            isLoading: false,
            isLoaded: true,
          },
        };
        return {
          ...prev,
          [connId]: {
            ...freshData,
            ...(activate
              ? {
                  activeDatabase: database,
                  schemas: freshDatabaseData?.schemas ?? freshData.schemas,
                  schemaDataMap: freshSchemaDataMap,
                  activeSchema: schema,
                }
              : {}),
            databaseDataMap: {
              ...freshData.databaseDataMap,
              [database]: {
                ...(freshDatabaseData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
                schemaDataMap: freshSchemaDataMap,
                activeSchema: schema,
              },
            },
          },
        };
      });
    } catch (e) {
      console.error(`Failed to load schema data for ${database}.${schema}:`, e);
      setConnectionDataMap(prev => {
        const freshData = prev[connId];
        if (!freshData) return prev;
        const freshDatabaseData = freshData.databaseDataMap[database];
        const freshSchemaDataMap = {
          ...(freshDatabaseData?.schemaDataMap ?? {}),
          [schema]: { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: false },
        };
        return {
          ...prev,
          [connId]: {
            ...freshData,
            databaseDataMap: {
              ...freshData.databaseDataMap,
              [database]: {
                ...(freshDatabaseData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
                schemaDataMap: freshSchemaDataMap,
              },
            },
          },
        };
      });
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const refreshDatabaseSchemaData = useCallback(async (database: string, schema: string, targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    if (!currentData) return;

    const currentDatabaseData = currentData.databaseDataMap[database];
    const nextSchemaDataMap = {
      ...(currentDatabaseData?.schemaDataMap ?? {}),
      [schema]: {
        ...(currentDatabaseData?.schemaDataMap?.[schema] || { tables: [], views: [], routines: [], triggers: [], isLoaded: false }),
        isLoading: true,
      },
    };

    updateConnectionData(connId, {
      activeDatabase: database,
      schemas: currentDatabaseData?.schemas ?? currentData.schemas,
      schemaDataMap: nextSchemaDataMap,
      activeSchema: schema,
      selectedSchemas: currentDatabaseData?.selectedSchemas ?? currentData.selectedSchemas,
      needsSchemaSelection: currentDatabaseData?.needsSchemaSelection ?? currentData.needsSchemaSelection,
      databaseDataMap: {
        ...currentData.databaseDataMap,
        [database]: {
          ...(currentDatabaseData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
          schemaDataMap: nextSchemaDataMap,
          activeSchema: schema,
        },
      },
    });

    try {
      const [tablesResult, viewsResult, materializedViewsResult, routinesResult, triggersResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: connId, database, schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: connId, database, schema }),
        (currentData.capabilities?.materialized_views
          ? invoke<ViewInfo[]>('get_materialized_views', { connectionId: connId, database, schema }).catch(() => [] as ViewInfo[])
          : Promise.resolve([] as ViewInfo[])),
        invoke<RoutineInfo[]>('get_routines', { connectionId: connId, database, schema }),
        invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, database, schema }).catch(() => [] as TriggerInfo[]),
      ]);

      setConnectionDataMap(prev => {
        const freshData = prev[connId];
        if (!freshData) return prev;
        const freshDatabaseData = freshData.databaseDataMap[database];
        const freshSchemaDataMap = {
          ...(freshDatabaseData?.schemaDataMap ?? {}),
          [schema]: {
            tables: tablesResult,
            views: viewsResult,
            materializedViews: materializedViewsResult,
            routines: routinesResult,
            triggers: triggersResult,
            isLoading: false,
            isLoaded: true,
          },
        };
        return {
          ...prev,
          [connId]: {
            ...freshData,
            activeDatabase: database,
            schemas: freshDatabaseData?.schemas ?? freshData.schemas,
            schemaDataMap: freshSchemaDataMap,
            activeSchema: schema,
            databaseDataMap: {
              ...freshData.databaseDataMap,
              [database]: {
                ...(freshDatabaseData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
                schemaDataMap: freshSchemaDataMap,
                activeSchema: schema,
              },
            },
          },
        };
      });
    } catch (e) {
      console.error(`Failed to refresh schema data for ${database}.${schema}:`, e);
      setConnectionDataMap(prev => {
        const freshData = prev[connId];
        if (!freshData) return prev;
        const freshDatabaseData = freshData.databaseDataMap[database];
        const freshSchemaDataMap = {
          ...(freshDatabaseData?.schemaDataMap ?? {}),
          [schema]: {
            ...(freshDatabaseData?.schemaDataMap?.[schema] || { tables: [], views: [], routines: [], triggers: [], isLoaded: false }),
            isLoading: false,
          },
        };
        return {
          ...prev,
          [connId]: {
            ...freshData,
            databaseDataMap: {
              ...freshData.databaseDataMap,
              [database]: {
                ...(freshDatabaseData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
                schemaDataMap: freshSchemaDataMap,
              },
            },
          },
        };
      });
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const refreshSchemaData = useCallback(async (schema: string, targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    if (!currentData) return;

    const database = currentData.capabilities?.multiple_databases === true && currentData.capabilities.schemas
      ? currentData.activeDatabase ?? undefined
      : undefined;
    updateConnectionData(connId, {
      schemaDataMap: {
        ...currentData.schemaDataMap,
        [schema]: {
          ...(currentData.schemaDataMap[schema] || { tables: [], views: [], routines: [], triggers: [], isLoaded: false }),
          isLoading: true
        },
      },
    });

    try {
      const [tablesResult, viewsResult, materializedViewsResult, routinesResult, triggersResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: connId, ...(database ? { database } : {}), schema }),
        invoke<ViewInfo[]>('get_views', { connectionId: connId, ...(database ? { database } : {}), schema }),
        (currentData.capabilities?.materialized_views
          ? invoke<ViewInfo[]>('get_materialized_views', { connectionId: connId, ...(database ? { database } : {}), schema }).catch(() => [] as ViewInfo[])
          : Promise.resolve([] as ViewInfo[])),
        invoke<RoutineInfo[]>('get_routines', { connectionId: connId, ...(database ? { database } : {}), schema }),
        invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, ...(database ? { database } : {}), schema }).catch(() => [] as TriggerInfo[]),
      ]);

      const freshData = connectionDataMap[connId];
      if (freshData) {
        updateConnectionData(connId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: {
              tables: tablesResult,
              views: viewsResult,
              materializedViews: materializedViewsResult,
              routines: routinesResult,
              triggers: triggersResult,
              isLoading: false,
              isLoaded: true,
            },
          },
        });
      }
    } catch (e) {
      console.error(`Failed to refresh schema data for ${schema}:`, e);
      const freshData = connectionDataMap[connId];
      if (freshData) {
        updateConnectionData(connId, {
          schemaDataMap: {
            ...freshData.schemaDataMap,
            [schema]: {
              ...(freshData.schemaDataMap[schema] || { tables: [], views: [], routines: [], triggers: [], isLoaded: false }),
              isLoading: false
            },
          },
        });
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const loadDatabaseData = useCallback(async (
    database: string,
    targetConnectionId?: string,
    activate = false,
    dataOverride?: ConnectionData,
  ) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = dataOverride ?? connectionDataMap[connId];
    if (!currentData) return;

    const existing = currentData.databaseDataMap[database];
    if (currentData.capabilities?.schemas === true && existing?.isLoaded) {
      if (activate) {
        updateConnectionData(connId, {
          activeDatabase: database,
          schemas: existing.schemas ?? [],
          isLoadingSchemas: existing.isLoadingSchemas ?? false,
          schemaDataMap: existing.schemaDataMap ?? {},
          activeSchema: existing.activeSchema ?? null,
          selectedSchemas: existing.selectedSchemas ?? [],
          needsSchemaSelection: existing.needsSchemaSelection ?? false,
        });
      }
      return;
    }
    if (existing?.isLoading) {
      if (activate) {
        updateConnectionData(connId, {
          activeDatabase: database,
          isLoadingSchemas: currentData.capabilities?.schemas === true,
        });
      }
      return;
    }

    setConnectionDataMap(prev => {
      const freshData = prev[connId];
      if (!freshData) return prev;
      const freshExisting = freshData.databaseDataMap[database] ?? existing ?? {
        tables: [],
        views: [],
        routines: [],
        triggers: [],
        isLoaded: false,
      };
      return {
        ...prev,
        [connId]: {
          ...freshData,
          ...(activate
            ? {
                activeDatabase: database,
                isLoadingSchemas: currentData.capabilities?.schemas === true,
              }
            : {}),
          databaseDataMap: {
            ...freshData.databaseDataMap,
            [database]: {
              ...freshExisting,
              isLoading: true,
              isLoaded: freshExisting.isLoaded ?? false,
            },
          },
        },
      };
    });

    try {
      if (currentData.capabilities?.schemas === true) {
        const schemasResult = await invoke<string[]>('get_schemas', { connectionId: connId, database });
        let savedSelection: string[] = [];
        try {
          savedSelection = await invoke<string[]>('get_selected_schemas', { connectionId: connId });
        } catch {
          savedSelection = [];
        }
        const validSelection = savedSelection.length > 0
          ? savedSelection.filter(schema => schemasResult.includes(schema))
          : schemasResult;
        let preferredSchema = validSelection[0] ?? null;
        if (preferredSchema) {
          try {
            const saved = await invoke<string | null>('get_schema_preference', { connectionId: connId });
            if (saved && validSelection.includes(saved)) preferredSchema = saved;
          } catch {
            preferredSchema = validSelection[0];
          }
        }

        const schemaEntries = await Promise.all(
          validSelection.map(async (schemaName) => {
            const [tablesResult, viewsResult, materializedViewsResult, routinesResult, triggersResult] = await Promise.all([
              invoke<TableInfo[]>('get_tables', { connectionId: connId, database, schema: schemaName }),
              invoke<ViewInfo[]>('get_views', { connectionId: connId, database, schema: schemaName }),
              (currentData.capabilities?.materialized_views
                ? invoke<ViewInfo[]>('get_materialized_views', { connectionId: connId, database, schema: schemaName }).catch(() => [] as ViewInfo[])
                : Promise.resolve([] as ViewInfo[])),
              invoke<RoutineInfo[]>('get_routines', { connectionId: connId, database, schema: schemaName }),
              invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, database, schema: schemaName }).catch(() => [] as TriggerInfo[]),
            ]);
            return [schemaName, {
              tables: tablesResult,
              views: viewsResult,
              materializedViews: materializedViewsResult,
              routines: routinesResult,
              triggers: triggersResult,
              isLoading: false,
              isLoaded: true,
            }] as const;
          }),
        );
        const schemaDataMap = Object.fromEntries(schemaEntries);

        const databaseData: DatabaseData = {
          tables: [],
          views: [],
          routines: [],
          triggers: [],
          isLoading: false,
          isLoaded: true,
          schemas: schemasResult,
          isLoadingSchemas: false,
          schemaDataMap,
          activeSchema: preferredSchema,
          selectedSchemas: validSelection,
          needsSchemaSelection: validSelection.length === 0,
        };
        setConnectionDataMap(prev => {
          const freshData = prev[connId];
          if (!freshData) return prev;
          return {
            ...prev,
            [connId]: {
              ...freshData,
              ...(activate
                ? {
                    activeDatabase: database,
                    schemas: schemasResult,
                    isLoadingSchemas: false,
                    schemaDataMap,
                    activeSchema: preferredSchema,
                    selectedSchemas: validSelection,
                    needsSchemaSelection: validSelection.length === 0,
                  }
                : {}),
              databaseDataMap: {
                ...freshData.databaseDataMap,
                [database]: databaseData,
              },
            },
          };
        });
        return;
      }

      const [tablesResult, viewsResult, routinesResult, triggersResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: connId, schema: database }),
        invoke<ViewInfo[]>('get_views', { connectionId: connId, schema: database }),
        invoke<RoutineInfo[]>('get_routines', { connectionId: connId, schema: database }),
        invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, schema: database }).catch(() => [] as TriggerInfo[]),
      ]);
      setConnectionDataMap(prev => {
        const freshData = prev[connId];
        if (!freshData) return prev;
        return {
          ...prev,
          [connId]: {
            ...freshData,
            ...(activate ? { activeDatabase: database } : {}),
            databaseDataMap: {
              ...freshData.databaseDataMap,
              [database]: {
                tables: tablesResult,
                views: viewsResult,
                routines: routinesResult,
                triggers: triggersResult,
                isLoading: false,
                isLoaded: true,
              },
            },
          },
        };
      });
    } catch (e) {
      console.error(`Failed to load database data for ${database}:`, e);
      setConnectionDataMap(prev => {
        const freshData = prev[connId];
        if (!freshData) return prev;
        return {
          ...prev,
          [connId]: {
            ...freshData,
            isLoadingSchemas: false,
            databaseDataMap: {
              ...freshData.databaseDataMap,
              [database]: {
              ...(freshData.databaseDataMap[database] ?? { tables: [], views: [], routines: [], triggers: [] }),
              isLoading: false,
              isLoaded: false,
            },
            },
          },
        };
      });
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData]);

  const refreshDatabaseData = useCallback(async (database: string, targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    if (!currentData) return;
    if (currentData.capabilities?.schemas === true) {
      const staleData = {
        ...currentData,
        databaseDataMap: {
          ...currentData.databaseDataMap,
          [database]: {
            ...(currentData.databaseDataMap[database] || { tables: [], views: [], routines: [], triggers: [] }),
            isLoading: false,
            isLoaded: false,
          },
        },
      };
      updateConnectionData(connId, { databaseDataMap: staleData.databaseDataMap });
      await loadDatabaseData(database, connId, currentData.activeDatabase === database, staleData);
      return;
    }

    updateConnectionData(connId, {
      databaseDataMap: {
        ...currentData.databaseDataMap,
        [database]: {
          ...(currentData.databaseDataMap[database] || { tables: [], views: [], routines: [], triggers: [], isLoaded: false }),
          isLoading: true,
        },
      },
    });

    try {
      const [tablesResult, viewsResult, routinesResult, triggersResult] = await Promise.all([
        invoke<TableInfo[]>('get_tables', { connectionId: connId, schema: database }),
        invoke<ViewInfo[]>('get_views', { connectionId: connId, schema: database }),
        invoke<RoutineInfo[]>('get_routines', { connectionId: connId, schema: database }),
        invoke<TriggerInfo[]>('get_triggers', { connectionId: connId, schema: database }).catch(() => [] as TriggerInfo[]),
      ]);

      const freshData = connectionDataMap[connId];
      if (freshData) {
        updateConnectionData(connId, {
          databaseDataMap: {
            ...freshData.databaseDataMap,
            [database]: {
              tables: tablesResult,
              views: viewsResult,
              routines: routinesResult,
              triggers: triggersResult,
              isLoading: false,
              isLoaded: true,
            },
          },
        });
      }
    } catch (e) {
      console.error(`Failed to refresh database data for ${database}:`, e);
      const freshData = connectionDataMap[connId];
      if (freshData) {
        updateConnectionData(connId, {
          databaseDataMap: {
            ...freshData.databaseDataMap,
            [database]: {
              ...(freshData.databaseDataMap[database] || { tables: [], views: [], routines: [], triggers: [], isLoaded: false }),
              isLoading: false,
            },
          },
        });
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData, loadDatabaseData]);

  const setSelectedSchemas = useCallback(async (newSchemas: string[], targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    if (!currentData) return;

    updateConnectionData(connId, {
      selectedSchemas: newSchemas,
      needsSchemaSelection: false
    });

    try {
      await invoke('set_selected_schemas', {
        connectionId: connId,
        schemas: newSchemas,
      });
    } catch (e) {
      console.error('Failed to persist selected schemas:', e);
    }

    if (currentData.capabilities?.multiple_databases === true && currentData.capabilities.schemas) {
      const dbs = currentData.selectedDatabases.length > 0
        ? currentData.selectedDatabases
        : currentData.activeDatabase
          ? [currentData.activeDatabase]
          : [];
      const nextDatabaseDataMap = { ...currentData.databaseDataMap };
      const schemasToLoad: Array<{ database: string; schema: string }> = [];
      for (const db of dbs) {
        const dbData = currentData.databaseDataMap[db];
        const validSchemas = newSchemas.filter(schema => (dbData?.schemas ?? currentData.schemas).includes(schema));
        nextDatabaseDataMap[db] = {
          ...(dbData ?? { tables: [], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true }),
          schemas: dbData?.schemas ?? currentData.schemas,
          selectedSchemas: validSchemas,
          needsSchemaSelection: validSchemas.length === 0,
          activeSchema:
            dbData?.activeSchema && validSchemas.includes(dbData.activeSchema)
              ? dbData.activeSchema
              : validSchemas[0] ?? null,
        };
        for (const schema of validSchemas) {
          const existing = dbData?.schemaDataMap?.[schema];
          if (!existing?.isLoaded && !existing?.isLoading) {
            schemasToLoad.push({ database: db, schema });
          }
        }
      }
      updateConnectionData(connId, { databaseDataMap: nextDatabaseDataMap });
      for (const { database, schema } of schemasToLoad) {
        loadDatabaseSchemaData(database, schema, connId, false);
      }
    } else {
      for (const schema of newSchemas) {
        const existing = currentData.schemaDataMap[schema];
        if (!existing?.isLoaded && !existing?.isLoading) {
          loadSchemaData(schema, connId);
        }
      }
    }

    if (!currentData.activeSchema || !newSchemas.includes(currentData.activeSchema)) {
      const nextSchema = newSchemas[0] || null;
      updateConnectionData(connId, { activeSchema: nextSchema });
      if (nextSchema) {
        invoke('set_schema_preference', { connectionId: connId, schema: nextSchema }).catch(() => {});
      }
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData, loadSchemaData, loadDatabaseSchemaData]);

  const setSelectedDatabases = useCallback((newDatabases: string[], targetConnectionId?: string) => {
    const connId = targetConnectionId ?? activeConnectionId;
    if (!connId) return;

    const currentData = connectionDataMap[connId];
    const nextActiveDatabase = currentData?.activeDatabase && newDatabases.includes(currentData.activeDatabase)
      ? currentData.activeDatabase
      : newDatabases[0] ?? null;
    updateConnectionData(connId, {
      selectedDatabases: newDatabases,
      activeDatabase: nextActiveDatabase,
    });
    if (currentData) {
      newDatabases.forEach((database) => {
        if (!currentData.databaseDataMap[database]?.isLoaded && !currentData.databaseDataMap[database]?.isLoading) {
          void loadDatabaseData(database, connId, database === nextActiveDatabase);
        }
      });
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData, loadDatabaseData]);

  const connect = async (connectionId: string) => {
    // Capture previous state so we can restore it on failure
    const prevActiveConnectionId = activeConnectionId;

    // Set loading state synchronously before any await so UI reflects loading immediately
    if (!openConnectionIds.includes(connectionId)) {
      setOpenConnectionIds(prev => [...prev, connectionId]);
    }

    setConnectionDataMap(prev => ({
      ...prev,
      [connectionId]: {
        ...createEmptyConnectionData(),
        isConnecting: true,
        isConnected: false,
        isLoadingTables: true,
        isLoadingViews: true,
        isLoadingRoutines: true,
      },
    }));

    setActiveConnectionId(connectionId);
    setActiveTable(null);

    try {
      const allConnections = await invoke<SavedConnection[]>('get_connections');
      const conn = allConnections.find(c => c.id === connectionId);
      if (!conn) {
        throw new Error('Connection not found');
      }

      const driver = conn.params.driver;

      // Fetch driver manifest to access capabilities (driver-agnostic feature detection)
      let driverManifest: PluginManifest | null = null;
      try {
        driverManifest = await invoke<PluginManifest | null>('get_driver_manifest', { driverId: driver });
      } catch {
        // Manifest not found; capabilities will be null and features will degrade gracefully
      }

      const capabilities = driverManifest?.capabilities ?? null;
      const dbParam = conn.params.database; // string | string[]
      const primaryDb = getEffectiveDatabase(dbParam);

      updateConnectionData(connectionId, {
        driver,
        capabilities,
        connectionName: conn.name,
        databaseName: primaryDb,
        activeDatabase: primaryDb || null,
      });

      try {
        await invoke<string>('test_connection', {
          request: {
            params: conn.params,
            connection_id: connectionId,
          },
        });
      } catch (testError) {
        const errorMsg = toErrorMessage(testError);
        updateConnectionData(connectionId, {
          isConnecting: false,
          isConnected: false,
          isLoadingTables: false,
          isLoadingViews: false,
          isLoadingRoutines: false,
          error: errorMsg
        });
        setOpenConnectionIds(prev => prev.filter(id => id !== connectionId));
        throw new Error(errorMsg, { cause: testError });
      }

      // Register for health-check pinging.
      await invoke('register_active_connection', { connectionId });

      const isMultiDb =
        isMultiDatabaseCapable(capabilities) &&
        Array.isArray(dbParam) &&
        (dbParam.length > 1 || capabilities?.schemas === true);

      if (isMultiDb) {
        const dbList = getDatabaseList(dbParam);
        const firstDb = dbList[0] ?? '';
        updateConnectionData(connectionId, {
          selectedDatabases: dbList,
          activeDatabase: firstDb || null,
          isLoadingTables: false,
          isLoadingViews: false,
          isLoadingRoutines: false,
          isLoadingTriggers: false,
          isConnecting: false,
          isConnected: true,
        });
        if (firstDb) {
          const baseData = {
            ...createEmptyConnectionData(driver, conn.name, primaryDb),
            capabilities,
            selectedDatabases: dbList,
            activeDatabase: firstDb,
          };
          await loadDatabaseData(firstDb, connectionId, true, baseData);
          dbList
            .filter((db) => db !== firstDb)
            .forEach((db) => {
              void loadDatabaseData(db, connectionId, false, baseData);
            });
        }
      } else if (capabilities?.schemas === true) {
        updateConnectionData(connectionId, { isLoadingSchemas: true });

        try {
          const schemasResult = await invoke<string[]>('get_schemas', { connectionId });
          updateConnectionData(connectionId, { schemas: schemasResult });

          let savedSelection: string[] = [];
          try {
            savedSelection = await invoke<string[]>('get_selected_schemas', { connectionId });
          } catch {
            // Ignore - no saved selection exists yet
          }

          const validSelection = savedSelection.filter(s => schemasResult.includes(s));

          if (validSelection.length > 0) {
            let preferredSchema = validSelection[0];
            try {
              const saved = await invoke<string | null>('get_schema_preference', { connectionId });
              if (saved && validSelection.includes(saved)) {
                preferredSchema = saved;
              }
            } catch {
              // Ignore - no saved preference exists yet
            }

            const [tablesResult, viewsResult, materializedViewsResult, routinesResult, triggersResult] = await Promise.all([
              invoke<TableInfo[]>('get_tables', { connectionId, schema: preferredSchema }),
              invoke<ViewInfo[]>('get_views', { connectionId, schema: preferredSchema }),
              (capabilities?.materialized_views
                ? invoke<ViewInfo[]>('get_materialized_views', { connectionId, schema: preferredSchema }).catch(() => [] as ViewInfo[])
                : Promise.resolve([] as ViewInfo[])),
              invoke<RoutineInfo[]>('get_routines', { connectionId, schema: preferredSchema }),
              invoke<TriggerInfo[]>('get_triggers', { connectionId, schema: preferredSchema }).catch(() => [] as TriggerInfo[]),
            ]);

            updateConnectionData(connectionId, {
              selectedSchemas: validSelection,
              needsSchemaSelection: false,
              activeSchema: preferredSchema,
              schemaDataMap: {
                [preferredSchema]: {
                  tables: tablesResult,
                  views: viewsResult,
                  materializedViews: materializedViewsResult,
                  routines: routinesResult,
                  triggers: triggersResult,
                  isLoading: false,
                  isLoaded: true,
                },
              },
              isLoadingSchemas: false,
              isLoadingTables: false,
              isLoadingViews: false,
              isLoadingRoutines: false,
              isLoadingTriggers: false,
              isConnecting: false,
              isConnected: true,
            });
          } else {
            updateConnectionData(connectionId, {
              selectedSchemas: [],
              needsSchemaSelection: true,
              isLoadingSchemas: false,
              isLoadingTables: false,
              isLoadingViews: false,
              isLoadingRoutines: false,
              isLoadingTriggers: false,
              isConnecting: false,
              isConnected: true,
            });
          }
        } catch (e) {
          console.error('Failed to fetch schemas:', e);
          updateConnectionData(connectionId, {
            isLoadingSchemas: false,
            isLoadingTables: false,
            isLoadingViews: false,
            isLoadingRoutines: false,
            isLoadingTriggers: false,
            isConnecting: false,
            isConnected: true,
            error: toErrorMessage(e),
            schemas: [],
            needsSchemaSelection: false,
          });
        }
      } else {
        const [tablesResult, viewsResult, routinesResult, triggersResult] = await Promise.all([
          invoke<TableInfo[]>('get_tables', { connectionId }),
          invoke<ViewInfo[]>('get_views', { connectionId }),
          invoke<RoutineInfo[]>('get_routines', { connectionId }),
          invoke<TriggerInfo[]>('get_triggers', { connectionId }).catch(() => [] as TriggerInfo[]),
        ]);

        updateConnectionData(connectionId, {
          tables: tablesResult,
          views: viewsResult,
          routines: routinesResult,
          triggers: triggersResult,
          isLoadingTables: false,
          isLoadingViews: false,
          isLoadingRoutines: false,
          isLoadingTriggers: false,
          isConnecting: false,
          isConnected: true,
        });
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      setConnectionDataMap(prev => {
        const newMap = { ...prev };
        delete newMap[connectionId];
        return newMap;
      });
      setOpenConnectionIds(prev => prev.filter(id => id !== connectionId));
      setActiveConnectionId(prevActiveConnectionId);
      throw error;
    }
  };

  const disconnect = async (connectionId?: string) => {
    const targetId = connectionId || activeConnectionId;
    if (!targetId) return;

    clearAutocompleteCache(targetId);

    try {
      await invoke('disconnect_connection', { connectionId: targetId });
    } catch (error) {
      console.error(`[DatabaseProvider] Failed to disconnect from ${targetId}:`, error);
    }

    const remainingIds = openConnectionIds.filter(id => id !== targetId);

    setOpenConnectionIds(remainingIds);
    setConnectionDataMap(prev => {
      const newMap = { ...prev };
      delete newMap[targetId];
      return newMap;
    });

    // Persist the updated session immediately. A disconnect is an explicit user
    // action, so we can't rely on the reactive persistence effect below (it skips
    // the empty list to protect the startup state) — otherwise disconnecting the
    // last connection would leave it in `last_open_connection_ids` and the app
    // would auto-reconnect it (and restore its tabs) on next launch.
    invoke('set_last_open_connections', { connectionIds: remainingIds }).catch(() => {});

    if (activeConnectionId === targetId) {
      if (remainingIds.length > 0) {
        setActiveConnectionId(remainingIds[0]);
      } else {
        setActiveConnectionId(null);
        setActiveTable(null);
        invoke('set_last_active_connection', { connectionId: null }).catch(() => {});
      }
    }
  };

  const detachConnection = useCallback((connectionId: string) => {
    clearAutocompleteCache(connectionId);

    setOpenConnectionIds(prev => prev.filter(id => id !== connectionId));
    setConnectionDataMap(prev => {
      const newMap = { ...prev };
      delete newMap[connectionId];
      return newMap;
    });

    setActiveConnectionId(prev => {
      if (prev !== connectionId) return prev;
      const remaining = openConnectionIds.filter(id => id !== connectionId);
      if (remaining.length > 0) return remaining[0];
      setActiveTable(null);
      return null;
    });
  }, [openConnectionIds, clearAutocompleteCache]);

  const switchConnection = useCallback((connectionId: string) => {
    if (openConnectionIds.includes(connectionId)) {
      setActiveConnectionId(connectionId);
      setActiveTable(null);
    }
  }, [openConnectionIds]);

  const setActiveTableContext = useCallback((table: string | null, database?: string | null, schema?: string | null) => {
    setActiveTable(table);
    if (!activeConnectionId) return;
    const updates: Partial<ConnectionData> = {};
    if (database !== undefined && database !== null) {
      updates.activeDatabase = database;
    }
    if (schema !== undefined) {
      updates.activeSchema = schema;
    }
    if (Object.keys(updates).length > 0) {
      updateConnectionData(activeConnectionId, updates);
    }
    if (schema !== undefined && schema !== null) {
      invoke('set_schema_preference', { connectionId: activeConnectionId, schema }).catch(() => {});
    }
  }, [activeConnectionId, updateConnectionData]);

  const setActiveDatabaseContext = useCallback((database: string | null, schema?: string | null) => {
    setActiveTable(null);
    if (!activeConnectionId) return;
    const currentData = connectionDataMap[activeConnectionId];
    const targetSchema = schema !== undefined
      ? schema
      : database
        ? currentData?.databaseDataMap[database]?.activeSchema ?? currentData?.databaseDataMap[database]?.selectedSchemas?.[0] ?? null
        : null;
    updateConnectionData(activeConnectionId, {
      activeDatabase: database,
      activeSchema: targetSchema,
    });
    if (database && currentData && !currentData.databaseDataMap[database]?.isLoaded) {
      void loadDatabaseData(database, activeConnectionId, true);
    }
    if (targetSchema) {
      invoke('set_schema_preference', { connectionId: activeConnectionId, schema: targetSchema }).catch(() => {});
    }
  }, [activeConnectionId, connectionDataMap, updateConnectionData, loadDatabaseData]);

  const setActiveSchema = useCallback((schema: string | null, database?: string | null) => {
    setActiveTable(null);
    if (!activeConnectionId) return;
    const updates: Partial<ConnectionData> = { activeSchema: schema };
    if (database !== undefined && database !== null) {
      updates.activeDatabase = database;
    }
    updateConnectionData(activeConnectionId, updates);
    if (schema) {
      invoke('set_schema_preference', { connectionId: activeConnectionId, schema }).catch(() => {});
    }
  }, [activeConnectionId, updateConnectionData]);

  const setActiveTableWithSchema = useCallback((table: string | null, schema?: string | null) => {
    setActiveTableContext(table, undefined, schema);
  }, [setActiveTableContext]);

  const loadConnections = useCallback(async () => {
    setIsLoadingConnections(true);
    try {
      const result = await invoke<ConnectionsFile>('get_connections_with_groups');
      setConnections(result.connections);
      setConnectionGroups(result.groups);
    } catch (e) {
      console.error('Failed to load connections:', e);
    } finally {
      setIsLoadingConnections(false);
    }
  }, []);

  const getConnectionData = useCallback((connectionId: string): ConnectionData | undefined => {
    return connectionDataMap[connectionId];
  }, [connectionDataMap]);

  const isConnectionOpen = useCallback((connectionId: string): boolean => {
    return openConnectionIds.includes(connectionId);
  }, [openConnectionIds]);

  // True when the connection is open in ANY window (this one or another), based
  // on the shared backend registry. Falls back to local state so a just-opened
  // connection reflects immediately, before the broadcast round-trips.
  const isConnectionOpenAnywhere = useCallback((connectionId: string): boolean => {
    return openConnectionIds.includes(connectionId)
      || globallyOpenConnectionIds.includes(connectionId);
  }, [openConnectionIds, globallyOpenConnectionIds]);

  // Auto-disconnect open connections when their plugin is disabled
  useEffect(() => {
    const currActiveExt = settings.activeExternalDrivers ?? [];
    const prevActiveExt = prevActiveExtRef.current;
    prevActiveExtRef.current = currActiveExt;

    // Skip on first render — no change to detect
    if (prevActiveExt === undefined) return;

    const removedDrivers = prevActiveExt.filter(id => !currActiveExt.includes(id));
    if (removedDrivers.length === 0) return;

    const toDisconnect = findConnectionsForDrivers(
      openConnectionIdsRef.current,
      connectionDataMapRef.current,
      removedDrivers,
    );
    toDisconnect.forEach(id => disconnect(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.activeExternalDrivers]);

  // Persist the active connection so the app can reconnect to it on next launch.
  // Skip null so a fresh launch (activeConnectionId starts null) doesn't wipe
  // the value before the startup auto-connect gets a chance to read it.
  useEffect(() => {
    if (!activeConnectionId) return;
    invoke('set_last_active_connection', { connectionId: activeConnectionId }).catch(() => {});
  }, [activeConnectionId]);

  // Persist the full set of open connections so the app can reopen all of them
  // on next launch. Skip the empty startup state so the saved list isn't wiped
  // before the startup auto-connect gets a chance to read it.
  useEffect(() => {
    if (openConnectionIds.length === 0) return;
    invoke('set_last_open_connections', { connectionIds: openConnectionIds }).catch(() => {});
  }, [openConnectionIds]);

  // Listen for backend health-check failures and clean up dead connections.
  useEffect(() => {
    const unlisten = listenTauri<{ connectionId: string; error: string }>(
      'connection-health-failed',
      (event) => {
        const { connectionId } = event;
        console.warn(`[DatabaseProvider] Connection health check failed for ${connectionId}: ${event.error}`);

        clearAutocompleteCache(connectionId);

        setOpenConnectionIds(prev => prev.filter(id => id !== connectionId));
        setConnectionDataMap(prev => {
          const next = { ...prev };
          delete next[connectionId];
          return next;
        });

        setActiveConnectionId(prev => {
          if (prev !== connectionId) return prev;
          const remaining = openConnectionIdsRef.current.filter(id => id !== connectionId);
          if (remaining.length > 0) return remaining[0];
          setActiveTable(null);
          return null;
        });
      },
    );
    return () => { unlisten.then(fn => fn()); };
  }, [clearAutocompleteCache]);

  // Track the set of connections open anywhere (across all windows). Seed from
  // the backend snapshot, then keep in sync via the broadcast event.
  useEffect(() => {
    invoke<string[]>('get_active_connections')
      .then(setGloballyOpenConnectionIds)
      .catch(() => {});
    const unlisten = listenTauri<string[]>('connections:active-changed', (connectionIds) => {
      setGloballyOpenConnectionIds(connectionIds);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Connection Group methods
  const createGroup = useCallback(async (
    name: string,
    parentId?: string | null
  ): Promise<ConnectionGroup> => {
    // The Tauri command expects `parent_id: Option<String>`. Passing
    // `null` directly is fine — Tauri serialises it as `null` in JSON
    // and the Rust deserializer maps it to `None`. Passing `undefined`
    // would also work because serde's default attribute treats it the
    // same, but we normalise to `null` for explicitness.
    const group = await invoke<ConnectionGroup>('create_connection_group', {
      name,
      parentId: parentId ?? null,
    });
    setConnectionGroups(prev => [...prev, group]);
    return group;
  }, []);

  const createGroupPath = useCallback(async (
    path: string,
    parentId?: string | null
  ): Promise<ConnectionGroup> => {
    const group = await invoke<ConnectionGroup>('create_group_path', {
      path,
      parentId: parentId ?? null,
    });
    // Re-fetch the full group list because the backend may have reused
    // existing segments and created new ones we don't yet know about.
    const fresh = await invoke<ConnectionGroup[]>('get_connection_groups');
    setConnectionGroups(fresh);
    return group;
  }, []);

  const updateGroup = useCallback(async (
    id: string,
    updates: { name?: string; collapsed?: boolean; sort_order?: number }
  ): Promise<void> => {
    await invoke('update_connection_group', { id, ...updates });
    setConnectionGroups(prev =>
      prev.map(g => (g.id === id ? { ...g, ...updates } : g))
    );
  }, []);

  const moveGroupToParent = useCallback(async (
    id: string,
    parentId: string | null
  ): Promise<void> => {
    await invoke('move_group_to_parent', { id, parentId });
    setConnectionGroups(prev =>
      prev.map(g => (g.id === id ? { ...g, parent_id: parentId } : g))
    );
  }, []);

  const deleteGroup = useCallback(async (id: string): Promise<void> => {
    // The backend cascade-deletes the target group, every nested child
    // group, and all connections belonging to any group in that subtree.
    // Re-load from the backend instead of mirroring the cascade in
    // optimistic state — this keeps the optimistic update trivial and
    // guarantees the UI matches the persisted file even if the cascade
    // behaviour evolves.
    await invoke('delete_connection_group', { id });
    const fresh = await invoke<ConnectionsFile>('get_connections_with_groups');
    setConnections(fresh.connections);
    setConnectionGroups(fresh.groups);
  }, []);

  const moveConnectionToGroup = useCallback(async (
    connectionId: string,
    groupId: string | null
  ): Promise<void> => {
    await invoke('move_connection_to_group', { connectionId, groupId });
    setConnections(prev =>
      prev.map(c => (c.id === connectionId ? { ...c, group_id: groupId ?? undefined } : c))
    );
  }, []);

  const reorderGroups = useCallback(async (
    groupOrders: Array<[string, number]>
  ): Promise<void> => {
    await invoke('reorder_groups', { groupOrders });
    setConnectionGroups(prev => {
      const orderMap = new Map(groupOrders);
      return prev.map(g => ({
        ...g,
        sort_order: orderMap.get(g.id) ?? g.sort_order,
      })).sort((a, b) => a.sort_order - b.sort_order);
    });
  }, []);

  const reorderConnectionsInGroup = useCallback(async (
    connectionOrders: Array<[string, number]>
  ): Promise<void> => {
    await invoke('reorder_connections_in_group', { connectionOrders });
    setConnections(prev => {
      const orderMap = new Map(connectionOrders);
      return prev.map(c => ({
        ...c,
        sort_order: orderMap.get(c.id) ?? c.sort_order,
      }));
    });
  }, []);

  const toggleGroupCollapsed = useCallback(async (groupId: string): Promise<void> => {
    const group = connectionGroups.find(g => g.id === groupId);
    if (group) {
      await updateGroup(groupId, { collapsed: !group.collapsed });
    }
  }, [connectionGroups, updateGroup]);

  return (
    <DatabaseContext.Provider value={{
      activeConnectionId,
      openConnectionIds,
      connectionDataMap,
      activeTable,
      activeDriver,
      activeCapabilities,
      activeConnectionName,
      activeDatabaseName,
      activeDatabase,
      tables,
      views,
      materializedViews,
      routines,
      triggers,
      isLoadingTables,
      isLoadingViews,
      isLoadingRoutines,
      isLoadingTriggers,
      schemas,
      isLoadingSchemas,
      schemaDataMap,
      activeSchema,
      selectedSchemas,
      needsSchemaSelection,
      selectedDatabases,
      databaseDataMap,
      connections,
      connectionGroups,
      loadConnections,
      isLoadingConnections,
      connect,
      disconnect,
      detachConnection,
      switchConnection,
      setActiveTable: setActiveTableWithSchema,
      setActiveTableContext,
      setActiveDatabaseContext,
      setActiveSchema,
      refreshTables,
      refreshViews,
      refreshRoutines,
      refreshTriggers,
      loadSchemaData,
      refreshSchemaData,
      setSelectedSchemas,
      loadDatabaseData,
      refreshDatabaseData,
      loadDatabaseSchemaData,
      refreshDatabaseSchemaData,
      setSelectedDatabases,
      getConnectionData,
      isConnectionOpen,
      isConnectionOpenAnywhere,
      globallyOpenConnectionIds,
      createGroup,
      createGroupPath,
      updateGroup,
      moveGroupToParent,
      deleteGroup,
      moveConnectionToGroup,
      reorderGroups,
      reorderConnectionsInGroup,
      toggleGroupCollapsed,
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
