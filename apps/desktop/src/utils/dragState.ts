interface DragTableState {
  table: string;
  database?: string;
  schema?: string;
}

let state: DragTableState | null = null;

export const dragState = {
  get table() { return state?.table ?? null; },
  get database() { return state?.database ?? null; },
  get schema() { return state?.schema ?? null; },
  start(table: string, context: Omit<DragTableState, "table"> = {}) {
    state = { table, ...context };
  },
  clear() { state = null; },
};
