import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExplorerActions } from "../../../../src/features/explorer/hooks/useExplorerActions";

describe("useExplorerActions", () => {
  it("opens tables with the explicit connection/database/schema/table tuple", () => {
    const navigate = vi.fn();
    const setActiveTableContext = vi.fn();
    const { result } = renderHook(() =>
      useExplorerActions({
        connectionId: "conn-2",
        driver: "postgres",
        navigate,
        setActiveTableContext,
      }),
    );

    act(() => result.current.openTable("orders", "analytics", "reporting"));

    expect(setActiveTableContext).toHaveBeenCalledWith("orders", "analytics", "reporting");
    expect(navigate).toHaveBeenCalledWith("/editor", {
      state: expect.objectContaining({
        targetConnectionId: "conn-2",
        database: "analytics",
        schema: "reporting",
        tableName: "orders",
        initialQuery: 'SELECT * FROM "reporting"."orders"',
      }),
    });
  });
});
