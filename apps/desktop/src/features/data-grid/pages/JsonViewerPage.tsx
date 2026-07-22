import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { windowGateway } from "../../../platform/tauri/windowGateway";
import { FileJson } from "lucide-react";
import { JsonInput } from "../components/JsonInput";

interface SessionDto {
  value: unknown;
  original_value: unknown;
  col_name: string;
  read_only: boolean;
}

export const JsonViewerPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";

  const [session, setSession] = useState<SessionDto | null>(null);
  const [currentValue, setCurrentValue] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    windowGateway.getJsonViewerSession<SessionDto>({ sessionId })
      .then((data) => {
        setSession(data);
        setCurrentValue(data.value);
      })
      .catch((e) => setError(String(e)));
  }, [sessionId]);

  const handleClose = useCallback(async () => {
    await windowGateway.getCurrentWindow().close();
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await windowGateway.completeJsonViewerSession({
        sessionId,
        value: currentValue,
      });
    } catch (e) {
      setError(String(e));
      return;
    }
    await windowGateway.getCurrentWindow().close();
  }, [sessionId, currentValue]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const showSave = session && !session.read_only;
  const displayError = error ?? (!sessionId ? "No session ID provided" : null);

  return (
    <div className="w-screen h-screen overflow-hidden bg-base text-primary">
      <div className="h-full p-4 lg:p-6">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-default bg-elevated/70 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-blue-600/12 via-cyan-500/8 to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3 border-b border-default px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/20">
              <FileJson size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-primary truncate">
                {session?.col_name ?? "JSON Viewer"}
              </h1>
              {session?.read_only && (
                <p className="mt-0.5 text-xs text-muted">Read-only</p>
              )}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 p-4">
            {displayError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {displayError}
              </div>
            ) : session ? (
              <JsonInput
                value={currentValue}
                originalValue={session.original_value}
                onChange={setCurrentValue}
                readOnly={session.read_only}
                className="h-full"
                disableExpand
                fillHeight
              />
            ) : (
              <p className="text-muted text-sm">{t("common.loading")}</p>
            )}
          </div>

          <div className="relative p-4 border-t border-default bg-base/35 flex justify-end gap-3 shrink-0">
            {showSave ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-secondary hover:text-primary transition-colors text-sm"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                  {t("jsonViewer.save")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
              >
                {t("jsonViewer.close")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
