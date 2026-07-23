export function formatBasicCellValue(value: unknown, nullLabel: string): string {
  if (value === null || value === undefined) return nullLabel;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
