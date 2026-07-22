import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../../src/features/settings";

describe("settings public API", () => {
  it("publishes default settings for cross-feature consumers", () => {
    expect(DEFAULT_SETTINGS.erDiagramDefaultLayout).toBeDefined();
  });
});
