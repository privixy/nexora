import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExplorerSelection } from "../../../../src/features/explorer/hooks/useExplorerSelection";

describe("useExplorerSelection", () => {
  it("keeps explicit schema and database selections independent", async () => {
    const saveSchemas = vi.fn().mockResolvedValue(undefined);
    const saveDatabases = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useExplorerSelection());

    act(() => {
      result.current.resetSchemas(["reporting"]);
      result.current.toggleSchema("archive");
      result.current.resetDatabases(["analytics"]);
      result.current.toggleDatabase("warehouse");
    });

    expect(result.current.pendingSchemas).toEqual(new Set(["reporting", "archive"]));
    expect(result.current.pendingDatabases).toEqual(new Set(["analytics", "warehouse"]));

    await act(() => result.current.confirmSchemas(saveSchemas));
    await act(() => result.current.confirmDatabases(saveDatabases));

    expect(saveSchemas).toHaveBeenCalledWith(["reporting", "archive"]);
    expect(saveDatabases).toHaveBeenCalledWith(["analytics", "warehouse"]);
  });
});
