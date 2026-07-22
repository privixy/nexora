import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGridSelection } from "../../../../src/features/data-grid/hooks/useGridSelection";

function mouseEvent(overrides: Partial<React.MouseEvent> = {}): React.MouseEvent {
  return {
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  } as React.MouseEvent;
}

describe("useGridSelection", () => {
  it("preserves single, toggle, and range selection behavior", () => {
    const onSelectionChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ selectedRows }: { selectedRows?: Set<number> }) =>
        useGridSelection({ selectedRows, onSelectionChange }),
      { initialProps: { selectedRows: undefined } },
    );

    act(() => result.current.handleRowClick(1, mouseEvent()));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set([1]));

    rerender({ selectedRows: new Set([1]) });
    act(() => result.current.handleRowClick(3, mouseEvent({ ctrlKey: true })));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set([1, 3]));

    rerender({ selectedRows: new Set([1, 3]) });
    act(() => result.current.handleRowClick(5, mouseEvent({ shiftKey: true })));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set([3, 4, 5]));
  });

  it("owns selection internally when no callback is provided", () => {
    const { result } = renderHook(() => useGridSelection({}));

    act(() => result.current.updateSelection(new Set([2])));

    expect(result.current.selectedRowIndices).toEqual(new Set([2]));
  });
});
