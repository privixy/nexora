import { describe, expect, it } from "vitest";
import type { ComponentProps } from "react";
import {
  AiActivityPanel,
  DEFAULT_SETTINGS,
} from "../../../src/features/settings";

describe("settings public API", () => {
  it("publishes default settings for cross-feature consumers", () => {
    expect(DEFAULT_SETTINGS.erDiagramDefaultLayout).toBeDefined();
  });

  it("accepts visual explain composition without owning the feature", () => {
    type Props = ComponentProps<typeof AiActivityPanel>;
    const props: Props = {
      renderVisualExplain: () => null,
    };

    expect(props.renderVisualExplain).toBeDefined();
  });
});
