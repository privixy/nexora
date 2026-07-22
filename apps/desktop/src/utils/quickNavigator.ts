import type { TableInfo, ViewInfo, RoutineInfo, TriggerInfo, SchemaData, DatabaseData } from '../features/connections';
import { fuzzyFilter } from './fuzzy';

export interface NavigatorItem {
  name: string;
  type: "table" | "view" | "routine" | "trigger";
  database?: string;
  schema?: string;
  detail?: string;
  item: TableInfo | ViewInfo | RoutineInfo | TriggerInfo;
}

export interface NavigatorItemParams {
  activeConnectionId: string | null;
  hasSchemas: boolean;
  isMultiDb: boolean;
  schemas: string[];
  schemaDataMap: Record<string, SchemaData>;
  configuredDatabases: string[];
  databaseDataMap: Record<string, DatabaseData>;
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  triggers: TriggerInfo[];
  activeSchema: string | null;
}

export function getNavigatorItems(params: NavigatorItemParams): NavigatorItem[] {
  const {
    activeConnectionId,
    hasSchemas,
    isMultiDb,
    schemas,
    schemaDataMap,
    configuredDatabases,
    databaseDataMap,
    tables,
    views,
    routines,
    triggers,
    activeSchema,
  } = params;

  if (!activeConnectionId) return [];

  const result: NavigatorItem[] = [];

  if (hasSchemas && isMultiDb && configuredDatabases.length > 0) {
    configuredDatabases.forEach((databaseName) => {
      const databaseData = databaseDataMap[databaseName];
      const databaseSchemas = databaseData?.selectedSchemas ?? databaseData?.schemas ?? [];
      databaseSchemas.forEach((schemaName) => {
        const data = databaseData?.schemaDataMap?.[schemaName];
        if (data) {
          if (data.tables) {
            data.tables.forEach((t) => {
              result.push({ name: t.name, type: "table", database: databaseName, schema: schemaName, item: t });
            });
          }
          if (data.views) {
            data.views.forEach((v) => {
              result.push({ name: v.name, type: "view", database: databaseName, schema: schemaName, item: v });
            });
          }
          if (data.routines) {
            data.routines.forEach((r) => {
              result.push({
                name: r.name,
                type: "routine",
                database: databaseName,
                schema: schemaName,
                detail: r.routine_type,
                item: r,
              });
            });
          }
          if (data.triggers) {
            data.triggers.forEach((trg) => {
              result.push({
                name: trg.name,
                type: "trigger",
                database: databaseName,
                schema: schemaName,
                detail: `on ${trg.table_name}`,
                item: trg,
              });
            });
          }
        }
      });
    });
  } else if (hasSchemas && schemas) {
    schemas.forEach((schemaName) => {
      const data = schemaDataMap[schemaName];
      if (data) {
        if (data.tables) {
          data.tables.forEach((t) => {
            result.push({ name: t.name, type: "table", schema: schemaName, item: t });
          });
        }
        if (data.views) {
          data.views.forEach((v) => {
            result.push({ name: v.name, type: "view", schema: schemaName, item: v });
          });
        }
        if (data.routines) {
          data.routines.forEach((r) => {
            result.push({
              name: r.name,
              type: "routine",
              schema: schemaName,
              detail: r.routine_type,
              item: r,
            });
          });
        }
        if (data.triggers) {
          data.triggers.forEach((trg) => {
            result.push({
              name: trg.name,
              type: "trigger",
              schema: schemaName,
              detail: `on ${trg.table_name}`,
              item: trg,
            });
          });
        }
      }
    });
  } else if (isMultiDb && configuredDatabases) {
    configuredDatabases.forEach((dbName) => {
      const data = databaseDataMap[dbName];
      if (data) {
        if (data.tables) {
          data.tables.forEach((t) => {
            result.push({ name: t.name, type: "table", database: dbName, schema: dbName, item: t });
          });
        }
        if (data.views) {
          data.views.forEach((v) => {
            result.push({ name: v.name, type: "view", database: dbName, schema: dbName, item: v });
          });
        }
        if (data.routines) {
          data.routines.forEach((r) => {
            result.push({
              name: r.name,
              type: "routine",
              database: dbName,
              schema: dbName,
              detail: r.routine_type,
              item: r,
            });
          });
        }
        if (data.triggers) {
          data.triggers.forEach((trg) => {
            result.push({
              name: trg.name,
              type: "trigger",
              database: dbName,
              schema: dbName,
              detail: `on ${trg.table_name}`,
              item: trg,
            });
          });
        }
      }
    });
  } else {
    if (tables) {
      tables.forEach((t) => {
        result.push({ name: t.name, type: "table", schema: activeSchema || undefined, item: t });
      });
    }
    if (views) {
      views.forEach((v) => {
        result.push({ name: v.name, type: "view", schema: activeSchema || undefined, item: v });
      });
    }
    if (routines) {
      routines.forEach((r) => {
        result.push({
          name: r.name,
          type: "routine",
          schema: activeSchema || undefined,
          detail: r.routine_type,
          item: r,
        });
      });
    }
    if (triggers) {
      triggers.forEach((trg) => {
        result.push({
          name: trg.name,
          type: "trigger",
          schema: activeSchema || undefined,
          detail: `on ${trg.table_name}`,
          item: trg,
        });
      });
    }
  }

  return result;
}

export function filterNavigatorItems(items: NavigatorItem[], search: string): NavigatorItem[] {
  return fuzzyFilter(items, search, (item) =>
    [item.name, item.database, item.schema].filter(Boolean).join(" "),
  );
}
