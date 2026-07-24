import { useCallback, useEffect, useRef } from "react";
import { listenTauri } from "../../../platform/tauri/events";
import { windowGateway } from "../../../platform/tauri/windowGateway";
import { buildPkMap, serializePkKey } from "../lib/dataGrid";

interface JsonViewerSession {
  colName: string;
  rowData: unknown[];
  isInsertion: boolean;
  tempId?: string;
}

export interface OpenJsonViewerOptions {
  value: unknown;
  originalValue: unknown;
  colName: string;
  rowData: unknown[];
  rowIndex: number;
  isInsertion: boolean;
  tempId: string | undefined;
  readOnly: boolean;
  rowLabel: string;
}

export interface UseJsonViewerSessionOptions {
  pkColumns?: string[] | null;
  pkIndexMaps: number[];
  onPendingChange?: (pkVal: unknown, colName: string, value: unknown) => void;
  onPendingInsertionChange?: (
    tempId: string,
    colName: string,
    value: unknown,
  ) => void;
}

export function useJsonViewerSession({
  pkColumns,
  pkIndexMaps,
  onPendingChange,
  onPendingInsertionChange,
}: UseJsonViewerSessionOptions) {
  const pendingJsonSessions = useRef<Map<string, JsonViewerSession>>(new Map());

  const openJsonViewerWindow = useCallback(
    async ({
      value,
      originalValue,
      colName,
      rowData,
      isInsertion,
      tempId,
      readOnly,
      rowLabel,
    }: OpenJsonViewerOptions) => {
      try {
        let cellKey: string | null = null;
        const canSaveBack =
          (isInsertion && !!tempId) || (!isInsertion && pkIndexMaps.length > 0);
        if (isInsertion && tempId) {
          cellKey = `ins:${tempId}:${colName}`;
        } else if (!isInsertion && pkIndexMaps.length > 0) {
          const pkMapVal = buildPkMap(pkColumns!, rowData, pkIndexMaps);
          const serialized = serializePkKey(pkMapVal);
          if (serialized !== "" && serialized !== "null" && serialized !== "undefined") {
            cellKey = `pk:${serialized}:${colName}`;
          }
        }
        const sessionId = await windowGateway.openJsonViewer<string>({
          value,
          originalValue,
          colName,
          rowLabel,
          readOnly: readOnly || !canSaveBack,
          cellKey,
        });
        pendingJsonSessions.current.set(sessionId, {
          colName,
          rowData,
          isInsertion,
          tempId,
        });
      } catch (e) {
        console.error("Failed to open JSON viewer window:", e);
      }
    },
    [pkColumns, pkIndexMaps],
  );

  useEffect(() => {
    const unlistenPromise = listenTauri<{ session_id: string; value: unknown }>(
      "json-viewer:saved",
      ({ session_id, value }) => {
        const session = pendingJsonSessions.current.get(session_id);
        if (!session) return;
        pendingJsonSessions.current.delete(session_id);

        const { colName, rowData, isInsertion, tempId } = session;
        if (isInsertion && onPendingInsertionChange && tempId) {
          onPendingInsertionChange(tempId, colName, value);
        } else if (!isInsertion && onPendingChange && pkIndexMaps.length > 0) {
          const pkMapVal = buildPkMap(pkColumns!, rowData, pkIndexMaps);
          onPendingChange(pkMapVal, colName, value);
        }
      },
    );
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [onPendingChange, onPendingInsertionChange, pkIndexMaps, pkColumns]);

  return { openJsonViewerWindow };
}
