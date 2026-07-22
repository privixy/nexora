import { describe, expect, it } from "vitest";
import {
  buildCountQueryPayload,
  buildExecuteQueryPayload,
} from "../../../../src/features/editor/hooks/useQueryExecution";
import { buildBatchQueryPayload } from "../../../../src/features/editor/hooks/useBatchExecution";
import { buildTableMetadataPayload } from "../../../../src/features/editor/hooks/useTableMetadata";
import { buildExportQueryPayload } from "../../../../src/features/editor/hooks/useQueryExport";

const context = {
  connectionId: "conn-1",
  database: "analytics",
  schema: "reporting",
};

describe("editor gateway payload builders", () => {
  it("preserves query and batch context while omitting absent optional fields", () => {
    expect(buildExecuteQueryPayload({ ...context, query: "select 1", limit: 50, page: 2 })).toEqual({
      connectionId: "conn-1",
      query: "select 1",
      limit: 50,
      page: 2,
      database: "analytics",
      schema: "reporting",
    });
    expect(buildCountQueryPayload({ connectionId: "conn-1", query: "select 1" })).toEqual({
      connectionId: "conn-1",
      query: "select 1",
    });
    expect(buildBatchQueryPayload({ connectionId: "conn-1", queries: ["select 1"], limit: 50, page: 1, batchId: "batch-1" })).toEqual({
      connectionId: "conn-1",
      queries: ["select 1"],
      limit: 50,
      page: 1,
      batchId: "batch-1",
    });
  });

  it("preserves metadata and export payload names", () => {
    expect(buildTableMetadataPayload({ ...context, table: "events" })).toEqual({
      connectionId: "conn-1",
      tableName: "events",
      database: "analytics",
      schema: "reporting",
    });
    expect(buildExportQueryPayload({ ...context, query: "select 1", filePath: "/tmp/result.csv", format: "csv" })).toEqual({
      connectionId: "conn-1",
      query: "select 1",
      filePath: "/tmp/result.csv",
      format: "csv",
      database: "analytics",
      schema: "reporting",
    });
  });
});
