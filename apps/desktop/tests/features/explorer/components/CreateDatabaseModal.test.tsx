import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateDatabaseModal } from "../../../../src/features/explorer/components/CreateDatabaseModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../../src/shared/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

describe("CreateDatabaseModal", () => {
  it("trims the explicit database name before creating and closes after completion", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<CreateDatabaseModal isOpen onClose={onClose} onCreate={onCreate} />);

    fireEvent.change(screen.getByPlaceholderText("sidebar.createDatabasePrompt"), {
      target: { value: "  analytics  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "sidebar.createDatabase" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("analytics"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
