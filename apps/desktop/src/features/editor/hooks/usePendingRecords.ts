import type { PendingInsertion, Tab } from "..";

export interface PendingRecords {
  pendingChanges?: Tab["pendingChanges"];
  pendingDeletions?: Tab["pendingDeletions"];
  pendingInsertions?: Record<string, PendingInsertion>;
}

export function hasPendingRecords(records: PendingRecords): boolean {
  return Boolean(
    (records.pendingChanges && Object.keys(records.pendingChanges).length > 0) ||
      (records.pendingDeletions && Object.keys(records.pendingDeletions).length > 0) ||
      (records.pendingInsertions && Object.keys(records.pendingInsertions).length > 0),
  );
}
