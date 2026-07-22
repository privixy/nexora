import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExplorerTabs } from "../../../../src/features/explorer/components/ExplorerTabs";

vi.mock("lucide-react", () => ({
  BookOpen: () => null,
  Clock: () => null,
  Layers: () => null,
  Star: () => null,
}));

describe("ExplorerTabs", () => {
  it("preserves tab selection and visible counts", () => {
    const onChange = vi.fn();

    render(
      <ExplorerTabs
        activeTab="structure"
        counts={{ favorites: 2, history: 3, notebooks: 4 }}
        labels={{
          structure: "Structure",
          favorites: "Favorites",
          history: "History",
          notebooks: "Notebooks",
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Favorites")).toHaveTextContent("2");
    fireEvent.click(screen.getByLabelText("History"));
    expect(onChange).toHaveBeenCalledWith("history");
  });
});
