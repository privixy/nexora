import type { DriverCapabilities } from "../plugins";

export interface ConnectionParams {
  driver: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string | string[];
  ssl_mode?: string;
  ssl_ca?: string;
  ssl_cert?: string;
  ssl_key?: string;
  enable_cleartext_plugin?: boolean;
  pipes_as_concat?: boolean;
  ssh_enabled?: boolean;
  ssh_connection_id?: string;
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_file?: string;
  ssh_key_passphrase?: string;
  ssh_allow_passphrase_prompt?: boolean;
  save_in_keychain?: boolean;
  k8s_enabled?: boolean;
  k8s_connection_id?: string;
  k8s_context?: string;
  k8s_namespace?: string;
  k8s_resource_type?: string;
  k8s_resource_name?: string;
  k8s_port?: number;
  startup_script?: string;
}
export type SingleDatabaseConnectionParams = Omit<ConnectionParams, "database"> & { database: string };
export interface DatabaseContextTuple {
  connectionId: string;
  database?: string;
  schema?: string;
}
export interface TableContextTuple extends DatabaseContextTuple {
  table: string;
}
export interface TableInfo {
  name: string;
  schema?: string;
}
export interface ViewInfo {
  name: string;
  definition?: string;
}
export interface RoutineInfo {
  name: string;
  routine_type: string;
  definition?: string;
}
export interface TriggerInfo {
  name: string;
  table_name: string;
  event: string;
  timing: string;
  definition?: string;
}
export type IconOverride =
  | { type: "pack"; id: string }
  | { type: "emoji"; value: string }
  | { type: "image"; path: string };
export interface ConnectionAppearance {
  icon?: IconOverride;
  accentColor?: string;
}
export interface SavedConnection {
  id: string;
  name: string;
  params: ConnectionParams;
  group_id?: string;
  sort_order?: number;
  detect_json_in_text_columns?: boolean;
  appearance?: ConnectionAppearance;
}
export interface ConnectionGroup {
  id: string;
  name: string;
  collapsed: boolean;
  sort_order: number;
  parent_id?: string | null;
}
export interface ConnectionsFile {
  groups: ConnectionGroup[];
  connections: SavedConnection[];
}
export interface SchemaData {
  tables: TableInfo[];
  views: ViewInfo[];
  materializedViews?: ViewInfo[];
  routines: RoutineInfo[];
  triggers: TriggerInfo[];
  isLoading: boolean;
  isLoaded: boolean;
}
export interface DatabaseData extends SchemaData {
  schemas?: string[];
  isLoadingSchemas?: boolean;
  schemaDataMap?: Record<string, SchemaData>;
  activeSchema?: string | null;
  selectedSchemas?: string[];
  needsSchemaSelection?: boolean;
}
export interface ConnectionData {
  driver: string;
  capabilities: DriverCapabilities | null;
  connectionName: string;
  databaseName: string;
  tables: TableInfo[];
  views: ViewInfo[];
  routines: RoutineInfo[];
  triggers: TriggerInfo[];
  isLoadingTables: boolean;
  isLoadingViews: boolean;
  isLoadingRoutines: boolean;
  isLoadingTriggers: boolean;
  schemas: string[];
  isLoadingSchemas: boolean;
  schemaDataMap: Record<string, SchemaData>;
  activeDatabase: string | null;
  activeSchema: string | null;
  selectedSchemas: string[];
  needsSchemaSelection: boolean;
  selectedDatabases: string[];
  databaseDataMap: Record<string, DatabaseData>;
  isConnecting: boolean;
  isConnected: boolean;
  error?: string;
}
export interface DatabaseContextType {
  activeConnectionId: string | null;
  openConnectionIds: string[];
  connectionDataMap: Record<string, ConnectionData>;
  activeTable: string | null;
  activeDriver: string | null;
  activeCapabilities: DriverCapabilities | null;
  activeConnectionName: string | null;
  activeDatabaseName: string | null;
  tables: TableInfo[];
  views: ViewInfo[];
  materializedViews: ViewInfo[];
  routines: RoutineInfo[];
  triggers: TriggerInfo[];
  isLoadingTables: boolean;
  isLoadingViews: boolean;
  isLoadingRoutines: boolean;
  isLoadingTriggers: boolean;
  schemas: string[];
  isLoadingSchemas: boolean;
  schemaDataMap: Record<string, SchemaData>;
  activeDatabase: string | null;
  activeSchema: string | null;
  selectedSchemas: string[];
  needsSchemaSelection: boolean;
  selectedDatabases: string[];
  databaseDataMap: Record<string, DatabaseData>;
  connections: SavedConnection[];
  connectionGroups: ConnectionGroup[];
  loadConnections: () => Promise<void>;
  isLoadingConnections: boolean;
  connect: (connectionId: string) => Promise<void>;
  disconnect: (connectionId?: string) => Promise<void>;
  detachConnection: (connectionId: string) => void;
  switchConnection: (connectionId: string) => void;
  setActiveTable: (table: string | null, schema?: string | null) => void;
  setActiveTableContext: (table: string | null, database?: string | null, schema?: string | null) => void;
  setActiveDatabaseContext: (database: string | null, schema?: string | null) => void;
  setActiveSchema: (schema: string | null, database?: string | null) => void;
  refreshTables: (connectionId?: string) => Promise<void>;
  refreshViews: (connectionId?: string) => Promise<void>;
  refreshRoutines: (connectionId?: string) => Promise<void>;
  refreshTriggers: (connectionId?: string) => Promise<void>;
  loadSchemaData: (schema: string, connectionId?: string) => Promise<void>;
  refreshSchemaData: (schema: string, connectionId?: string) => Promise<void>;
  setSelectedSchemas: (schemas: string[], connectionId?: string) => Promise<void>;
  loadDatabaseData: (database: string, connectionId?: string, activate?: boolean) => Promise<void>;
  refreshDatabaseData: (database: string, connectionId?: string) => Promise<void>;
  loadDatabaseSchemaData: (database: string, schema: string, connectionId?: string, activate?: boolean) => Promise<void>;
  refreshDatabaseSchemaData: (database: string, schema: string, connectionId?: string) => Promise<void>;
  setSelectedDatabases: (databases: string[], connectionId?: string) => void;
  getConnectionData: (connectionId: string) => ConnectionData | undefined;
  isConnectionOpen: (connectionId: string) => boolean;
  globallyOpenConnectionIds: string[];
  isConnectionOpenAnywhere: (connectionId: string) => boolean;
  createGroup: (name: string, parentId?: string | null) => Promise<ConnectionGroup>;
  createGroupPath: (path: string, parentId?: string | null) => Promise<ConnectionGroup>;
  updateGroup: (id: string, updates: { name?: string; collapsed?: boolean; sort_order?: number }) => Promise<void>;
  moveGroupToParent: (id: string, parentId: string | null) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  moveConnectionToGroup: (connectionId: string, groupId: string | null) => Promise<void>;
  reorderGroups: (groupOrders: Array<[string, number]>) => Promise<void>;
  reorderConnectionsInGroup: (connectionOrders: Array<[string, number]>) => Promise<void>;
  toggleGroupCollapsed: (groupId: string) => Promise<void>;
}
