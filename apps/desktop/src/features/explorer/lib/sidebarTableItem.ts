/**
 * Memoization helpers for the sidebar table item.
 *
 * `SidebarTableItem` is rendered once per table and the sidebar re-renders
 * frequently (e.g. when `activeTable` changes after selecting a Quick
 * Navigator result). With hundreds of tables, re-rendering every item on each
 * change makes the UI unresponsive. The comparator below lets `React.memo`
 * skip items whose meaningful data hasn't changed, so switching the active
 * table only re-renders the two affected items instead of all of them.
 */

/** Subset of the table item props that actually affect its rendered output. */
import type { ContextMenuData } from "../contracts";

export interface TableItemComparableProps {
  table: { name: string };
  activeTable: string | null;
  connectionId: string;
  driver: string;
  canManage?: boolean;
  schemaVersion: number;
  database?: string;
  schema?: string;
}

/**
 * Returns true when two sets of table-item props are equivalent for rendering.
 *
 * Callback identity is intentionally ignored: the handlers are recreated on
 * every parent render but behave the same, and any captured value that matters
 * (connection / driver) is part of the comparison. Rather than comparing
 * `activeTable` directly — which is the same global value for every item and so
 * changes for all of them at once — we compare whether *this* item is the
 * active one, which only flips for the item gaining and the item losing focus.
 */
export function getSidebarTableContext(tableName: string, database?: string, schema?: string): ContextMenuData {
  return {
    tableName,
    database,
    schema,
  };
}

export function areTableItemPropsEqual(
  prev: TableItemComparableProps,
  next: TableItemComparableProps,
): boolean {
  const wasActive = prev.activeTable === prev.table.name;
  const isActive = next.activeTable === next.table.name;
  return (
    prev.table.name === next.table.name &&
    wasActive === isActive &&
    prev.connectionId === next.connectionId &&
    prev.driver === next.driver &&
    prev.canManage === next.canManage &&
    prev.schemaVersion === next.schemaVersion &&
    prev.database === next.database &&
    prev.schema === next.schema
  );
}

/** Escape a string for safe use inside a double-quoted CSS attribute selector. */
function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Builds the CSS selector that matches a sidebar table item's outer element.
 *
 * Must stay in sync with the `data-table-name` / `data-database` /
 * `data-schema` attributes set by `SidebarTableItem` (where missing values are
 * rendered as empty strings). Values are escaped so names containing quotes or
 * backslashes don't produce an invalid selector.
 */
export function buildTableItemSelector(
  tableName: string,
  database?: string | null,
  schema?: string | null,
): string {
  const name = escapeAttributeValue(tableName);
  const db = escapeAttributeValue(database ?? "");
  const sch = escapeAttributeValue(schema ?? "");
  return `[data-table-name="${name}"][data-database="${db}"][data-schema="${sch}"]`;
}
