import Ajv, { type ErrorObject } from "ajv";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadManifestFixture, type ManifestFixtureName } from "./manifest-fixtures";

interface SchemaDiagnostic { keyword: string; instancePath: string; property?: string }

function normalizeAjvErrors(errors: ErrorObject[] | null | undefined): SchemaDiagnostic[] {
  return (errors ?? []).map((error) => ({
    keyword: error.keyword,
    instancePath: error.instancePath,
    property: "additionalProperty" in error.params
      ? String(error.params.additionalProperty)
      : "missingProperty" in error.params
        ? String(error.params.missingProperty)
        : undefined,
  })).sort((a, b) => `${a.instancePath}:${a.property ?? ""}:${a.keyword}`.localeCompare(`${b.instancePath}:${b.property ?? ""}:${b.keyword}`));
}

const schema = JSON.parse(readFileSync(resolve(process.cwd(), "plugins/manifest.schema.json"), "utf8"));
const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
const fullDriverUnsupportedRootProperties = ["color", "icon", "ui_extensions"];
const fullDriverUnsupportedCapabilities = ["create_database", "create_schema", "drop_database", "materialized_views", "multiple_databases", "rename_database", "truncate_table", "unknown_capability"];
const aliasesRustOnly = ["createDatabase", "createSchema", "dropDatabase", "renameDatabase", "routineManagement", "supportsSsl", "truncateTable"];

function diagnostics(name: ManifestFixtureName): SchemaDiagnostic[] {
  validate(loadManifestFixture(name));
  return normalizeAjvErrors(validate.errors);
}

describe("plugin manifest schema fixture contract", () => {
  it("records each fixture without claiming global validity", () => {
    expect(diagnostics("minimal-driver")).toEqual([{ keyword: "additionalProperties", instancePath: "", property: "$schema" }]);
    expect(diagnostics("full-driver")).toEqual([
      ...fullDriverUnsupportedRootProperties.map((property) => ({ keyword: "additionalProperties", instancePath: "", property })),
      ...fullDriverUnsupportedCapabilities.map((property) => ({ keyword: "additionalProperties", instancePath: "/capabilities", property })),
    ].sort((a, b) => `${a.instancePath}:${a.property}:${a.keyword}`.localeCompare(`${b.instancePath}:${b.property}:${b.keyword}`)));
    expect(diagnostics("ui-only")).toEqual([
      { keyword: "additionalProperties", instancePath: "", property: "ui_extensions" },
      { keyword: "required", instancePath: "", property: "data_types" },
      { keyword: "required", instancePath: "", property: "executable" },
      { keyword: "required", instancePath: "/capabilities", property: "alter_primary_key" },
      { keyword: "required", instancePath: "/capabilities", property: "file_based" },
      { keyword: "required", instancePath: "/capabilities", property: "identifier_quote" },
      { keyword: "required", instancePath: "/capabilities", property: "routines" },
      { keyword: "required", instancePath: "/capabilities", property: "schemas" },
      { keyword: "required", instancePath: "/capabilities", property: "views" },
    ].sort((a, b) => `${a.instancePath}:${a.property}:${a.keyword}`.localeCompare(`${b.instancePath}:${b.property}:${b.keyword}`)));
    expect(diagnostics("unknown-capability")).toEqual([{ keyword: "additionalProperties", instancePath: "/capabilities", property: "unknown_capability" }]);
    expect(diagnostics("unknown-slot")).toEqual(expect.arrayContaining([{ keyword: "additionalProperties", instancePath: "", property: "ui_extensions" }]));
  });

  it("accepts schema aliases and reports every Rust-only alias", () => {
    const errors = diagnostics("aliases");
    expect(errors).not.toContainEqual(expect.objectContaining({ property: "connectionString" }));
    expect(errors).not.toContainEqual(expect.objectContaining({ property: "connectionStringExample" }));
    for (const property of aliasesRustOnly) expect(errors).toContainEqual({ keyword: "additionalProperties", instancePath: "/capabilities", property });
  });
});
