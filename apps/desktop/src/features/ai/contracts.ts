export interface AiQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (sql: string) => void;
  connectionId?: string;
  schema?: string;
}
export interface AiExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}
export interface AiDropdownButtonProps {
  onGenerate: () => void;
  onExplain: () => void;
  disableAll?: boolean;
  disableExplain?: boolean;
  compact?: boolean;
}
export interface AiQueryRequest {
  connectionId: string;
  prompt: string;
}
