import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Layers } from "lucide-react";
import clsx from "clsx";
import { AiActivityEventsTab } from "./ai-activity/AiActivityEventsTab";
import { AiActivitySessionsTab } from "./ai-activity/AiActivitySessionsTab";
import type { AiActivityEvent } from "../contracts";

type AiActivityTab = "events" | "sessions";

export interface VisualExplainTarget {
  query: string;
  connectionId: string;
  connectionLabel?: string;
}

interface AiActivityPanelProps {
  renderVisualExplain?: (
    target: VisualExplainTarget,
    onClose: () => void,
  ) => React.ReactNode;
}

const TABS: Array<{
  id: AiActivityTab;
  icon: React.ComponentType<{ size: number }>;
  labelKey: string;
}> = [
  { id: "events", icon: Activity, labelKey: "aiActivity.tabs.events" },
  { id: "sessions", icon: Layers, labelKey: "aiActivity.tabs.sessions" },
];

export function AiActivityPanel({ renderVisualExplain }: AiActivityPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AiActivityTab>("events");
  const [explainTarget, setExplainTarget] = useState<VisualExplainTarget | null>(
    null,
  );
  const handleOpenInVisualExplain = (event: AiActivityEvent) => {
    if (!event.query || !event.connectionId) return;
    setExplainTarget({
      query: event.query,
      connectionId: event.connectionId,
      connectionLabel: event.connectionName ?? undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">
          {t("aiActivity.title")}
        </h2>
        <p className="text-xs text-muted mt-1">
          {t("aiActivity.description")}
        </p>
      </div>

      <div className="flex gap-1 border-b border-default">
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id
                ? "text-primary border-blue-500"
                : "text-muted border-transparent hover:text-primary",
            )}
          >
            <Icon size={14} />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === "events" ? (
        <AiActivityEventsTab
          onOpenInVisualExplain={
            renderVisualExplain ? handleOpenInVisualExplain : undefined
          }
        />
      ) : (
        <AiActivitySessionsTab />
      )}
      {explainTarget &&
        renderVisualExplain?.(explainTarget, () => setExplainTarget(null))}
    </div>
  );
}
