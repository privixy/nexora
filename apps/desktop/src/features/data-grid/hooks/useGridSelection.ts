import { useCallback, useState } from "react";
import { calculateSelectionRange, toggleSetValue } from "../lib/dataGrid";

export interface UseGridSelectionOptions {
  selectedRows?: Set<number>;
  onSelectionChange?: (indices: Set<number>) => void;
}

export function useGridSelection({
  selectedRows,
  onSelectionChange,
}: UseGridSelectionOptions) {
  const [internalSelectedRowIndices, setInternalSelectedRowIndices] = useState<Set<number>>(
    new Set(),
  );
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number | null>(null);
  const selectedRowIndices = selectedRows || internalSelectedRowIndices;

  const updateSelection = useCallback(
    (newSelection: Set<number>) => {
      if (onSelectionChange) {
        onSelectionChange(newSelection);
      } else {
        setInternalSelectedRowIndices(newSelection);
      }
    },
    [onSelectionChange],
  );

  const handleRowClick = useCallback(
    (index: number, event: React.MouseEvent) => {
      let newSelected = new Set(selectedRowIndices);

      if (event.shiftKey && lastSelectedRowIndex !== null) {
        const range = calculateSelectionRange(lastSelectedRowIndex, index);
        if (!event.ctrlKey && !event.metaKey) {
          newSelected.clear();
        }
        range.forEach((i) => newSelected.add(i));
      } else if (event.ctrlKey || event.metaKey) {
        newSelected = toggleSetValue(newSelected, index);
        setLastSelectedRowIndex(index);
      } else {
        newSelected.clear();
        newSelected.add(index);
        setLastSelectedRowIndex(index);
      }

      updateSelection(newSelected);
    },
    [selectedRowIndices, lastSelectedRowIndex, updateSelection],
  );

  return {
    selectedRowIndices,
    updateSelection,
    handleRowClick,
  };
}
