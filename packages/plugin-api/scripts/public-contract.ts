import ts from "typescript";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface PublicSymbol {
  kind: "type" | "value";
  declaration: string;
}

export interface PublicContract {
  symbols: Record<string, PublicSymbol>;
  version?: string;
}

export interface ContractDrift {
  key: string;
  expected: PublicSymbol | null;
  actual: PublicSymbol | null;
}

export interface ContractBaselineEntry extends ContractDrift {
  reason: string;
  owner: string;
  removeWhen: string;
}

export interface ContractBaseline {
  differences: ContractBaselineEntry[];
  allowlist: Array<{ key: string; reason: string; owner: string; removeWhen: string }>;
}

export interface SyncComparison {
  newDrift: ContractDrift[];
  changedDrift: ContractDrift[];
  resolvedDrift: ContractDrift[];
  staleAllowlistEntries: string[];
  versionMismatches: string[];
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s*([{}():;,|<>])\s*/g, "$1").trim();
}

function declarationKind(symbol: ts.Symbol): "type" | "value" {
  return symbol.flags & ts.SymbolFlags.Value ? "value" : "type";
}

export function extractPublicContract(entryPath: string, versionOwnerPath?: string): PublicContract {
  const absoluteEntry = resolve(entryPath);
  const configPath = ts.findConfigFile(dirname(absoluteEntry), ts.sys.fileExists, "tsconfig.json");
  const config = configPath
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, dirname(configPath))
    : { options: { target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler }, fileNames: [absoluteEntry] };
  const program = ts.createProgram([...new Set([...config.fileNames, absoluteEntry])], config.options);
  const checker = program.getTypeChecker();
  const module = program.getSourceFile(absoluteEntry);
  if (!module) throw new Error(`Unable to load contract entry: ${absoluteEntry}`);
  const symbols: Record<string, PublicSymbol> = {};
  for (const exported of checker.getExportsOfModule(checker.getSymbolAtLocation(module) as ts.Symbol).sort((a, b) => a.name.localeCompare(b.name))) {
    const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration) continue;
    const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
    const rendered = signatures.length > 0
      ? signatures.map((signature) => checker.signatureToString(signature, declaration, ts.TypeFormatFlags.NoTruncation)).join(" | ")
      : checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias);
    symbols[exported.name] = { kind: declarationKind(symbol), declaration: normalize(rendered) };
  }
  let version: string | undefined;
  if (versionOwnerPath) {
    const text = readFileSync(versionOwnerPath, "utf8");
    version = /(?:API_VERSION|HOST_API_VERSION)\s*=\s*["']([^"']+)["']/.exec(text)?.[1];
  }
  return { symbols, version };
}

function observedDifferences(host: PublicContract, pkg: PublicContract): ContractDrift[] {
  return [...new Set([...Object.keys(host.symbols), ...Object.keys(pkg.symbols)])].sort().flatMap((key) => {
    const expected = host.symbols[key] ?? null;
    const actual = pkg.symbols[key] ?? null;
    return JSON.stringify(expected) === JSON.stringify(actual) ? [] : [{ key, expected, actual }];
  });
}

export function comparePublicContracts(host: PublicContract, pkg: PublicContract, baseline: ContractBaseline): SyncComparison {
  const observed = observedDifferences(host, pkg);
  const observedByKey = new Map(observed.map((entry) => [entry.key, entry]));
  const baselineByKey = new Map(baseline.differences.map((entry) => [entry.key, entry]));
  const newDrift = observed.filter((entry) => !baselineByKey.has(entry.key));
  const changedDrift = observed.filter((entry) => {
    const expected = baselineByKey.get(entry.key);
    return expected !== undefined && (JSON.stringify(expected.expected) !== JSON.stringify(entry.expected) || JSON.stringify(expected.actual) !== JSON.stringify(entry.actual));
  });
  const resolvedDrift = baseline.differences.filter((entry) => !observedByKey.has(entry.key));
  const staleAllowlistEntries = baseline.allowlist.filter((entry) => !observedByKey.has(entry.key)).map((entry) => entry.key);
  const versionMismatches = host.version && pkg.version && host.version !== pkg.version
    ? [`hostApiVersion=${host.version} does not match pluginApiVersion=${pkg.version}`]
    : [];
  return { newDrift, changedDrift, resolvedDrift, staleAllowlistEntries, versionMismatches };
}

export function formatSyncFailure(result: SyncComparison): string {
  const lines: string[] = [];
  for (const category of ["newDrift", "changedDrift", "resolvedDrift"] as const) {
    for (const drift of result[category]) lines.push(`${category}: ${drift.key} expected=${JSON.stringify(drift.expected)} actual=${JSON.stringify(drift.actual)}`);
  }
  for (const key of result.staleAllowlistEntries) lines.push(`staleAllowlistEntries: ${key}`);
  for (const mismatch of result.versionMismatches) lines.push(`versionMismatches: ${mismatch}`);
  return lines.join("\n");
}
