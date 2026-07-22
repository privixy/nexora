import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  catalogGateway,
  connectionGateway,
  queryGateway,
  recordGateway,
} from "../../../src/platform/tauri";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

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
  });

  it("preserves gateway rejection identity", async () => {
    const sentinel = { sentinel: true };
    vi.mocked(invoke).mockRejectedValue(sentinel);
    await expect(queryGateway.executeQuery({ query: "select 1" })).rejects.toBe(sentinel);
  });
});
