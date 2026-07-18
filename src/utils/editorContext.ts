import type { Tab } from "../types/editor";
import type { DriverCapabilities } from "../types/plugins";
import { isMultiDatabaseCapable } from "./database";

export interface EditorExecutionContext {
  database?: string;
  schema?: string;
}

export interface ResolveEditorContextInput {
  tab?: Pick<Tab, "database" | "schema"> | null;
  capabilities: DriverCapabilities | null | undefined;
  activeDatabase: string | null | undefined;
  activeSchema: string | null | undefined;
  selectedDatabases: string[];
}

export function resolveEditorContext({
  tab,
  capabilities,
  activeDatabase,
  activeSchema,
  selectedDatabases,
}: ResolveEditorContextInput): EditorExecutionContext {
  const hasSchemas = capabilities?.schemas === true;
  const isMultiDb = isMultiDatabaseCapable(capabilities) && selectedDatabases.length > 1;

  if (hasSchemas) {
    const database = tab?.database ?? (isMultiDb ? activeDatabase ?? selectedDatabases[0] : activeDatabase ?? undefined);
    const schema = tab?.schema ?? activeSchema ?? undefined;
    return {
      ...(database ? { database } : {}),
      ...(schema ? { schema } : {}),
    };
  }

  const legacyDatabase = capabilities?.schemas === false && isMultiDb ? tab?.schema : undefined;
  const database = tab?.database ?? legacyDatabase ?? (isMultiDb ? activeDatabase ?? selectedDatabases[0] : undefined);
  return database ? { database } : {};
}
