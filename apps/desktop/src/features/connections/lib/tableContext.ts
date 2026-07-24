import type { DriverCapabilities } from "../../plugins/contracts";
import { isMultiDatabaseCapable } from "../../plugins/lib/databaseCapabilities";
import type { TableContextTuple } from "../contracts";

export interface ExplicitTableContextInput {
  capabilities: DriverCapabilities | null | undefined;
  connectionId?: string | null;
  database?: string | null;
  schema?: string | null;
  table?: string | null;
}

export function resolveExplicitTableContext({
  capabilities,
  connectionId,
  database,
  schema,
  table,
}: ExplicitTableContextInput): TableContextTuple | null {
  if (!connectionId || !table) return null;
  if (isMultiDatabaseCapable(capabilities) && !database) return null;
  if (capabilities?.schemas === true && !schema) return null;

  return {
    connectionId,
    database: database ?? undefined,
    schema: schema ?? undefined,
    table,
  };
}
