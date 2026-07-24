import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { McpModal } from "../../../../src/features/mcp/components/McpModal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../../src/shared/hooks/useAlert", () => ({ useAlert: () => ({ showAlert: vi.fn() }) }));
vi.mock("../../../../src/features/settings/hooks/useEditorTheme", () => ({ useEditorTheme: () => ({ id: "vs-dark" }) }));
vi.mock("../../../../src/features/settings/themes/themeUtils", () => ({ loadMonacoTheme: vi.fn() }));
vi.mock("../../../../src/features/mcp/components/McpSafetySection", () => ({ McpSafetySection: () => <div>safety</div> }));

describe("McpModal", () => {
  it("renders only while open and closes from its header", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<McpModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByText("mcp.title")).not.toBeInTheDocument();

    rerender(<McpModal isOpen onClose={onClose} />);
    await waitFor(() => expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_mcp_status"));
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
