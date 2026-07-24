import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useExplorerContextMenu } from "../../../../src/features/explorer/hooks/useExplorerContextMenu";

describe("useExplorerContextMenu", () => {
  it("preserves the explicit object context", () => {
    const { result } = renderHook(() => useExplorerContextMenu());
    const preventDefault = () => undefined;

    act(() => {
      result.current.openContextMenu(
        { preventDefault, clientX: 12, clientY: 34 },
        "table",
        "orders",
        "orders",
        { database: "analytics", schema: "reporting", tableName: "orders" },
      );
    });

    expect(result.current.contextMenu).toMatchObject({
      x: 12,
      y: 34,
      type: "table",
      id: "orders",
      data: { database: "analytics", schema: "reporting", tableName: "orders" },
    });
  });
});
