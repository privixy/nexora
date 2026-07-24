import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpSafetySection } from "../../../../src/features/mcp/components/McpSafetySection";

const updateSetting = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: () => ({ settings: {}, updateSetting }),
}));
vi.mock("../../../../src/features/settings/components/SettingControls", () => ({
  SettingSection: ({ children, title }: { children: React.ReactNode; title: string }) => <section><h2>{title}</h2>{children}</section>,
  SettingRow: ({ children, label }: { children: React.ReactNode; label: string }) => <label>{label}{children}</label>,
  SettingToggle: ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />,
  SettingButtonGroup: ({ onChange }: { onChange: (value: string) => void }) => <button onClick={() => onChange("all")}>approval-mode</button>,
  SettingNumberInput: ({ onChange }: { onChange: (value: number | null) => void }) => <button onClick={() => onChange(null)}>approval-timeout</button>,
}));

describe("McpSafetySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([{ id: "connection-1", name: "Primary" }]);
  });

  it("loads connections and forwards every safety setting including timeout fallback", async () => {
    render(<McpSafetySection />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_connections"));
    fireEvent.click(await screen.findByText("Primary"));
    fireEvent.click(screen.getByText("approval-mode"));
    fireEvent.click(screen.getByText("approval-timeout"));
    const toggles = screen.getAllByRole("checkbox");
    fireEvent.click(toggles[0]);

    expect(updateSetting).toHaveBeenCalledWith("mcpReadonlyConnections", ["connection-1"]);
    expect(updateSetting).toHaveBeenCalledWith("mcpApprovalMode", "all");
    expect(updateSetting).toHaveBeenCalledWith("mcpApprovalTimeoutSeconds", 120);
    expect(updateSetting).toHaveBeenCalledWith("mcpReadonlyDefault", true);
  });

  it("falls back to no connection controls when loading fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("unavailable"));
    render(<McpSafetySection />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_connections"));
    expect(screen.queryByText("Primary")).not.toBeInTheDocument();
  });
});
