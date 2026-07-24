import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSchemaMetadata } from "../../../../src/features/schema/hooks/useSchemaMetadata";

const schema = [
  {
    name: "users",
    columns: [{ name: "id", data_type: "integer" }],
    foreign_keys: [],
  },
];

describe("useSchemaMetadata", () => {
  it("loads metadata once and preserves already-loaded data", async () => {
    const first = vi.fn().mockResolvedValue(schema);
    const stale = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useSchemaMetadata());

    expect(result.current.isLoaded).toBe(false);
    await act(() => result.current.loadSchema(first));
    expect(result.current.schema).toEqual(schema);
    expect(result.current.isLoaded).toBe(true);
    await act(() => result.current.loadSchema(stale));
    expect(stale).not.toHaveBeenCalled();
    expect(result.current.schema).toEqual(schema);
  });

  it("passes explicit database context to the loading workflow", async () => {
    const tuple = {
      connectionId: "connection",
      database: "database",
      schema: "public",
      table: "users",
    };
    const backend = vi.fn().mockResolvedValue(schema);
    const { result } = renderHook(() => useSchemaMetadata());

    await act(() => result.current.loadSchema(() => backend(tuple)));

    expect(backend).toHaveBeenCalledWith(tuple);
    expect(result.current.getTableColumns("users")).toEqual([
      { name: "id", type: "integer" },
    ]);
  });
});
