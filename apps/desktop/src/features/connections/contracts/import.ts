export type ImportItemStatus =
  | { kind: "ready" }
  | { kind: "duplicate"; existingId: string; existingName: string }
  | { kind: "warnings"; warnings: string[] };
export interface ImportSourceInfo {
  id: string;
  displayName: string;
  available: boolean;
  connectionCount: number;
  readsPasswordsFromKeychain: boolean;
  needsFile: boolean;
}
export interface ImportItem {
  index: number;
  name: string;
  driverId: string;
  driverInstalled: boolean;
  host: string;
  port: number;
  database: string;
  username: string;
  hasSsh: boolean;
  hasPassword: boolean;
  groupName?: string;
  status: ImportItemStatus;
}
export interface ImportPreview {
  sourceName: string;
  credentialsAborted: boolean;
  items: ImportItem[];
}
export type ImportAction = "import" | "skip" | "replace";
export interface ImportResolution {
  index: number;
  action: ImportAction;
  replaceExistingId?: string;
  groupId?: string;
  newGroupName?: string;
  newGroupParentId?: string;
}
