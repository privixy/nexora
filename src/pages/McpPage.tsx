import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import Editor from "@monaco-editor/react";
import {
  Activity,
  Check,
  Copy,
  Cpu,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import {
  AnthropicIcon,
  AntigravityIcon,
  CursorIcon,
  OpenAIIcon,
  OpenCodeIcon,
  WindsurfIcon,
} from "../components/icons/ClientIcons";
import { AiActivityPanel } from "../components/settings/AiActivityPanel";
import { McpSafetySection } from "../components/modals/mcp/McpSafetySection";
import { useAlert } from "../hooks/useAlert";
import { useEditorTheme } from "../hooks/useEditorTheme";
import { loadMonacoTheme } from "../themes/themeUtils";

interface McpClientStatus {
  client_id: string;
  client_name: string;
  installed: boolean;
  config_path: string | null;
  executable_path: string;
  client_type: string;
  manual_command?: string | null;
}

const sortMcpClients = (clients: McpClientStatus[]) =>
  [...clients].sort((a, b) => {
    if (a.client_id === "other") return 1;
    if (b.client_id === "other") return -1;
    return 0;
  });

type McpPageTab = "setup" | "activity" | "safety";

const ClientIcon = ({
  clientId,
  size = 20,
}: {
  clientId: string;
  size?: number;
}) => {
  switch (clientId) {
    case "claude":
    case "claude_code":
      return <AnthropicIcon size={size} />;
    case "cursor":
      return <CursorIcon size={size} className="text-white" />;
    case "windsurf":
      return <WindsurfIcon size={size} className="text-white" />;
    case "antigravity":
      return <AntigravityIcon size={size} />;
    case "codex":
      return <OpenAIIcon size={size} className="text-[#10a37f]" />;
    case "opencode":
      return <OpenCodeIcon size={size} />;
    default:
      return <Cpu size={size} />;
  }
};

export function McpPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<McpPageTab>("setup");

  const tabs: Array<{
    id: McpPageTab;
    icon: React.ComponentType<{ size: number }>;
    label: string;
  }> = [
    { id: "setup", icon: Cpu, label: t("mcp.tabs.setup") },
    { id: "activity", icon: Activity, label: t("mcp.tabs.activity") },
    { id: "safety", icon: ShieldCheck, label: t("mcp.tabs.safety") },
  ];

  return (
    <div className="h-full min-h-0 overflow-hidden bg-base">
      <div className="h-full min-h-0 px-6 py-6 lg:px-10 lg:py-8">
        <div className="relative mx-auto flex h-full min-h-0 max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-default bg-elevated/70 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-purple-600/15 via-blue-500/8 to-transparent pointer-events-none" />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <header className="relative flex flex-col gap-4 border-b border-default px-6 py-6 lg:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400 ring-1 ring-purple-400/20">
                <Cpu size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-primary tracking-tight">
                  {t("mcp.title")}
                </h1>
                <p className="mt-1 text-sm text-muted">{t("mcp.subtitle")}</p>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-secondary">
              {t("mcp.description")}
            </p>
          </header>

          <div className="relative flex gap-2 border-b border-default bg-base/25 px-6 py-3 lg:px-8">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                  tab === id
                    ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20"
                    : "text-muted hover:text-primary hover:bg-surface-secondary/50",
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            {tab === "setup" && <McpSetupPanel />}
            {tab === "activity" && <AiActivityPanel />}
            {tab === "safety" && (
              <div className="max-w-4xl">
                <McpSafetySection />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function McpSetupPanel() {
  const { t } = useTranslation();
  const editorTheme = useEditorTheme();
  const { showAlert } = useAlert();
  const [clients, setClients] = useState<McpClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const selectedClient = useMemo(
    () =>
      clients.find((client) => client.client_id === selectedClientId) ??
      clients[0] ??
      null,
    [clients, selectedClientId],
  );

  const jsonValue = useMemo(() => {
    const command = selectedClient?.executable_path || "nexora";

    return JSON.stringify(
      selectedClient?.client_type === "opencode"
        ? {
            mcp: {
              nexora: {
                type: "local",
                command: [command, "--mcp"],
                enabled: true,
              },
            },
          }
        : {
            mcpServers: {
              nexora: {
                command,
                args: ["--mcp"],
              },
            },
          },
      null,
      2,
    );
  }, [selectedClient?.client_type, selectedClient?.executable_path]);

  const cliCommand = useMemo(
    () =>
      selectedClient?.manual_command ||
      `claude mcp add --scope user nexora ${
        selectedClient?.executable_path || "nexora"
      } -- --mcp`,
    [selectedClient?.executable_path, selectedClient?.manual_command],
  );

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoke<McpClientStatus[]>("get_mcp_status");
      const sortedClients = sortMcpClients(res);
      setClients(sortedClients);
      setSelectedClientId(
        (current) => current ?? sortedClients[0]?.client_id ?? null,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInstall = async (clientId: string) => {
    try {
      const clientName = await invoke<string>("install_mcp_config", {
        clientId,
      });
      showAlert(t("mcp.successMsg", { client: clientName }), {
        kind: "info",
        title: t("mcp.successTitle"),
      });
      await loadStatus();
    } catch (e) {
      showAlert(String(e), { kind: "error", title: t("mcp.errorTitle") });
    }
  };

  const isCommandClient = selectedClient?.client_type === "command";

  if (loading) {
    return (
      <div className="rounded-lg border border-default bg-surface-secondary/25 py-12 text-center text-sm text-muted">
        {t("mcp.checking")}
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase text-muted">
          {t("mcp.clients")}
        </h2>
        <div className="space-y-2">
          {clients.map((client) => (
            <button
              key={client.client_id}
              onClick={() => setSelectedClientId(client.client_id)}
              className={clsx(
                "flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-colors",
                selectedClient?.client_id === client.client_id
                  ? "border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/5"
                  : "border-default bg-base/70 hover:border-strong hover:bg-base",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <ClientIcon clientId={client.client_id} size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <span className="truncate">{client.client_name}</span>
                    {client.client_type === "command" && (
                      <Terminal size={11} className="shrink-0 text-muted" />
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-muted">
                    {client.config_path ?? t("mcp.notFound")}
                  </div>
                </div>
              </div>
              {client.installed ? (
                <div className="ml-3 flex shrink-0 items-center gap-2 rounded-full border border-green-900/50 bg-green-900/20 px-3 py-1 text-xs font-medium text-green-400">
                  <Check size={12} />
                  <span>{t("mcp.installed")}</span>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleInstall(client.client_id);
                  }}
                  className="ml-3 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-500"
                >
                  {t("mcp.install")}
                </button>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-2">
        {selectedClient && !selectedClient.installed ? (
          <>
            <h2 className="text-xs font-bold uppercase text-muted">
              {isCommandClient ? t("mcp.manualCommand") : t("mcp.manualConfig")}
              {" - "}
              {selectedClient.client_name}
            </h2>
            {isCommandClient ? (
              <div className="group relative">
                <div className="rounded-2xl border border-default bg-base/70 p-4 pr-12 font-mono text-xs text-secondary break-all shadow-inner">
                  {cliCommand}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cliCommand);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="absolute right-2 top-2 rounded bg-surface-secondary p-1.5 text-secondary opacity-0 transition-all hover:text-primary group-hover:opacity-100"
                >
                  {copiedCmd ? (
                    <Check size={13} className="text-green-400" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            ) : (
              <div className="group relative overflow-hidden rounded-2xl border border-default shadow-inner">
                <Editor
                  height="220px"
                  defaultLanguage="json"
                  theme={editorTheme.id}
                  value={jsonValue}
                  beforeMount={(monaco) => loadMonacoTheme(editorTheme, monaco)}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    lineNumbers: "off",
                    scrollBeyondLastLine: false,
                    folding: false,
                    domReadOnly: true,
                    contextmenu: false,
                    fontSize: 12,
                    padding: { top: 12, bottom: 12 },
                    wordWrap: "on",
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jsonValue);
                    setCopiedJson(true);
                    setTimeout(() => setCopiedJson(false), 2000);
                  }}
                  className="absolute right-2 top-2 z-10 rounded bg-surface-secondary p-2 text-secondary opacity-0 transition-all hover:text-primary group-hover:opacity-100"
                >
                  {copiedJson ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            )}
            <p className="text-xs text-muted">
              {isCommandClient ? t("mcp.manualCommandText") : t("mcp.manualText")}
            </p>
          </>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-default bg-surface-secondary/20 p-6 text-center text-sm text-muted">
            {t("mcp.installed")}
          </div>
        )}
      </section>
    </div>
  );
}
