export interface Pagination {
  page: number;
  page_size: number;
  total_rows: number | null;
  has_more: boolean;
}

export interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
  default_value?: string;
  character_maximum_length?: number;
}

export interface PendingInsertion {
  tempId: string;
  data: Record<string, unknown>;
  displayIndex: number;
}
