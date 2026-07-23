import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGridClipboard } from "../../../../src/features/data-grid/hooks/useGridClipboard";
import { copyTextToClipboard } from "../../../../src/shared/lib/clipboard";

vi.mock("../../../../src/shared/lib/clipboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/shared/lib/clipboard")>()),
  copyTextToClipboard: vi.fn(),
}));

describe("useGridClipboard", () => {
  it("formats selected rows with headers and preserves SQL table context", async () => {
    const { result } = renderHook(() =>
      useGridClipboard({
        columns: ["id", "name"],
        data: [[1, "Alice"]],
        selectedRowIndices: new Set([0]),
        copyFormat: "sql-insert",
        tableName: "users",
        csvDelimiter: ",",
        csvIncludeHeaders: true,
        showAlert: vi.fn(),
        t: (key) => key,
      }),
    );

    await act(() => result.current.copySelectedCells());

    expect(copyTextToClipboard).toHaveBeenCalledWith(
      "INSERT INTO `users` (`id`, `name`) VALUES (1, 'Alice');",
    );
  });

  it("shows the existing error alert when clipboard writing fails", async () => {
    const showAlert = vi.fn();
    vi.mocked(copyTextToClipboard).mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() =>
      useGridClipboard({
        columns: ["id"],
        data: [[1]],
        selectedRowIndices: new Set([0]),
        csvDelimiter: ",",
        csvIncludeHeaders: true,
        showAlert,
        t: (key) => key,
      }),
    );

    await act(() => result.current.copySelectedCells());

    expect(showAlert).toHaveBeenCalledWith("common.error: Error: denied", {
      title: "common.error",
      kind: "error",
    });
  });
});
