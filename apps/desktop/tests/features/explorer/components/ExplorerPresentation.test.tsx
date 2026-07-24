import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExplorerStructure } from "../../../../src/features/explorer/components/ExplorerStructure";
import { ExplorerModals } from "../../../../src/features/explorer/components/ExplorerModals";

describe("Explorer presentation boundaries", () => {
  it("renders structure content and coordinated modal content", () => {
    render(
      <>
        <ExplorerStructure>
          <div>structure content</div>
        </ExplorerStructure>
        <ExplorerModals>
          <div>modal content</div>
        </ExplorerModals>
      </>,
    );

    expect(screen.getByText("structure content")).toBeVisible();
    expect(screen.getByText("modal content")).toBeVisible();
  });
});
