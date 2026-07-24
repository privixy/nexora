import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { listenTauri } from "../../../../src/platform/tauri/events";
import { windowGateway } from "../../../../src/platform/tauri/windowGateway";
import { useJsonViewerSession } from "../../../../src/features/data-grid/hooks/useJsonViewerSession";

vi.mock("../../../../src/platform/tauri/events", () => ({
  listenTauri: vi.fn(),
}));

vi.mock("../../../../src/platform/tauri/windowGateway", () => ({
  windowGateway: {
    openJsonViewer: vi.fn(),
  },
}));

describe("useJsonViewerSession", () => {
  it("keeps sessions until save and applies the saved value to the exact row", async () => {
    const onPendingChange = vi.fn();
    let onSaved: ((payload: { session_id: string; value: unknown }) => void) | undefined;
    vi.mocked(listenTauri).mockImplementation(async (_event, handler) => {
      onSaved = handler;
      return vi.fn();
    });
    vi.mocked(windowGateway.openJsonViewer).mockResolvedValue("session-1");

    const { result } = renderHook(() =>
      useJsonViewerSession({
        pkColumns: ["id"],
        pkIndexMaps: [0],
        onPendingChange,
      }),
    );

    await act(() =>
      result.current.openJsonViewerWindow({
        value: { enabled: false },
        originalValue: { enabled: false },
        colName: "settings",
        rowData: [7, { enabled: false }],
        rowIndex: 0,
        isInsertion: false,
        tempId: undefined,
        readOnly: false,
        rowLabel: "id=7",
      }),
    );

    expect(windowGateway.openJsonViewer).toHaveBeenCalledWith({
      value: { enabled: false },
      originalValue: { enabled: false },
      colName: "settings",
      rowLabel: "id=7",
      readOnly: false,
      cellKey: 'pk:{"id":7}:settings',
    });

    act(() => onSaved?.({ session_id: "session-1", value: { enabled: true } }));
    expect(onPendingChange).toHaveBeenCalledWith(
      { id: 7 },
      "settings",
      { enabled: true },
    );

    act(() => onSaved?.({ session_id: "session-1", value: { enabled: false } }));
    expect(onPendingChange).toHaveBeenCalledTimes(1);
  });

  it("unlistens on cleanup", async () => {
    const unlisten = vi.fn();
    vi.mocked(listenTauri).mockResolvedValue(unlisten);

    const { unmount } = renderHook(() =>
      useJsonViewerSession({ pkColumns: null, pkIndexMaps: [] }),
    );
    unmount();

    await waitFor(() => expect(unlisten).toHaveBeenCalledOnce());
  });
});
