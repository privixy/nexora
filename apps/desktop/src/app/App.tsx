import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUpdate } from "../hooks/useUpdate";
import { useChangelog } from "../hooks/useChangelog";
import { useSettings } from "../hooks/useSettings";
import { useResultTypeColors } from "../hooks/useResultTypeColors";
import { APP_VERSION } from "../version";
import { isVersionAtMost, isVersionNewer } from "../utils/versionCompare";
import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";

const WHATS_NEW_VERSION_KEY = "nexora_last_seen_version";

export function App() {
  const {
    updateInfo,
    isDownloading,
    downloadProgress,
    downloadAndInstall,
    dismissUpdate,
    error: updateError,
  } = useUpdate();
  const { settings, isLoading: isSettingsLoading } = useSettings();
  useResultTypeColors();
  const [isDebugMode, setIsDebugMode] = useState(false);

  const lastSeenVersion = localStorage.getItem(WHATS_NEW_VERSION_KEY);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(
    () => lastSeenVersion !== null && isVersionNewer(APP_VERSION, lastSeenVersion),
  );

  const { entries: allEntries, isLoading: isChangelogLoading } = useChangelog();

  const whatsNewEntries = useMemo(() => {
    if (!lastSeenVersion) return [];
    return allEntries.filter(
      (entry) =>
        isVersionNewer(entry.version, lastSeenVersion) &&
        isVersionAtMost(entry.version, APP_VERSION),
    );
  }, [lastSeenVersion, allEntries]);

  const dismissWhatsNew = useCallback(() => {
    localStorage.setItem(WHATS_NEW_VERSION_KEY, APP_VERSION);
    setIsWhatsNewOpen(false);
  }, []);

  // Seed WHATS_NEW_VERSION_KEY for users who completed the welcome flow
  // before the WhatsNew feature was introduced. Without this, lastSeenVersion
  // stays null and WhatsNew never triggers.
  useEffect(() => {
    if (
      !isSettingsLoading &&
      settings.showWelcome === false &&
      !localStorage.getItem(WHATS_NEW_VERSION_KEY)
    ) {
      localStorage.setItem(WHATS_NEW_VERSION_KEY, APP_VERSION);
    }
  }, [isSettingsLoading, settings.showWelcome]);

  useEffect(() => {
    invoke<boolean>("is_debug_mode").then((debugMode) => {
      setIsDebugMode(debugMode);
    });
  }, []);

  useEffect(() => {
    if (isDebugMode) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isDebugMode]);

  return (
    <AppProviders
      updateNotification={{
        isOpen: !!updateInfo,
        onClose: dismissUpdate,
        updateInfo: updateInfo!,
        isDownloading,
        downloadProgress,
        onDownloadAndInstall: downloadAndInstall,
        error: updateError,
      }}
      whatsNew={{
        isOpen: isWhatsNewOpen && !isSettingsLoading && settings.showWelcome === false,
        onClose: dismissWhatsNew,
        entries: whatsNewEntries,
        isLoading: isChangelogLoading,
      }}
    >
      <AppRoutes />
    </AppProviders>
  );
}
