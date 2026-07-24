import type { ApprovalExplainPlanRenderProps } from '../../settings';
import { VisualExplainView } from './VisualExplainView';

export function ApprovalExplainPlanView({
  plan,
  viewMode,
  onViewModeChange,
  selectedNodeId,
  onSelectNode,
}: ApprovalExplainPlanRenderProps) {
  return (
    <VisualExplainView
      plan={plan}
      isLoading={false}
      error={null}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      aiEnabled={false}
    />
  );
}
