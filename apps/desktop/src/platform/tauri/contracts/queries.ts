export interface QueryRequestDto {
  connectionId: string;
  query: string;
  database?: string;
  schema?: string;
}

export interface QueryResultDto {
  columns: string[];
  rows: unknown[][];
  affected_rows?: number;
}
