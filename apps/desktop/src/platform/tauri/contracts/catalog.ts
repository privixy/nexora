export interface CatalogContextDto {
  connectionId: string;
  database?: string;
  schema?: string;
}

export interface TableColumnDto {
  name: string;
  data_type: string;
  nullable?: boolean;
  default_value?: unknown;
}
