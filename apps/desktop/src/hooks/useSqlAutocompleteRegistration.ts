import { useEffect } from "react";
import type { Monaco } from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import { useDatabase } from "./useDatabase";
import { isMultiDatabaseCapable } from "../features/plugins";
import { registerSqlAutocomplete, disposeSqlAutocomplete } from "../utils/autocomplete";

type Options = {
  monaco?: Monaco | null;
  database?: string | null;
  schema?: string | null;
  /** When false, skips registration (e.g. inactive notebook tabs). Defaults to true. */
  enabled?: boolean;
};

/**
 * Keeps the global SQL completion provider in sync with the active connection.
 * Pass `monaco` from the main editor when available; otherwise Monaco is loaded via loader.init (notebook).
 */
export function useSqlAutocompleteRegistration(
  connectionId: string | null,
  options?: Options,
) {
  const {
    tables,
    activeDriver,
    activeSchema,
    activeDatabase,
    activeCapabilities,
    schemaDataMap,
    databaseDataMap,
    selectedDatabases,
  } = useDatabase();

  const schema = options?.schema ?? activeSchema;
  const database = options?.database ?? activeDatabase;
  const isMultiDb =
    isMultiDatabaseCapable(activeCapabilities) && selectedDatabases.length > 1;

  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!connectionId || !enabled) return;

    let cancelled = false;

    const register = (monaco: Monaco) => {
      if (cancelled) return;

      const databaseData = database ? databaseDataMap[database] : undefined;
      let effectiveTables = tables;
      if (activeCapabilities?.schemas && schema) {
        effectiveTables = database
          ? (databaseData?.schemaDataMap?.[schema]?.tables ?? [])
          : (schemaDataMap[schema]?.tables ?? []);
      } else if (isMultiDb) {
        effectiveTables = database ? (databaseData?.tables ?? []) : [];
      }

      registerSqlAutocomplete(
        monaco,
        connectionId,
        effectiveTables,
        schema,
        activeDriver ?? null,
        database,
      );
    };

    const cleanup = () => {
      cancelled = true;
      disposeSqlAutocomplete();
    };

    if (options?.monaco) {
      register(options.monaco);
      return cleanup;
    }

    loader.init().then((monaco) => register(monaco));
    return cleanup;
  }, [
    connectionId,
    enabled,
    options?.monaco,
    schema,
    database,
    tables,
    activeDriver,
    activeCapabilities,
    schemaDataMap,
    databaseDataMap,
    isMultiDb,
  ]);
}
