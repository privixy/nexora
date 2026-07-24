import { describe, expect, it } from "vitest";
import type { DriverCapabilities } from "../../../../src/features/plugins";
import { resolveExplicitTableContext } from "../../../../src/features/connections/lib/tableContext";

const capabilities = (
  overrides: Partial<DriverCapabilities>,
): DriverCapabilities => overrides as DriverCapabilities;

const baseContext = {
  connectionId: "conn-1",
  table: "assets",
};

describe("resolveExplicitTableContext", () => {
  it("accepts schema-only layout with an explicitly absent database", () => {
    expect(
      resolveExplicitTableContext({
        ...baseContext,
        capabilities: capabilities({ schemas: true, multiple_databases: false }),
        database: undefined,
        schema: "reporting",
      }),
    ).toEqual({
      connectionId: "conn-1",
      database: undefined,
      schema: "reporting",
      table: "assets",
    });
  });

  it("accepts database-only layout with an explicitly absent schema", () => {
    expect(
      resolveExplicitTableContext({
        ...baseContext,
        capabilities: capabilities({ schemas: false, multiple_databases: true }),
        database: "analytics",
        schema: undefined,
      }),
    ).toEqual({
      connectionId: "conn-1",
      database: "analytics",
      schema: undefined,
      table: "assets",
    });
  });

  it("accepts a full database and schema tuple", () => {
    expect(
      resolveExplicitTableContext({
        ...baseContext,
        capabilities: capabilities({ schemas: true, multiple_databases: true }),
        database: "analytics",
        schema: "reporting",
      }),
    ).toEqual({
      connectionId: "conn-1",
      database: "analytics",
      schema: "reporting",
      table: "assets",
    });
  });

  it("accepts local layouts with both dimensions explicitly absent", () => {
    expect(
      resolveExplicitTableContext({
        ...baseContext,
        capabilities: capabilities({
          schemas: false,
          multiple_databases: false,
          file_based: true,
        }),
        database: undefined,
        schema: undefined,
      }),
    ).toEqual({
      connectionId: "conn-1",
      database: undefined,
      schema: undefined,
      table: "assets",
    });
  });

  it.each([
    {
      capabilities: capabilities({ schemas: true, multiple_databases: false }),
      database: undefined,
      schema: undefined,
    },
    {
      capabilities: capabilities({ schemas: false, multiple_databases: true }),
      database: undefined,
      schema: undefined,
    },
    {
      capabilities: capabilities({ schemas: true, multiple_databases: true }),
      database: "analytics",
      schema: undefined,
    },
    {
      capabilities: capabilities({ schemas: true, multiple_databases: true }),
      database: undefined,
      schema: "reporting",
    },
  ])("rejects a context missing a layout-required dimension", (context) => {
    expect(
      resolveExplicitTableContext({ ...baseContext, ...context }),
    ).toBeNull();
  });
});
