import { invoke } from "@tauri-apps/api/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpPage } from "../../src/pages/McpPage";

vi.mock("../../src/hooks/useAlert", () => ({
  useAlert: () => ({ showAlert: vi.fn() }),
}));

vi.mock("../../src/features/settings/hooks/useEditorTheme", () => ({
  useEditorTheme: () => "vs-dark",
}));

vi.mock("../../src/themes/themeUtils", () => ({
  loadMonacoTheme: vi.fn(),
}));

vi.mock("../../src/features/settings/components/AiActivityPanel", () => ({
  AiActivityPanel: () => null,
}));

vi.mock("../../src/components/modals/mcp/McpSafetySection", () => ({
  McpSafetySection: () => null,
}));

describe("McpPage", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it("keeps the page wrapper fixed and scrolls only the tab content", () => {
    render(<McpPage />);

    const root = screen.getByText("mcp.title").closest(".h-full");
    const content = root?.querySelector(".custom-scrollbar");

    expect(root).toHaveClass("overflow-hidden");
    expect(content).toHaveClass("min-h-0");
    expect(content).toHaveClass("overflow-y-auto");
  });

  it("shows Other MCP client last even when status returns it first", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      {
        client_id: "other",
        client_name: "Other",
        installed: false,
        config_path: null,
        executable_path: "/Applications/Nexora.app/nexora",
        client_type: "manual",
        manual_command: null,
      },
      {
        client_id: "opencode",
        client_name: "OpenCode",
        installed: false,
        config_path: "/Users/test/.config/opencode/opencode.json",
        executable_path: "/Applications/Nexora.app/nexora",
        client_type: "opencode",
        manual_command: null,
      },
    ]);

    render(<McpPage />);

    await waitFor(() => expect(screen.getByText("OpenCode")).toBeInTheDocument());

    const clientList = screen.getByText("mcp.clients").nextElementSibling;
    const clientCards = Array.from(clientList?.children ?? []);

    expect(within(clientCards[0] as HTMLElement).getByText("OpenCode")).toBeInTheDocument();
    expect(within(clientCards[1] as HTMLElement).getByText("Other")).toBeInTheDocument();
  });
});
