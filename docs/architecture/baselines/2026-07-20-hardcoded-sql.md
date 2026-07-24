# Frontend SQL and Driver-Specific Debt Baseline

This is a read-only inventory of current behavior at commit `4cbe6824cf537c58b4b1fe1bb6233c0336f72018`.

## Scan scope and classification

The inventory covers every `src/**/*.{ts,tsx}` file. The scan combined searches for SQL statement keywords, SQL-bearing properties and calls (`query`, `sql`, `initialQuery`, `runQuery`, `execute_query`), template interpolation near SQL keywords, and concrete built-in driver/dialect literals in equality checks, switches, and fallbacks. Matches were inspected in context and classified as semantic frontend SQL, SQL-mediated backend DDL, user-facing query templates/generators, or concrete driver-name branching.

Excluded matches are SQL parsers, splitters, classifiers, formatters, syntax highlighters, autocomplete, dangerous-query detection, comments/type documentation, i18n text, test files under `src`, static built-in manifest definitions, and presentation-only driver labels/icons or explain legends. They inspect, describe, format, or display SQL/driver metadata rather than construct executable SQL or make behavior/capability decisions from a concrete driver name. `src/utils/connectionStringParser.ts:44-60` is also excluded because its concrete strings are URI protocol aliases rather than driver behavior branches.

## Semantic operations incorrectly expressed as frontend SQL

- `src/components/layout/sidebar/SidebarColumnItem.tsx:61-70`: quotes the current table and column, constructs `ALTER TABLE ... DROP COLUMN ...`, and sends it through `execute_query` with explicit connection, database, and schema context.
- `src/components/modals/NewRowModal.tsx:55-69`: fetches referenced-table options by constructing `SELECT * FROM ... LIMIT 100` and sending it through `execute_query`.
- `src/hooks/useReferencedRecord.ts:23-52`: constructs `SELECT * FROM ... WHERE ...` for foreign-key navigation and sends it through `execute_query` with a 100-row limit and page 1.
- `src/utils/foreignKeys.ts:82-118`: builds executable foreign-key `WHERE` fragments by quoting the referenced column and serializing numeric, boolean, or escaped string values; the fragments feed referenced-record fetch and navigation flows.
- `src/components/modals/TriggerEditorModal.tsx:124-138`: constructs trigger DDL in the frontend; it omits the schema from the `ON` target when `driver === "mysql"`.
- `src/components/modals/TriggerEditorModal.tsx:146-193`: preserves the current recreate flow by invoking `drop_trigger` before invoking `create_trigger` with frontend-generated or raw trigger SQL.

## SQL-mediated backend DDL

- `src/components/modals/CreateTableModal.tsx:132-146`: asks `get_create_table_sql` for statements and executes each returned statement through `execute_query`.
- `src/components/modals/CreateIndexModal.tsx:106-121`: asks `get_create_index_sql` for statements and executes each returned statement through `execute_query`.
- `src/components/modals/ModifyColumnModal.tsx:155-192`: asks `get_alter_column_sql` or `get_add_column_sql` for statements and executes each returned statement through `execute_query`.
- `src/components/modals/CreateForeignKeyModal.tsx:148-166`: asks `get_create_foreign_key_sql` for statements and executes each returned statement through `execute_query`.

## User-facing query templates and generators requiring future capability review

- `src/components/layout/ExplorerSidebar.tsx:490-592`: opening tables, views, database tables/views, and database-schema tables/views creates `SELECT * FROM ...` editor queries with quoted identifiers and explicit connection/database/schema navigation state.
- `src/components/layout/ExplorerSidebar.tsx:2207-2238`: table context-menu actions execute generated `SELECT *` and `SELECT COUNT(*)` queries; the adjacent new-console action delegates to `newConsoleForTable`.
- `src/components/layout/ExplorerSidebar.tsx:2464-2485`: view context-menu actions execute generated `SELECT *` and `SELECT COUNT(*)` queries with database/schema context.
- `src/components/layout/ExplorerSidebar.tsx:2533-2554`: materialized-view context-menu actions execute generated `SELECT *` and `SELECT COUNT(*)` queries with database/schema context.
- `src/components/modals/QuickNavigatorModal.tsx:139-194`: selecting a table or view creates a quoted `SELECT * FROM ...` editor query and carries the selected database/schema context.
- `src/components/modals/QuickNavigatorModal.tsx:261-292`: count-rows creates `SELECT COUNT(*)`, while new-console delegates to `newConsoleForTable`; both preserve database/schema context.
- `src/utils/newConsole.ts:14-23`: generates a quoted `SELECT * FROM ...` query for a table console.
- `src/utils/notebookVariables.ts:25-46`: serializes a prior cell result into a CTE body using `SELECT` literals, quoted aliases, and `UNION ALL`, including an empty-result `WHERE 1=0` query.
- `src/utils/notebookVariables.ts:81-110`: replaces notebook cell references with generated CTE aliases and prepends the assembled `WITH` clause to the user's SQL.
- `src/components/modals/ViewEditorModal.tsx:72-77`: seeds a new view's user-editable definition with the `SELECT * FROM ` template; the later preview/save paths submit user-edited SQL rather than independently generating it.
- `src/utils/sqlGenerator.ts:33-68`: resolves SQL syntax from capabilities or legacy driver-name fallbacks, including identifier quoting, auto-increment keywords, serial types, and inline primary keys.
- `src/utils/sqlGenerator.ts:75-149`: generates column definitions, primary-key constraints, and foreign-key constraints.
- `src/utils/sqlGenerator.ts:154-219`: generates unique and non-unique index statements.
- `src/utils/sqlGenerator.ts:227-263`: generates complete `CREATE TABLE` SQL plus index statements.
- `src/components/modals/GenerateSQLModal.tsx:50-83`: loads table metadata and generates `CREATE TABLE` SQL, defaulting to SQLite syntax when active capabilities are absent.
- `src/components/modals/GenerateSQLModal.tsx:105-142`: generates user-facing select-all, select-fields, update, and delete templates and can open them in a non-auto-running console.
- `src/utils/clipboard.ts:49-72`: serializes selected rows as MySQL-style backtick-quoted `INSERT INTO` statements.
- `src/utils/geometryInput.ts:8-57`: recognizes raw geometry SQL functions and generates `ST_GeomFromText(...)` expressions.
- `src/utils/geometryInput.ts:62-108`: exposes SQL-function placeholders/helper text and converts between WKT and raw SQL modes.
- `src/utils/editor.ts:338-374`: reconstructs executable table-tab `SELECT *` queries with filter, sort, limit, and optional limit-subquery wrapping.
- `src/utils/filterBar.ts:147-213`: turns structured filter inputs into executable SQL predicate fragments, including NULL, BETWEEN, IN/NOT IN, numeric, quoted, and escaped string forms; `reconstructTableQuery` later prefixes the resulting fragment with `WHERE`.
- `src/components/ui/TableToolbar.tsx:101-196`: commits raw or structured filter, formatted sort, and limit fragments through `onUpdate`; these fragments become part of reconstructed executable table queries.
- `src/pages/Editor.tsx:1736-1784`: foreign-key navigation builds a frontend SQL filter fragment, attaches it to a table tab, and triggers the reconstructed table query after the tab is created.
- `src/pages/Editor.tsx:1797-1817`: column-header sorting generates driver-formatted `ASC`/`DESC` SQL fragments that are fed into table-query reconstruction.
- `src/utils/visualQuery.ts:82-100`: formats table references for generated visual queries and changes database/schema qualification for PostgreSQL.
- `src/utils/visualQuery.ts:104-330`: generates visual-query select expressions and FROM/JOIN, WHERE, GROUP BY, HAVING, ORDER BY, and LIMIT clauses.
- `src/utils/visualQuery.ts:334-359`: assembles the generated clauses into a complete visual `SELECT` query.

## Driver-name branching

- `src/components/modals/NewConnectionModal.tsx:163-185`: initializes a new connection as MySQL with hardcoded host and port defaults before resolving the selected manifest.
- `src/components/modals/NewConnectionModal.tsx:668-679`: resets the create form to MySQL and port 3306 when opening without an existing connection.
- `src/components/modals/NewConnectionModal.tsx:1056-1076`: branches on PostgreSQL/MySQL names for connection-form grid sizing and default port placeholder text instead of manifest metadata.
- `src/components/modals/NewConnectionModal.tsx:1216-1248`: exposes the MySQL-only `PIPES_AS_CONCAT` connection option by checking `driver === "mysql"`.
- `src/components/modals/NewConnectionModal.tsx:1421-1473`: selects PostgreSQL, ClickHouse, or MySQL-family SSL defaults/options/labels and clears the MySQL cleartext-plugin setting when SSL is disabled via concrete driver checks.
- `src/components/modals/NewConnectionModal.tsx:1601-1608`: exposes MySQL cleartext-password configuration and derives its TLS gate only when `driver === "mysql"`.
- `src/utils/connections.ts:52-85`: falls back to `driver === "sqlite"` for local connection formatting and switches on PostgreSQL/MySQL/SQLite for default ports.
- `src/utils/connections.ts:95-115`: falls back to `driver === "sqlite"` when validating whether host is required without capabilities.
- `src/utils/connections.ts:172-187`: switches on PostgreSQL/MySQL/SQLite for human-readable labels; retained as a presentation canary because external drivers fall back to uppercased IDs.
- `src/utils/connections.ts:221-243`: falls back to `driver === "sqlite"` when generating a connection name without capabilities.
- `src/utils/identifiers.ts:9-17`: chooses backticks for MySQL/MariaDB string driver IDs and double quotes otherwise when manifest capabilities are unavailable.
- `src/utils/identifiers.ts:33-59`: applies PostgreSQL-specific conditional identifier quoting.
- `src/utils/sqlGenerator.ts:33-68`: maps legacy MySQL/MariaDB/PostgreSQL/SQLite names to SQL-generation behavior when capabilities are not supplied.
- `src/utils/tableToolbar.ts:101-127`: rewrites `ORDER BY` terms only when `driver === "postgres"`.
- `src/utils/visualQuery.ts:94-100`: includes database qualification for non-PostgreSQL drivers but only schema qualification for PostgreSQL.
- `src/components/modals/TriggerEditorModal.tsx:124-137`: defaults identifier quoting to PostgreSQL and suppresses schema qualification only for MySQL while generating trigger SQL.
- `src/components/modals/GenerateSQLModal.tsx:75-82`: defaults missing SQL-generation capabilities to the concrete SQLite dialect.
- `src/components/modals/CreateTableModal.tsx:32-37`: defaults the active driver to SQLite before loading driver-specific data types.
- `src/components/layout/ExplorerSidebar.tsx:2983-3020`: defaults missing active-driver context to SQLite for table, index, and foreign-key modals.
- `src/components/modals/VisualExplainModal.tsx:51-59`: defaults missing connection/plan driver metadata to SQLite before resolving the driver manifest and label.

These entries are behavior canaries only. Remediation requires a separate approved design.
