import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { debtEntries, enclosingSymbol, loadSourceOwners, type DebtEntry } from "./frontendDebt";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceOwners = loadSourceOwners(root);
const sqlStatement = /^\s*(?:WITH\b[\s\S]*?\b)?(?:SELECT(?:\s+(?:\*|COUNT\s*\(|[A-Za-z_$`"[(][\s\S]*?\bFROM\b))|INSERT\s+INTO|UPDATE\b[\s\S]*?\bSET\b|DELETE\s+FROM|CREATE\s+(?:TABLE|INDEX|VIEW|TRIGGER)|ALTER\s+TABLE|DROP\s+(?:TABLE|INDEX|VIEW|TRIGGER)|TRUNCATE\s+TABLE|PRAGMA\b|SHOW\b|DESCRIBE\b|EXPLAIN\b)/i;
const sqlFragment = /^\s*(?:WHERE|FROM|JOIN|VALUES|SET)\b(?:\s|$)/i;
const sqlConstructionSymbols = new Set([
  "buildForeignKeyFilter",
  "buildStructuredFilterClause",
  "formatFilterValue",
  "generateFromClause",
  "generateGroupByClause",
  "generateHavingClause",
  "generateLimitClause",
  "generateOrderByClause",
  "generateVisualQuerySQL",
  "generateWhereClause",
  "resultToCte",
  "resolveQueryVariables",
]);
const excludedSqlSymbols = new Set([
  "PasswordInput",
  "RESULT_SET_KEYWORDS",
  "SQL_KEYWORDS",
  "queries",
  "totalRows",
  "newEdge",
  "selected",
  "queryWithPlan",
  "AiTab",
  "handleResetPrompt",
  "handleSavePrompt",
  "isModelValid",
  "PG_RESERVED",
]);
const classifySql = (literal: { text: string; index: number }, content: string) => {
  const symbol = enclosingSymbol(content, literal.index);
  if (excludedSqlSymbols.has(symbol)) return false;
  const constructionText = /(?:SELECT|WITH|UNION|WHERE|FROM|JOIN|GROUP BY|HAVING|ORDER BY|LIMIT|IS NULL|BETWEEN| AS | = |'')/i.test(literal.text);
  return sqlStatement.test(literal.text) || sqlFragment.test(literal.text) || (sqlConstructionSymbols.has(symbol) && constructionText);
};
const files = execFileSync("git", ["ls-files", "apps/desktop/src/**/*.ts", "apps/desktop/src/**/*.tsx"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

export const scannedFrontendSqlDebt = files.flatMap((source) =>
  debtEntries(source, readFileSync(resolve(root, source), "utf8"), sourceOwners, classifySql),
).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

export const frontendSqlDebt = JSON.parse(readFileSync(resolve(root, "architecture/frontend-sql-debt.json"), "utf8")) as DebtEntry[];






function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("frontend SQL debt", () => {
  it("handles lexical SQL edge cases without UI or CSS false positives", () => {
    const classify = classifySql;
    const fixture = [
      "const truncateClass = 'truncate';",
      "const selectNone = 'select-none';",
      "const title = 'SELECT a window title';",
      "const nested = `SELECT * FROM ${table ? `${schema}.${table}` : table} WHERE id = ${id}`;",
      "const where = ' WHERE ' + predicate;",
      String.raw`const escapedDelete = "DELETE\nFROM\tusers\rWHERE id = 1";`,
      String.raw`const escapedSelect = 'SELECT\t*\r\nFROM users';`,
      String.raw`const escapedSyntax = ` + "`SELECT \\`name\\`, '\\\\path', \\\"label\\\" FROM users`" + ";",
      String.raw`const hexSql = '\x53ELECT\x20*\x20FROM users';`,
      String.raw`const unicodeSql = '\u0053ELECT\u0020*\u{20}FROM users';`,
      String.raw`const ordinaryEscapes = '\x41\u0042\u{43}';`,
    ].join("\n");
    const entries = debtEntries("apps/desktop/src/config/links.ts", fixture, sourceOwners, classify);
    expect(entries.map(({ normalizedText }) => normalizedText)).toEqual([
      "SELECT * FROM ${table ? `${schema}.${table}` : table} WHERE id = ${id}",
      "WHERE",
      "DELETE FROM users WHERE id = 1",
      "SELECT * FROM users",
      'SELECT `name`, \'\\path\', "label" FROM users',
      "SELECT * FROM users",
      "SELECT * FROM users",
    ]);
  });

  it("matches the explicit classified SQL fixture", () => {
    expect(frontendSqlDebt).toEqual(scannedFrontendSqlDebt);
    expect(frontendSqlDebt.some(({ normalizedText }) => /\bWHERE\b/i.test(normalizedText))).toBe(true);
    expect(frontendSqlDebt.every(({ normalizedText }) => !/^(?:truncate|select-none|SELECT a window title)$/i.test(normalizedText))).toBe(true);
  });

  it("uses path-independent symbol identities", () => {
    expect(frontendSqlDebt.every(({ symbol }) => !symbol.includes("apps/desktop/src"))).toBe(true);
    expect(new Set(frontendSqlDebt.map(({ symbol }) => symbol)).size).toBe(frontendSqlDebt.length);
    expect(new Set(frontendSqlDebt.map((entry) => JSON.stringify(entry))).size).toBe(frontendSqlDebt.length);
    expect(debtEntries(
      "apps/desktop/src/config/links.ts",
      "export const query = `SELECT * FROM t WHERE id = 1`;",
      sourceOwners,
      classifySql,
    )).toEqual(debtEntries(
      "apps/desktop/src/app/config/links.ts",
      "export const query = `SELECT * FROM t WHERE id = 1`;",
      sourceOwners,
      classifySql,
    ));
  });

  it("freezes the classified SQL baseline", () => {
    expect(frontendSqlDebt).toHaveLength(38);
    expect(hash(frontendSqlDebt)).toBe("204df9752a1c1393f0049566c567bc26287c8c7aca9827b575a4e7cc22f4e7c0");
  });
});
