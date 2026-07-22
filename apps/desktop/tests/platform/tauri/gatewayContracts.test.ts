import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  catalogGateway,
  connectionGateway,
  dataTransferGateway,
  fileGateway,
  queryGateway,
  recordGateway,
  windowGateway,
} from "../../../src/platform/tauri";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe("Tauri gateway contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves connection command wrappers", async () => {
    const params = { driver: "sqlite", database: "/tmp/db.sqlite" };
    await connectionGateway.createConnection({ params });
    expect(invoke).toHaveBeenCalledWith("create_connection", { params });
    await connectionGateway.updateConnection({ params, connection_id: "id" });
    expect(invoke).toHaveBeenCalledWith("update_connection", { params, connection_id: "id" });
    await connectionGateway.testConnection({ params, connection_id: undefined });
    expect(invoke).toHaveBeenCalledWith("test_connection", { params, connection_id: undefined });
    await connectionGateway.getConnections();
    expect(invoke).toHaveBeenCalledWith("get_connections");
    await connectionGateway.invoke("get_active_connections");
    expect(invoke).toHaveBeenCalledWith("get_active_connections");
    await connectionGateway.invoke("set_last_open_connections", { connectionIds: ["id"] });
    expect(invoke).toHaveBeenCalledWith("set_last_open_connections", { connectionIds: ["id"] });
    await connectionGateway.listDatabases({ request: { params, connection_id: undefined } });
    expect(invoke).toHaveBeenCalledWith("list_databases", { request: { params, connection_id: undefined } });
    await connectionGateway.saveConnection({ name: "name", params, detectJsonInTextColumns: null });
    expect(invoke).toHaveBeenCalledWith("save_connection", { name: "name", params, detectJsonInTextColumns: null });
    await connectionGateway.updateSavedConnection({ id: "id", name: "name", params, detectJsonInTextColumns: null });
    expect(invoke).toHaveBeenCalledWith("update_connection", { id: "id", name: "name", params, detectJsonInTextColumns: null });
    await connectionGateway.setConnectionAppearance({ id: "id", appearance: null });
    expect(invoke).toHaveBeenCalledWith("set_connection_appearance", { id: "id", appearance: null });
    await connectionGateway.deleteConnectionIcon({ relativePath: "icon.png" });
    expect(invoke).toHaveBeenCalledWith("delete_connection_icon", { relativePath: "icon.png" });
  });

  it("preserves window command wrappers", async () => {
    await windowGateway.setWindowTitle({ title: "Nexora" });
    expect(invoke).toHaveBeenCalledWith("set_window_title", { title: "Nexora" });
    await windowGateway.openJsonViewer({ value: { a: 1 }, originalValue: null });
    expect(invoke).toHaveBeenCalledWith("open_json_viewer_window", {
      value: { a: 1 },
      originalValue: null,
    });
    await windowGateway.getJsonViewerSession({ sessionId: "session-1" });
    expect(invoke).toHaveBeenCalledWith("get_json_viewer_session", { sessionId: "session-1" });
    await windowGateway.completeJsonViewerSession({ sessionId: "session-1", value: { a: 2 } });
    expect(invoke).toHaveBeenCalledWith("complete_json_viewer_session", {
      sessionId: "session-1",
      value: { a: 2 },
    });
  });

  it("forwards catalog, query, and record payloads unchanged", async () => {
    const payload = { connectionId: "id", database: "db", schema: undefined };
    await catalogGateway.getColumns(payload);
    expect(invoke).toHaveBeenCalledWith("get_columns", payload);
    await queryGateway.executeQuery(payload);
    expect(invoke).toHaveBeenCalledWith("execute_query", payload);
    await recordGateway.insertRecord(payload);
    expect(invoke).toHaveBeenCalledWith("insert_record", payload);
    await recordGateway.updateRecord(payload);
    expect(invoke).toHaveBeenCalledWith("update_record", payload);
    await recordGateway.deleteRecord(payload);
    expect(invoke).toHaveBeenCalledWith("delete_record", payload);
    await recordGateway.getServerNow({ connectionId: "id" });
    expect(invoke).toHaveBeenCalledWith("get_server_now", { connectionId: "id" });
  });

  it("forwards explorer commands and files unchanged", async () => {
    const payload = { connectionId: "id", database: "db", schema: "public" };
    await dataTransferGateway.invoke("create_schema", payload);
    expect(invoke).toHaveBeenCalledWith("create_schema", payload);
    await dataTransferGateway.dumpDatabase(payload);
    expect(invoke).toHaveBeenCalledWith("dump_database", payload);
    await dataTransferGateway.importDatabase(payload);
    expect(invoke).toHaveBeenCalledWith("import_database", payload);
    await fileGateway.readTextFile("notebook.json");
    expect(readTextFile).toHaveBeenCalledWith("notebook.json");
    await fileGateway.writeTextFile("notebook.json", "{}");
    expect(writeTextFile).toHaveBeenCalledWith("notebook.json", "{}");
  });

  it("preserves gateway rejection identity", async () => {
    const sentinel = { sentinel: true };
    vi.mocked(invoke).mockRejectedValue(sentinel);
    await expect(queryGateway.executeQuery({ query: "select 1" })).rejects.toBe(sentinel);
  });
});
