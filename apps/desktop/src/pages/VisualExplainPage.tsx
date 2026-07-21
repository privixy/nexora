import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileJson, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { ExplainPlan } from "../types/explain";
import { VisualExplainView } from "../components/explain/VisualExplainView";
import type { ExplainViewMode } from "../components/modals/visual-explain/ExplainSummaryBar";
import {
  getExplainFileName,
  parseExplainFileParam,
} from "../utils/explainImport";
import { parseVisualExplainDeepLink } from "../utils/aiActivity";
import { useSettings } from "../hooks/useSettings";

export interface VisualExplainPageProps {
  /// When provided, render in embedded mode: skip the page header, use the
  /// supplied plan instead of loading from disk, and ignore router params.
  initialPlan?: ExplainPlan | null;
  /// Hide the page chrome (header + file picker). Defaults to false.
  compactMode?: boolean;
}

export const VisualExplainPage = ({
  initialPlan = null,
  compactMode = false,
}: VisualExplainPageProps = {}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { search } = useLocation();
  const initialParamPath = parseExplainFileParam(search);
  const deepLink = parseVisualExplainDeepLink(search);
  const isDeepLink = !!deepLink.query && !!deepLink.connectionId;

  const [filePath, setFilePath] = useState<string | null>(initialParamPath);
  const [plan, setPlan] = useState<ExplainPlan | null>(initialPlan);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ExplainViewMode>("graph");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialPlan?.root.id ?? null,
  );

  const loadPlan = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    setPlan(null);
    setSelectedNodeId(null);
    try {
      const result = await invoke<ExplainPlan>("load_explain_from_file", {
        path,
      });
      setPlan(result);
      setSelectedNodeId(result.root.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runExplainForDeepLink = useCallback(
    async (connectionId: string, query: string) => {
      setIsLoading(true);
      setError(null);
      setPlan(null);
      setSelectedNodeId(null);
      try {
        const result = await invoke<ExplainPlan>("explain_query_plan", {
          connectionId,
          query,
          analyze: false,
          schema: null,
        });
        setPlan(result);
        setSelectedNodeId(result.root.id);
      } catch (err) {
        setError(String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // On mount: prefer initialPlan (embedded mode), then deep link, then file
  // path, then any pending CLI handoff.
  useEffect(() => {
    if (initialPlan) return;
    let cancelled = false;

    const bootstrap = async () => {
      if (isDeepLink) {
        await runExplainForDeepLink(deepLink.connectionId!, deepLink.query!);
        return;
      }
      if (initialParamPath) {
        await loadPlan(initialParamPath);
        return;
      }
      try {
        const pending = await invoke<string | null>("get_pending_explain_file");
        if (!cancelled && pending) {
          setFilePath(pending);
          await loadPlan(pending);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [
    initialPlan,
    initialParamPath,
    isDeepLink,
    deepLink.connectionId,
    deepLink.query,
    loadPlan,
    runExplainForDeepLink,
  ]);

  const handlePickFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [
        { name: "Explain", extensions: ["json", "txt"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (typeof selected === "string" && selected.trim().length > 0) {
      setFilePath(selected);
      await loadPlan(selected);
    }
  }, [loadPlan]);

  const handleReload = useCallback(() => {
    if (filePath) loadPlan(filePath);
  }, [filePath, loadPlan]);

  const fileLabel = filePath ? getExplainFileName(filePath) : null;
  const content = (
    <div className="relative flex-1 min-h-0">
      {!compactMode && !filePath && !plan && !isLoading ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-default bg-base/70 shadow-sm">
            <FileJson size={32} className="text-green-400/60" />
          </div>
          <p className="text-sm">{t("visualExplainPage.emptyHint")}</p>
          <button
            onClick={handlePickFile}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-green-500/20"
          >
            <FolderOpen size={14} />
            {t("visualExplainPage.openFile")}
          </button>
        </div>
      ) : isLoading && !plan ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-sm">{t("visualExplainPage.loading")}</span>
        </div>
      ) : (
        <VisualExplainView
          plan={plan}
          isLoading={isLoading}
          error={error}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          aiEnabled={!!settings.aiEnabled}
        />
      )}
    </div>
  );

  if (compactMode) {
    return <div className="w-full h-full flex flex-col bg-base">{content}</div>;
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-base">
      <div className="h-full px-6 py-6 lg:px-8 lg:py-8">
        <div className="relative mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-default bg-elevated/70 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-green-600/15 via-blue-500/8 to-transparent pointer-events-none" />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-green-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between border-b border-default px-6 py-5 lg:px-8">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500/15 text-green-400 ring-1 ring-green-400/20">
                <FileJson size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-primary truncate">
                  {t("visualExplainPage.title")}
                </h1>
                {fileLabel ? (
                  <p
                    className="mt-1 text-xs text-muted font-mono truncate"
                    title={filePath ?? undefined}
                  >
                    {fileLabel}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {t("visualExplainPage.noFile")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePickFile}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted hover:text-primary hover:bg-surface-secondary/50 transition-colors"
              >
                <FolderOpen size={14} />
                {t("visualExplainPage.openFile")}
              </button>
              <button
                onClick={handleReload}
                disabled={!filePath || isLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted hover:text-primary hover:bg-surface-secondary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  size={14}
                  className={isLoading ? "animate-spin" : ""}
                />
                {t("visualExplainPage.reload")}
              </button>
            </div>
          </div>
          {content}
        </div>
      </div>
    </div>
  );
};
