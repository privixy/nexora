import { BookOpen, Clock, Layers, Star, type LucideIcon } from "lucide-react";

export type SidebarTab = "structure" | "favorites" | "history" | "notebooks";

interface ExplorerTabsProps {
  activeTab: SidebarTab;
  counts: {
    favorites: number;
    history: number;
    notebooks: number;
  };
  labels: Record<SidebarTab, string>;
  onChange: (tab: SidebarTab) => void;
}

const icons: Record<SidebarTab, LucideIcon> = {
  structure: Layers,
  favorites: Star,
  history: Clock,
  notebooks: BookOpen,
};

export const ExplorerTabs = ({ activeTab, counts, labels, onChange }: ExplorerTabsProps) => (
  <div className="flex items-center border-b border-default bg-base px-1">
    {(["structure", "favorites", "history", "notebooks"] as const).map((id) => {
      const Icon = icons[id];
      const count = id === "structure" ? undefined : counts[id];
      const isActive = activeTab === id;

      return (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors relative min-w-0 ${
            isActive ? "flex-1 text-primary" : "shrink-0 text-muted hover:text-secondary"
          }`}
          title={`${labels[id]}${count !== undefined && count > 0 ? ` (${count})` : ""}`}
          aria-label={labels[id]}
        >
          <Icon size={14} className="shrink-0" />
          {isActive && <span className="truncate">{labels[id]}</span>}
          {count !== undefined && count > 0 && (
            <span className="shrink-0 rounded-full bg-overlay px-1.5 text-[10px] leading-[1.4] text-muted">
              {count}
            </span>
          )}
          {isActive && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-blue-500 rounded-full" />}
        </button>
      );
    })}
  </div>
);
