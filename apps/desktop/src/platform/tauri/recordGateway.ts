import { invokeTauri } from "./transport";

export const recordGateway = {
  insertRecord<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("insert_record", payload);
  },
  updateRecord<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("update_record", payload);
  },
  deleteRecord<T>(payload: Record<string, unknown>) {
    return invokeTauri<T>("delete_record", payload);
  },
};
