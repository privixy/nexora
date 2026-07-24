import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiApprovalGate } from "../../../../src/features/settings/components/AiApprovalGate";
import { usePendingApprovals } from "../../../../src/features/settings/hooks/useAiActivity";
import { useSettings } from "../../../../src/features/settings/hooks/useSettings";
import {
  focusWindowForApproval,
  notifyApprovalRequest,
  restoreWindowAlwaysOnTop,
} from "../../../../src/features/mcp/lib/mcpApprovalAttention";

vi.mock("../../../../src/features/settings/hooks/useSettings", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../../../../src/features/settings/hooks/useAiActivity", () => ({
  usePendingApprovals: vi.fn(),
}));

vi.mock("../../../../src/features/mcp/lib/mcpApprovalAttention", () => ({
  focusWindowForApproval: vi.fn().mockResolvedValue(undefined),
  notifyApprovalRequest: vi.fn().mockResolvedValue(undefined),
  restoreWindowAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../src/features/settings/components/AiApprovalModal", () => ({
  AiApprovalModal: ({ approval }: { approval: { id: string } }) => (
    <div data-testid="approval-modal">{approval.id}</div>
  ),
}));

const attentionAdapter = {
  focusWindowForApproval,
  notifyApprovalRequest,
  restoreWindowAlwaysOnTop,
};

describe("AiApprovalGate", () => {
  const decide = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePendingApprovals).mockReturnValue({
      pending: [
        {
          id: "approval-1",
          query: "SELECT 1",
        },
      ] as never[],
      loading: false,
      error: null,
      refetch: vi.fn(),
      decide,
    });
  });

  it("renders approval UI and sends notifications even before language settles", async () => {
    vi.mocked(useSettings)
      .mockReturnValue({
        settings: {
          mcpApprovalAlwaysOnTop: true,
          mcpApprovalNotifySound: true,
        },
        isLoading: false,
        isLanguageReady: false,
        isLanguageSettled: false,
        updateSetting: vi.fn(),
      } as never);

    render(
      <AiApprovalGate
        attentionAdapter={attentionAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("approval-modal")).toBeInTheDocument();
    });

    expect(focusWindowForApproval).toHaveBeenCalledWith("approval-1");
    expect(notifyApprovalRequest).toHaveBeenCalledWith({
      title: "aiApproval.notificationTitle",
      body: "aiApproval.notificationBody",
    });
    expect(restoreWindowAlwaysOnTop).not.toHaveBeenCalled();
  });

  it("restores temporary attention state when the active approval disappears before language settles", async () => {
    vi.mocked(useSettings)
      .mockReturnValueOnce({
        settings: {
          mcpApprovalAlwaysOnTop: true,
          mcpApprovalNotifySound: true,
        },
        isLoading: false,
        isLanguageReady: true,
        isLanguageSettled: true,
        updateSetting: vi.fn(),
      } as never)
      .mockReturnValueOnce({
        settings: {
          mcpApprovalAlwaysOnTop: true,
          mcpApprovalNotifySound: true,
        },
        isLoading: false,
        isLanguageReady: false,
        isLanguageSettled: false,
        updateSetting: vi.fn(),
      } as never);

    const gate = (
      <AiApprovalGate
        attentionAdapter={attentionAdapter}
        renderExplainPlan={() => null}
      />
    );
    const { rerender } = render(gate);

    await waitFor(() => {
      expect(focusWindowForApproval).toHaveBeenCalledWith("approval-1");
    });

    vi.mocked(usePendingApprovals).mockReturnValue({
      pending: [] as never[],
      loading: false,
      error: null,
      refetch: vi.fn(),
      decide,
    });

    rerender(
      <AiApprovalGate
        attentionAdapter={attentionAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(restoreWindowAlwaysOnTop).toHaveBeenCalledWith("approval-1");
    });
  });

  it("does not repeat attention when the adapter identity changes for the same approval", async () => {
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        mcpApprovalAlwaysOnTop: true,
        mcpApprovalNotifySound: true,
      },
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
      updateSetting: vi.fn(),
    } as never);

    const firstAdapter = {
      focusWindowForApproval: vi.fn().mockResolvedValue(undefined),
      notifyApprovalRequest: vi.fn().mockResolvedValue(undefined),
      restoreWindowAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    };
    const secondAdapter = {
      focusWindowForApproval: vi.fn().mockResolvedValue(undefined),
      notifyApprovalRequest: vi.fn().mockResolvedValue(undefined),
      restoreWindowAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(
      <AiApprovalGate
        attentionAdapter={firstAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(firstAdapter.focusWindowForApproval).toHaveBeenCalledWith("approval-1");
      expect(firstAdapter.notifyApprovalRequest).toHaveBeenCalledOnce();
    });

    rerender(
      <AiApprovalGate
        attentionAdapter={secondAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("approval-modal")).toBeInTheDocument();
    });
    expect(firstAdapter.restoreWindowAlwaysOnTop).not.toHaveBeenCalled();
    expect(secondAdapter.focusWindowForApproval).not.toHaveBeenCalled();
    expect(secondAdapter.notifyApprovalRequest).not.toHaveBeenCalled();

    vi.mocked(usePendingApprovals).mockReturnValue({
      pending: [] as never[],
      loading: false,
      error: null,
      refetch: vi.fn(),
      decide,
    });
    rerender(
      <AiApprovalGate
        attentionAdapter={secondAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(secondAdapter.restoreWindowAlwaysOnTop).toHaveBeenCalledWith("approval-1");
    });
    expect(firstAdapter.restoreWindowAlwaysOnTop).not.toHaveBeenCalled();
  });

  it("does not steal focus when always-on-top attention is disabled", async () => {
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        mcpApprovalAlwaysOnTop: false,
        mcpApprovalNotifySound: true,
      },
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
      updateSetting: vi.fn(),
    } as never);

    render(
      <AiApprovalGate
        attentionAdapter={attentionAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("approval-modal")).toBeInTheDocument();
    });

    expect(focusWindowForApproval).not.toHaveBeenCalled();
    expect(notifyApprovalRequest).toHaveBeenCalledWith({
      title: "aiApproval.notificationTitle",
      body: "aiApproval.notificationBody",
    });
  });

  it("does not send notifications when notification attention is disabled", async () => {
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        mcpApprovalAlwaysOnTop: true,
        mcpApprovalNotifySound: false,
      },
      isLoading: false,
      isLanguageReady: true,
      isLanguageSettled: true,
      updateSetting: vi.fn(),
    } as never);

    render(
      <AiApprovalGate
        attentionAdapter={attentionAdapter}
        renderExplainPlan={() => null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("approval-modal")).toBeInTheDocument();
    });

    expect(focusWindowForApproval).toHaveBeenCalledWith("approval-1");
    expect(notifyApprovalRequest).not.toHaveBeenCalled();
  });
});
