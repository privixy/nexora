import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { ConnectionHealthMonitor } from "../features/connections";
import { EditorProvider, QueryHistoryProvider, SavedQueriesProvider } from "../features/editor";
import { AiApprovalGate } from "../features/settings";
import { mcpApprovalAttentionAdapter } from '../features/mcp';
import { ApprovalExplainPlanView } from '../features/visual-explain';
import { SshAskpassGate } from "../components/modals/SshAskpassGate";
import { UpdateNotificationModal } from "../components/modals/UpdateNotificationModal";
import { WhatsNewModal } from "../components/modals/WhatsNewModal";
import { AlertProvider } from "../contexts/AlertProvider";
import { ConnectionLayoutProvider } from "../contexts/ConnectionLayoutProvider";
import { KeybindingsProvider } from "../contexts/KeybindingsProvider";
import { PluginModalProvider, PluginSlotProvider } from "../features/plugins";
import { editorNotebookAdapter } from "../features/notebooks";

type UpdateNotificationProps = Parameters<typeof UpdateNotificationModal>[0];
type WhatsNewProps = Parameters<typeof WhatsNewModal>[0];

interface AppProvidersProps {
  children: ReactNode;
  updateNotification: UpdateNotificationProps;
  whatsNew: WhatsNewProps;
}

export function AppProviders({ children, updateNotification, whatsNew }: AppProvidersProps) {
  return (
    <>
      <AlertProvider>
        <BrowserRouter>
          <ConnectionHealthMonitor />
          <KeybindingsProvider>
            <PluginSlotProvider>
              <PluginModalProvider>
                <ConnectionLayoutProvider>
                  <SavedQueriesProvider>
                    <QueryHistoryProvider>
                      <EditorProvider notebookAdapter={editorNotebookAdapter}>
                        {children}
                      </EditorProvider>
                    </QueryHistoryProvider>
                  </SavedQueriesProvider>
                </ConnectionLayoutProvider>
              </PluginModalProvider>
            </PluginSlotProvider>
          </KeybindingsProvider>
        </BrowserRouter>
      </AlertProvider>

      <UpdateNotificationModal {...updateNotification} />

      <WhatsNewModal {...whatsNew} />

      <AiApprovalGate
        attentionAdapter={mcpApprovalAttentionAdapter}
        renderExplainPlan={(props) => <ApprovalExplainPlanView {...props} />}
      />
      <SshAskpassGate />
    </>
  );
}
