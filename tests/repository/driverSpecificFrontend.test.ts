import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { debtEntries, loadSourceOwners, stringLiterals, type DebtEntry } from "./frontendDebt";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceOwners = loadSourceOwners(root);
const engine = /^(?:postgres|postgresql|mysql|mariadb|sqlite|mssql|duckdb|oracle|mongodb|redis|cassandra|clickhouse|snowflake|bigquery|cockroachdb|sqlserver)$/i;
const protocolAliasSource = "apps/desktop/src/utils/connectionStringParser.ts";
const files = execFileSync("git", ["ls-files", "apps/desktop/src/**/*.ts", "apps/desktop/src/**/*.tsx"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

function isDriverMappingContext(content: string, index: number) {
  const before = content.slice(0, index);
  const declarations = [...before.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{/gi)];
  return /(?:driver|engine|dialect|defaults)/i.test(declarations.at(-1)?.[1] ?? "");
}

function isSemanticEngineIdentifier(identifier: { text: string; index: number }, content: string) {
  if (!engine.test(identifier.text)) return false;
  const before = content.slice(0, identifier.index);
  const after = content.slice(identifier.index + identifier.text.length);
  if (isDriverMappingContext(content, identifier.index) && identifier.text === identifier.text.toLowerCase()) return true;
  const receiver = before.match(/([A-Za-z_$][\w$]*(?:driver|engine|dialect|defaults)[A-Za-z_$\d]*)\s*(?:\?|)\.\s*$/i);
  return Boolean(receiver);
}

function engineIdentifiers(content: string) {
  const identifiers: { text: string; index: number }[] = [];
  for (const match of content.matchAll(/\b(?:postgres|postgresql|mysql|mariadb|sqlite|mssql|duckdb|oracle|mongodb|redis|cassandra|clickhouse|snowflake|bigquery|cockroachdb|sqlserver)\b/gi)) {
    identifiers.push({ text: match[0], index: match.index });
  }
  return identifiers;
}

function isSemanticEngineLiteral(literal: { text: string; index: number; end?: number }, content: string, source = "") {
  if (!engine.test(literal.text)) return false;
  const before = content.slice(0, literal.index);
  const after = content.slice(literal.index + literal.text.length + 2);
  const expressionStart = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}"));
  const expressionEndCandidates = [after.indexOf(";"), after.indexOf("}")].filter((index) => index >= 0);
  const expressionEnd = expressionEndCandidates.length > 0 ? Math.min(...expressionEndCandidates) : after.length;
  const expression = `${before.slice(expressionStart + 1)}${JSON.stringify(literal.text)}${after.slice(0, expressionEnd)}`;
  const containingLine = content.slice(content.lastIndexOf("\n", literal.index) + 1, content.indexOf("\n", literal.index) === -1 ? content.length : content.indexOf("\n", literal.index));
  if (source === protocolAliasSource && /PROTOCOL_ALIAS_GROUPS[\s\S]*?=\s*\[/.test(before)) return true;
  if (/\b(?:BUILTIN_DRIVER_IDS|FALLBACK_DRIVERS|Dialect)\b/.test(containingLine)) return true;
  if (/^\s*\]\s*$/.test(literal.text)) return false;
  const previous = content.slice(0, literal.index).match(/([A-Za-z_$][\w$]*(?:driver|engine|dialect|defaults)[A-Za-z_$\d]*)\s*(?:\?\.)?\s*\[\s*$/i);
  if (previous) return true;
  return /(?:===|!==|==|!=)\s*["'](?:postgres|postgresql|mysql|mariadb|sqlite|mssql|duckdb|oracle|mongodb|redis|cassandra|clickhouse|snowflake|bigquery|cockroachdb|sqlserver)["']/i.test(expression)
    || /\bcase\s*["'](?:postgres|postgresql|mysql|mariadb|sqlite|mssql|duckdb|oracle|mongodb|redis|cassandra|clickhouse|snowflake|bigquery|cockroachdb|sqlserver)["']/i.test(expression)
    || /\b(?:Set|Map)\s*\(\s*\[[\s\S]*["'](?:postgres|postgresql|mysql|mariadb|sqlite|mssql|duckdb|oracle|mongodb|redis|cassandra|clickhouse|snowflake|bigquery|cockroachdb|sqlserver)["']/i.test(expression)
    || /\b(?:driver|engine|dialect|databaseType|activeDriver|capabilities?)\b[\s\S]*(?:includes|has|get|set)\s*\(/i.test(expression);
}

function driverDebtEntries(source: string, content: string) {
  const literalEntries = debtEntries(source, content, sourceOwners, (literal, value) =>
    isSemanticEngineLiteral(literal, value, source),
  );
  const identifierEntries = debtEntries(
    source,
    content,
    sourceOwners,
    isSemanticEngineIdentifier,
    engineIdentifiers(content).filter(({ index }) => !stringLiterals(content).some((literal) => index > literal.index && index < (literal.end ?? literal.index))),
  );
  return [...literalEntries, ...identifierEntries];
}

export const scannedDriverSpecificFrontendDebt = files.flatMap((source) =>
  driverDebtEntries(source, readFileSync(resolve(root, source), "utf8")),
).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

export const driverSpecificFrontendDebt = JSON.parse(readFileSync(resolve(root, "architecture/frontend-driver-debt.json"), "utf8")) as DebtEntry[];





function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("driver-specific frontend debt", () => {
  it("matches the explicit semantic driver fixture", () => {
    expect(driverSpecificFrontendDebt).toEqual(scannedDriverSpecificFrontendDebt);
    expect(driverSpecificFrontendDebt.some(({ normalizedText }) => /^(?:postgres|mysql|sqlite)$/i.test(normalizedText))).toBe(true);
  });

  it("detects comparisons, switch cases, collections, capability branches, and parser aliases", () => {
    const source = "apps/desktop/src/config/links.ts";
    expect(debtEntries(source, "switch (driver) { case 'mysql': break }", sourceOwners, isSemanticEngineLiteral)).toHaveLength(1);
    expect(debtEntries(source, "if (activeDriver\n  ===\n  'postgres') run()", sourceOwners, isSemanticEngineLiteral)).toHaveLength(1);
    expect(debtEntries(source, "if (capabilities.dialect === 'sqlite') run()", sourceOwners, isSemanticEngineLiteral)).toHaveLength(1);
    expect(debtEntries(source, "const supported = new Set(['mysql', 'postgres'])", sourceOwners, isSemanticEngineLiteral)).toHaveLength(2);
    expect(debtEntries(source, "const aliases = new Map([['postgresql', 'postgres']])", sourceOwners, isSemanticEngineLiteral)).toHaveLength(2);
    expect(debtEntries(
      "apps/desktop/src/utils/connectionStringParser.ts",
      "const PROTOCOL_ALIAS_GROUPS = [['postgres', 'postgresql'], ['mysql', 'mariadb'], ['sqlite', 'sqlite3']]",
      sourceOwners,
      (literal, content) => isSemanticEngineLiteral(literal, content, protocolAliasSource),
    )).toHaveLength(5);
  });

  it("detects semantic engine object keys and property access", () => {
    const source = "apps/desktop/src/config/links.ts";
    const content = [
      "const DRIVER_DEFAULTS = {",
      "  mysql: 3306,",
      "  postgres,",
      "};",
      "const first = driverDefaults.mysql;",
      "const second = driverDefaults?.sqlite;",
      "const third = driverDefaults['mariadb'];",
      "const fourth = driverDefaults?.['postgresql'];",
    ].join("\n");
    expect(driverDebtEntries(source, content).map(({ normalizedText }) => normalizedText).sort()).toEqual([
      "mariadb",
      "mysql",
      "mysql",
      "postgres",
      "postgresql",
      "sqlite",
    ]);
  });

  it("detects typed multiline driver mapping keys", () => {
    const source = "apps/desktop/src/config/links.ts";
    const content = [
      "const DIALECT_TABLE:",
      "  Readonly<Record<",
      "    Dialect,",
      "    DialectOptions",
      "  >> = {",
      "    postgres: POSTGRES,",
      "    mysql: MYSQL,",
      "    mssql: MSSQL,",
      "    sqlite: SQLITE,",
      "    oracle: ORACLE,",
      "  };",
    ].join("\n");
    expect(driverDebtEntries(source, content).map(({ normalizedText }) => normalizedText).sort()).toEqual([
      "mssql",
      "mysql",
      "oracle",
      "postgres",
      "sqlite",
    ]);
  });

  it("freezes real DIALECT_TABLE keys", () => {
    for (const dialect of ["postgres", "mysql", "mssql", "sqlite", "oracle"]) {
      expect(driverSpecificFrontendDebt).toContainEqual(expect.objectContaining({
        symbol: expect.stringContaining(`:DIALECT_TABLE:${dialect}:`),
        normalizedText: dialect,
      }));
    }
  });

  it("does not classify unrelated engine labels, object keys, or property access", () => {
    const source = "apps/desktop/src/config/links.ts";
    const content = [
      "const driver = currentDriver;",
      "const label = 'mysql';",
      "const translations = { mysql: 'MySQL' };",
      "const icon = logos.mysql;",
      "render(label, translations, icon);",
    ].join("\n");
    expect(driverDebtEntries(source, content)).toEqual([]);
  });

  it("survives path-only moves", () => {
    const content = "if (driver === 'mysql') run()";
    expect(debtEntries("apps/desktop/src/config/links.ts", content, sourceOwners, isSemanticEngineLiteral)).toEqual(
      debtEntries("apps/desktop/src/app/config/links.ts", content, sourceOwners, isSemanticEngineLiteral),
    );
  });

  it("freezes the semantic driver baseline", () => {
    expect(driverSpecificFrontendDebt).toHaveLength(62);
    expect(hash(driverSpecificFrontendDebt)).toBe("c416ed0bd7c7859ef27b083f99168f14e41b897e0651856dbe190b18c1e30bad");
  });
});
