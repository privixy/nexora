import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TaskManagerPage } from "../../../../src/features/tasks/pages/TaskManagerPage";
import { useTaskManager } from "../../../../src/features/tasks/hooks/useTaskManager";

vi.mock("../../../../src/features/tasks/hooks/useTaskManager", () => ({
  useTaskManager: vi.fn(),
}));

describe("TaskManagerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTaskManager).mockReturnValue({
      processes: [],
      systemStats: null,
      loading: false,
      error: null,
      killing: null,
      restarting: null,
      refresh: vi.fn(),
      killProcess: vi.fn(),
      restartProcess: vi.fn(),
    });
  });

  it("keeps the page wrapper fixed and scrolls only the task content", () => {
    render(<TaskManagerPage />);

    const root = screen.getByText("taskManager.header.title").closest(".h-full");
    const content = root?.querySelector(".custom-scrollbar");

    expect(root).toHaveClass("overflow-hidden");
    expect(content).toHaveClass("min-h-0");
    expect(content).toHaveClass("overflow-y-auto");
  });
});
