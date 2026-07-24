export interface RecordContextDto {
  connectionId: string;
  database?: string;
  schema?: string;
  table: string;
}

export interface RecordMutationDto extends RecordContextDto {
  values?: Record<string, unknown>;
  primaryKey?: Record<string, unknown>;
}
