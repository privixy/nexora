export type { McpApprovalMode } from "../settings";
export { McpModal } from "./components/McpModal";
export { McpPage } from "./pages/McpPage";
export {
  focusWindowForApproval,
  notifyApprovalRequest,
  restoreWindowAlwaysOnTop,
} from './lib/mcpApprovalAttention';

import {
  focusWindowForApproval,
  notifyApprovalRequest,
  restoreWindowAlwaysOnTop,
} from './lib/mcpApprovalAttention';

export const mcpApprovalAttentionAdapter = {
  focusWindowForApproval,
  notifyApprovalRequest,
  restoreWindowAlwaysOnTop,
};
