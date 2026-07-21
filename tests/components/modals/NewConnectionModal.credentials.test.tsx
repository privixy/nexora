import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { NewConnectionModal } from "../../../src/components/modals/NewConnectionModal";

interface MockSelectProps {
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  labels?: Record<string, string>;
}

const driverState = vi.hoisted(() => ({
  defaultPort: 5432 as number | null,
  schemas: false,
}));

const k8sMocks = vi.hoisted(() => ({
  loadK8sConnections: vi.fn(),
  getK8sContexts: vi.fn(),
}));

const sshMocks = vi.hoisted(() => ({
  loadSshConnections: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("../../../src/components/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock("../../../src/components/ui/Select", () => ({
  Select: ({ value, options, onChange, placeholder, labels }: MockSelectProps) => (
    <select aria-label={placeholder ?? "select"} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder ?? "Select option"}</option>
      {options.map((option) => (
        <option key={option} value={option}>{labels?.[option] ?? option}</option>
      ))}
    </select>
  ),
}));

vi.mock("../../../src/hooks/useDrivers", () => ({
  useDrivers: () => ({
    drivers: [{
      id: "mysql",
      name: "MySQL",
      version: "1.0.0",
      default_port: driverState.defaultPort,
      is_builtin: true,
      capabilities: {
        file_based: false,
        folder_based: false,
        connection_string: true,
        supports_ssl: false,
        schemas: driverState.schemas,
        multiple_databases: true,
      },
    }],
    allDrivers: [],
    installedPlugins: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../../src/hooks/usePluginSlotRegistry", () => ({
  usePluginSlotRegistry: () => ({ getSlotContributions: () => [] }),
}));

vi.mock("../../../src/utils/k8s", () => ({
  loadK8sConnections: k8sMocks.loadK8sConnections,
  getK8sContexts: k8sMocks.getK8sContexts,
  getK8sNamespaces: vi.fn(),
  getK8sResources: vi.fn(),
  getK8sResourcePorts: vi.fn(),
}));

vi.mock("../../../src/utils/ssh", () => ({
  loadSshConnections: sshMocks.loadSshConnections,
}));

vi.mock("../../../src/components/modals/SshConnectionsModal", () => ({ SshConnectionsModal: () => null }));
vi.mock("../../../src/components/modals/K8sConnectionsModal", () => ({ K8sConnectionsModal: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  driverState.schemas = false;
  sshMocks.loadSshConnections.mockResolvedValue([]);
  k8sMocks.loadK8sConnections.mockResolvedValue([]);
  k8sMocks.getK8sContexts.mockResolvedValue([]);
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "get_connection_by_id") return Promise.reject("missing credentials");
    if (command === "list_databases") {
      const password = (args as { request?: { params?: { password?: string } } }).request?.params?.password;
      return password === "secret" ? Promise.resolve(["app"]) : Promise.reject("missing credentials");
    }
    if (command === "update_connection") return Promise.resolve("ok");
    if (command === "set_connection_appearance") return Promise.resolve("ok");
    return Promise.resolve("ok");
  });
});

describe("NewConnectionModal credential import workflow", () => {
  it("covers missing credential input, retry with entered credential, and save payload without unrelated validation blocking", async () => {
    const onSave = vi.fn();
    render(
      <NewConnectionModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
        initialConnection={{
          id: "imported-1",
          name: "Imported",
          params: {
            driver: "mysql",
            host: "localhost",
            port: 5432,
            username: "develop",
            database: "",
            save_in_keychain: false,
          },
        }}
      />,
    );

    fireEvent.click(await screen.findByText("newConnection.selectDatabases"));
    fireEvent.click(screen.getByText("newConnection.loadDatabases"));

    expect(await screen.findByText("missing credentials")).toBeInTheDocument();

    fireEvent.click(screen.getByText("newConnection.general"));
    fireEvent.change(await screen.findByPlaceholderText("newConnection.passwordPlaceholder"), { target: { value: "secret" } });
    fireEvent.click(screen.getByText("newConnection.selectDatabases"));
    fireEvent.click(screen.getByText("newConnection.loadDatabases"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "list_databases",
        expect.objectContaining({
          request: expect.objectContaining({
            connection_id: "imported-1",
            params: expect.objectContaining({ password: "secret" }),
          }),
        }),
      );
    });

    fireEvent.click(screen.getByText("newConnection.save"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("update_connection", {
        id: "imported-1",
        name: "Imported",
        params: expect.objectContaining({
          driver: "mysql",
          host: "localhost",
          port: 5432,
          username: "develop",
          password: "secret",
        }),
        detectJsonInTextColumns: null,
      });
    });
    expect(onSave).toHaveBeenCalled();
    expect(screen.queryByText("missing credentials")).not.toBeInTheDocument();
  });
});
