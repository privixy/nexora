import { useState } from "react";

type SaveSelection = (selection: string[]) => void | Promise<void>;

const toggle = (selection: Set<string>, value: string) => {
  const next = new Set(selection);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

export const useExplorerSelection = () => {
  const [pendingSchemas, setPendingSchemas] = useState<Set<string>>(new Set());
  const [pendingDatabases, setPendingDatabases] = useState<Set<string>>(new Set());

  return {
    pendingSchemas,
    pendingDatabases,
    resetSchemas: (schemas: Iterable<string>) => setPendingSchemas(new Set(schemas)),
    resetDatabases: (databases: Iterable<string>) => setPendingDatabases(new Set(databases)),
    toggleSchema: (schema: string) => setPendingSchemas((selection) => toggle(selection, schema)),
    toggleDatabase: (database: string) => setPendingDatabases((selection) => toggle(selection, database)),
    toggleAllSchemas: (schemas: string[]) =>
      setPendingSchemas((selection) => new Set(selection.size === schemas.length ? [] : schemas)),
    toggleAllDatabases: (databases: string[]) =>
      setPendingDatabases((selection) => new Set(selection.size === databases.length ? [] : databases)),
    confirmSchemas: async (save: SaveSelection) => save(Array.from(pendingSchemas)),
    confirmDatabases: async (save: SaveSelection) => save(Array.from(pendingDatabases)),
  };
};
