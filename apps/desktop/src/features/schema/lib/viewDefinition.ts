function isIdentifierChar(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}

function skipQuotedSegment(sql: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function skipBracketIdentifier(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === "]") {
      if (sql[index + 1] === "]") {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function readTopLevelWord(sql: string, start: number) {
  if (!/[A-Za-z_]/.test(sql[start])) return null;
  let end = start + 1;
  while (end < sql.length && isIdentifierChar(sql[end])) end += 1;
  return { word: sql.slice(start, end), end };
}

export function extractEditableViewDefinition(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) return trimmed;
  let depth = 0;
  let sawCreate = false;
  let sawView = false;
  let firstWord: string | null = null;
  for (let index = 0; index < trimmed.length;) {
    const char = trimmed[index];
    const nextChar = trimmed[index + 1];
    if (char === "'" || char === '"' || char === "`") {
      index = skipQuotedSegment(trimmed, index, char);
      continue;
    }
    if (char === "[") {
      index = skipBracketIdentifier(trimmed, index);
      continue;
    }
    if (char === "-" && nextChar === "-") {
      index = trimmed.indexOf("\n", index + 2);
      if (index === -1) return trimmed;
      continue;
    }
    if (char === "#") {
      index = trimmed.indexOf("\n", index + 1);
      if (index === -1) return trimmed;
      continue;
    }
    if (char === "/" && nextChar === "*") {
      const end = trimmed.indexOf("*/", index + 2);
      index = end === -1 ? trimmed.length : end + 2;
      continue;
    }
    if (char === "(") {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    const word = readTopLevelWord(trimmed, index);
    if (!word) {
      index += 1;
      continue;
    }
    const upperWord = word.word.toUpperCase();
    if (firstWord === null) {
      firstWord = upperWord;
      if (upperWord !== "CREATE") return trimmed;
      sawCreate = true;
    }
    if (depth === 0 && sawCreate) {
      if (upperWord === "VIEW") sawView = true;
      else if (upperWord === "AS" && sawView) return trimmed.slice(word.end).trim();
    }
    index = word.end;
  }
  return trimmed;
}
