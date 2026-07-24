import { useCallback } from "react";
import {
  copyTextToClipboard,
  getSelectedRows,
  rowsToCSV,
  rowsToCSVWithHeaders,
  rowsToJSON,
  rowsToSqlInsert,
} from "../../../shared/lib/clipboard";

interface UseGridClipboardOptions {
  columns: string[];
  data: unknown[][];
  selectedRowIndices: Set<number>;
  copyFormat?: "csv" | "json" | "sql-insert";
  tableName?: string | null;
  csvDelimiter: string;
  csvIncludeHeaders: boolean;
  showAlert: (
    message: string,
    options: { title: string; kind: "error" },
  ) => void;
  t: (key: string) => string;
}

export function useGridClipboard({
  columns,
  data,
  selectedRowIndices,
  copyFormat,
  tableName,
  csvDelimiter,
  csvIncludeHeaders,
  showAlert,
  t,
}: UseGridClipboardOptions) {
  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await copyTextToClipboard(text);
      } catch (e) {
        console.error("Copy failed:", e);
        showAlert(t("common.error") + ": " + e, {
          title: t("common.error"),
          kind: "error",
        });
      }
    },
    [t, showAlert],
  );

  const formatRows = useCallback(
    (rows: unknown[][], withHeaders = false) => {
      if (copyFormat === "json") return rowsToJSON(rows, columns);
      if (copyFormat === "sql-insert") {
        return rowsToSqlInsert(rows, columns, tableName ?? "table");
      }
      if (withHeaders && csvIncludeHeaders) {
        return rowsToCSVWithHeaders(rows, columns, "null", csvDelimiter);
      }
      return rowsToCSV(rows, "null", csvDelimiter);
    },
    [columns, copyFormat, csvDelimiter, csvIncludeHeaders, tableName],
  );

  const copySelectedCells = useCallback(async () => {
    if (selectedRowIndices.size === 0) return;
    await copyToClipboard(
      formatRows(getSelectedRows(data, selectedRowIndices), true),
    );
  }, [selectedRowIndices, data, formatRows, copyToClipboard]);

  return {
    copyToClipboard,
    formatRows,
    copySelectedCells,
  };
}
