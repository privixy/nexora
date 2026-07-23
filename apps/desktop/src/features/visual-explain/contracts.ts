import type { ExplainNode } from "../../shared/types/explain";

export type { ExplainNode, ExplainPlan } from "../../shared/types/explain";
export type ExplainViewMode = "graph" | "table" | "raw" | "ai";
export interface ExplainPlanNodeData extends Record<string, unknown> {
  node: ExplainNode;
  maxCost: number;
  maxTime: number;
  hasAnalyzeData: boolean;
  isSelected: boolean;
}
