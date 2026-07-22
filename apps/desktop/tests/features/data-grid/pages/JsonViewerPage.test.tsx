import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { windowGateway } from "../../../../src/platform/tauri";
import { JsonViewerPage } from "../../../../src/features/data-grid/pages/JsonViewerPage";

const close = vi.fn();

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams("session=session-1")],
}));

vi.mock("../../../../src/platform/tauri", () => ({
  windowGateway: {
    getCurrentWindow: vi.fn(() => ({ close })),
    getJsonViewerSession: vi.fn(),
    completeJsonViewerSession: vi.fn(),
  },
}));

vi.mock("../../../../src/features/data-grid/components/JsonInput", () => ({
  JsonInput: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ saved: true })}>change-json</button>
  ),
}));

describe("JsonViewerPage", () => {
  it("loads, saves, and closes through the window gateway", async () => {
    vi.mocked(windowGateway.getJsonViewerSession).mockResolvedValue({
      value: { saved: false },
      original_value: { saved: false },
      col_name: "payload",
      read_only: false,
    });

    render(<JsonViewerPage />);

    await waitFor(() => {
      expect(windowGateway.getJsonViewerSession).toHaveBeenCalledWith({ sessionId: "session-1" });
    });
    fireEvent.click(screen.getByText("change-json"));
    fireEvent.click(screen.getByText("jsonViewer.save"));

    await waitFor(() => {
      expect(windowGateway.completeJsonViewerSession).toHaveBeenCalledWith({
        sessionId: "session-1",
        value: { saved: true },
      });
    });
    expect(close).toHaveBeenCalled();
  });
});
