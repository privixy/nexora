import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

export interface SourceOwner {
  source: string;
  owner: string;
  destination: string;
  moveTask: number;
}

export interface DebtEntry {
  symbol: string;
  owner: string;
  normalizedText: string;
}

export function loadSourceOwners(root: string): SourceOwner[] {
  return JSON.parse(readFileSync(resolve(root, "architecture/frontend-source-owners.json"), "utf8")) as SourceOwner[];
}

export function resolveOwner(rows: SourceOwner[], source: string) {
  const row = rows.find(({ source: legacy, destination }) => legacy === source || destination === source);
  if (row) return row;
  const fileName = basename(source);
  const candidates = rows.filter(({ source: current }) => basename(current) === fileName);
  if (candidates.length === 1) return candidates[0];
  throw new Error(`missing source owner: ${source}`);
}

function decodeStringEscapes(text: string) {
  return text.replace(/\\(?:x[\dA-Fa-f]{2}|u\{[\dA-Fa-f]+\}|u[\dA-Fa-f]{4}|\r\n|\r|\n|n|r|t|`|'|"|\\)/g, (escape) => {
    if (escape === "\\n") return "\n";
    if (escape === "\\r") return "\r";
    if (escape === "\\t") return "\t";
    if (escape === "\\\r\n" || escape === "\\\r" || escape === "\\\n") return "";
    if (escape.startsWith("\\x")) return String.fromCodePoint(Number.parseInt(escape.slice(2), 16));
    if (escape.startsWith("\\u{")) return String.fromCodePoint(Number.parseInt(escape.slice(3, -1), 16));
    if (escape.startsWith("\\u")) return String.fromCodePoint(Number.parseInt(escape.slice(2), 16));
    return escape.slice(1);
  });
}

export function normalizeText(text: string) {
  return decodeStringEscapes(text).replace(/\s+/g, " ").trim();
}

interface Literal {
  text: string;
  index: number;
  end?: number;
}

function skipComment(content: string, index: number) {
  if (content[index + 1] === "/") {
    const end = content.indexOf("\n", index + 2);
    return end === -1 ? content.length : end;
  }
  if (content[index + 1] === "*") {
    const end = content.indexOf("*/", index + 2);
    return end === -1 ? content.length : end + 2;
  }
  return index;
}

function isRegexStart(content: string, index: number) {
  const prefix = content.slice(0, index);
  const match = prefix.match(/(?:\b(?:return|case|throw)|=>|[=(:,![{;?&|])\s*$/);
  return Boolean(match?.[0].trim());
}

function regexEnd(content: string, start: number) {
  let index = start + 1;
  let inCharacterClass = false;
  while (index < content.length) {
    if (content[index] === "\\" && index + 1 < content.length) {
      index += 2;
      continue;
    }
    if (content[index] === "[") inCharacterClass = true;
    if (content[index] === "]") inCharacterClass = false;
    if (content[index] === "/" && !inCharacterClass) {
      index += 1;
      while (/[A-Za-z]/.test(content[index] ?? "")) index += 1;
      return index;
    }
    index += 1;
  }
  return content.length;
}

function quotedEnd(content: string, start: number) {
  const quote = content[start];
  let index = start + 1;
  let interpolationDepth = 0;
  while (index < content.length) {
    if (content[index] === "\\" && index + 1 < content.length) {
      index += 2;
      continue;
    }
    if (quote === "`" && content[index] === "$" && content[index + 1] === "{") {
      interpolationDepth += 1;
      index += 2;
      continue;
    }
    if (quote === "`" && interpolationDepth > 0) {
      if (content[index] === "{") {
        interpolationDepth += 1;
        index += 1;
        continue;
      }
      if (content[index] === "}") {
        interpolationDepth -= 1;
        index += 1;
        continue;
      }
      if (content[index] === "/" && (content[index + 1] === "/" || content[index + 1] === "*")) {
        index = skipComment(content, index);
        continue;
      }
      if (content[index] === "/" && isRegexStart(content, index)) {
        index = regexEnd(content, index);
        continue;
      }
      if (content[index] === "\"" || content[index] === "'" || content[index] === "`") {
        index = quotedEnd(content, index);
        continue;
      }
    }
    if (content[index] === quote && interpolationDepth === 0) return index + 1;
    index += 1;
  }
  return content.length;
}

export function stringLiterals(content: string): Literal[] {
  const literals: Literal[] = [];
  let index = 0;
  while (index < content.length) {
    if (content[index] === "/" && (content[index + 1] === "/" || content[index + 1] === "*")) {
      index = skipComment(content, index);
      continue;
    }
    if (content[index] === "/" && isRegexStart(content, index)) {
      index = regexEnd(content, index);
      continue;
    }
    const quote = content[index];
    if (quote !== "\"" && quote !== "'" && quote !== "`") {
      index += 1;
      continue;
    }
    const start = index;
    const end = quotedEnd(content, start);
    literals.push({ text: normalizeText(content.slice(start + 1, end - 1)), index: start, end });
    index = end;
  }
  return literals;
}

export function enclosingSymbol(content: string, index: number) {
  const prefix = content.slice(0, index);
  const declarations = [...prefix.matchAll(/\b(?:function|class|interface|type|const|let|var)\s+([A-Za-z_$][\w$]*)/g)];
  return declarations.at(-1)?.[1] ?? "module";
}

function sourceIdentity(row: SourceOwner) {
  return basename(row.destination).replace(/(?:\.d)?\.tsx?$/, "");
}

export function debtEntries(
  source: string,
  content: string,
  rows: SourceOwner[],
  classify: (literal: Literal, content: string) => boolean,
  candidates = stringLiterals(content),
): DebtEntry[] {
  const row = resolveOwner(rows, source);
  const identity = sourceIdentity(row);
  const occurrences = new Map<string, number>();
  return candidates.flatMap((literal) => {
    if (!classify(literal, content)) return [];
    const symbolName = enclosingSymbol(content, literal.index);
    const key = `${symbolName}\0${literal.text}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return [{
      symbol: `${row.owner}:${identity}:${symbolName}:${literal.text}:${occurrence}`,
      owner: row.owner,
      normalizedText: literal.text,
    }];
  });
}
