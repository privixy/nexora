export interface ChildProcessInfo {
  pid: number;
  cpu_percent: number;
  memory_bytes: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
}
export interface ProcessInfo {
  plugin_id: string;
  plugin_name: string;
  pid: number | null;
  cpu_percent: number;
  memory_bytes: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
  status: "running" | "stopped" | "unknown";
  children: ChildProcessInfo[];
}
export interface NexoraChildProcess {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_bytes: number;
}
export interface NexoraSelfStats {
  pid: number;
  cpu_percent: number;
  self_memory_bytes: number;
  total_memory_bytes: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
  child_count: number;
}
export interface SystemStats {
  cpu_percent: number;
  memory_used: number;
  memory_total: number;
  disk_read_bytes: number;
  disk_write_bytes: number;
  process_count: number;
  nexora: NexoraSelfStats | null;
}
export type ProcessSortKey = keyof Pick<ProcessInfo, "plugin_name" | "cpu_percent" | "memory_bytes" | "status">;
