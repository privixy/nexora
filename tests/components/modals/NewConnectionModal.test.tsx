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
  defaultPort: 15432 as number | null,
  schemas: true,
}));

const k8sMocks = vi.hoisted(() => ({
  loadK8sConnections: vi.fn(),
  getK8sContexts: vi.fn(),
  getK8sNamespaces: vi.fn(),
  getK8sResources: vi.fn(),
  getK8sResourcePorts: vi.fn(),
}));

const sshMocks = vi.hoisted(() => ({
  loadSshConnections: vi.fn(),
}));

vi.mock("../../../src/components/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}));

vi.mock("../../../src/components/ui/Select", () => ({
  Select: ({ value, options, onChange, placeholder, labels }: MockSelectProps) => (
    <select
      aria-label={placeholder ?? "select"}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder ?? "Select option"}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("../../../src/hooks/useDrivers", () => ({
  useDrivers: () => ({
    drivers: [
      {
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
        },
      },
    ],
    allDrivers: [],
    installedPlugins: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../../src/hooks/usePluginSlotRegistry", () => ({
  usePluginSlotRegistry: () => ({
    getSlotContributions: () => [],
  }),
}));

vi.mock("../../../src/utils/ssh", () => ({
  loadSshConnections: sshMocks.loadSshConnections,
}));

vi.mock("../../../src/utils/k8s", () => ({
  loadK8sConnections: k8sMocks.loadK8sConnections,
  getK8sContexts: k8sMocks.getK8sContexts,
  getK8sNamespaces: k8sMocks.getK8sNamespaces,
  getK8sResources: k8sMocks.getK8sResources,
  getK8sResourcePorts: k8sMocks.getK8sResourcePorts,
}));

vi.mock("../../../src/components/modals/NewConnectionModal/AppearanceSection", () => ({
  AppearanceSection: () => null,
}));

vi.mock("../../../src/components/modals/SshConnectionsModal", () => ({
  SshConnectionsModal: () => null,
}));

vi.mock("../../../src/components/modals/K8sConnectionsModal", () => ({
  K8sConnectionsModal: () => null,
}));

type InitialConnection = Parameters<typeof NewConnectionModal>[0]["initialConnection"];

function renderModal(initialConnection?: InitialConnection) {
  return render(
    <NewConnectionModal
      isOpen={true}
      onClose={vi.fn()}
      onSave={vi.fn()}
      initialConnection={initialConnection}
    />,
  );
}

async function openInlineK8s() {
  renderModal();
  fireEvent.click(screen.getByText("Kubernetes"));
  fireEvent.click(screen.getByLabelText("newConnection.useK8s"));
  fireEvent.click(screen.getByText("newConnection.createInlineK8s"));

  await waitFor(() => {
    expect(screen.getByRole("option", { name: "ctx" })).toBeInTheDocument();
  });
}

async function chooseServiceResource() {
  fireEvent.change(screen.getByLabelText("newConnection.chooseContext"), {
    target: { value: "ctx" },
  });

  await waitFor(() => {
    expect(screen.getByRole("option", { name: "db" })).toBeInTheDocument();
  });
  fireEvent.change(screen.getByLabelText("newConnection.chooseNamespace"), {
    target: { value: "db" },
  });

  fireEvent.change(screen.getByLabelText("newConnection.k8sSelectType"), {
    target: { value: "service" },
  });

  await waitFor(() => {
    expect(screen.getByRole("option", { name: "mysql-svc" })).toBeInTheDocument();
  });
  fireEvent.change(screen.getByLabelText("newConnection.chooseResource"), {
    target: { value: "mysql-svc" },
  });
}

describe("NewConnectionModal K8s port defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driverState.defaultPort = 15432;
    driverState.schemas = true;
    vi.mocked(invoke).mockResolvedValue("ok");
    sshMocks.loadSshConnections.mockResolvedValue([]);
    k8sMocks.loadK8sConnections.mockResolvedValue([]);
    k8sMocks.getK8sContexts.mockResolvedValue(["ctx"]);
    k8sMocks.getK8sNamespaces.mockResolvedValue(["db"]);
    k8sMocks.getK8sResources.mockResolvedValue(["mysql-svc"]);
    k8sMocks.getK8sResourcePorts.mockResolvedValue([6543]);
  });

  it("uses the active driver default as the effective inline K8s port", async () => {
    await openInlineK8s();

    const portInput = screen.getByPlaceholderText("15432");
    expect(portInput).toHaveAttribute("type", "number");
    expect(portInput).toHaveValue(15432);

    fireEvent.click(screen.getByText("newConnection.testConnection"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "test_connection",
        expect.objectContaining({
          request: expect.objectContaining({
            params: expect.objectContaining({
              k8s_enabled: true,
              k8s_port: 15432,
            }),
          }),
        }),
      );
    });
  });

  it("clearing a manual K8s port re-enables single-port auto-prefill", async () => {
    await openInlineK8s();

    const portInput = screen.getByPlaceholderText("15432");
    fireEvent.change(portInput, { target: { value: "9999" } });
    await chooseServiceResource();

    expect(k8sMocks.getK8sResourcePorts).not.toHaveBeenCalled();
    expect(portInput).toHaveValue(9999);

    fireEvent.change(portInput, { target: { value: "" } });

    await waitFor(() => {
      expect(k8sMocks.getK8sResourcePorts).toHaveBeenCalledWith(
        "ctx",
        "db",
        "service",
        "mysql-svc",
      );
      expect(portInput).toHaveValue(6543);
    });

    fireEvent.click(screen.getByText("newConnection.testConnection"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "test_connection",
        expect.objectContaining({
          request: expect.objectContaining({
            params: expect.objectContaining({
              k8s_port: 6543,
            }),
          }),
        }),
      );
    });
  });
});

describe("NewConnectionModal imported connection credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    driverState.defaultPort = 5432;
    driverState.schemas = true;
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_connection_by_id") {
        return Promise.reject("missing credentials");
      }
      return Promise.resolve("ok");
    });
    sshMocks.loadSshConnections.mockResolvedValue([]);
    k8sMocks.loadK8sConnections.mockResolvedValue([]);
    k8sMocks.getK8sContexts.mockResolvedValue([]);
  });

  it("does not show a stored-password placeholder when an imported connection has no password", async () => {
    renderModal({
      id: "imported-1",
      name: "Imported",
      params: {
        driver: "mysql",
        host: "localhost",
        port: 5432,
        username: "develop",
        database: "postgres",
        save_in_keychain: false,
      },
    });

    const passwordInput = await screen.findByPlaceholderText(
      "newConnection.passwordPlaceholder",
    );

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(screen.queryByPlaceholderText("••••••••")).not.toBeInTheDocument();
  });

  it("clears a stale database-load error after entering the missing password", async () => {
    driverState.schemas = false;
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_connection_by_id") {
        return Promise.reject("missing credentials");
      }
      if (command === "list_databases") {
        return Promise.reject("password authentication failed");
      }
      return Promise.resolve("ok");
    });

    renderModal({
      id: "imported-1",
      name: "Imported",
      params: {
        driver: "mysql",
        host: "localhost",
        port: 5432,
        username: "develop",
        database: "postgres",
        save_in_keychain: false,
      },
    });

    fireEvent.click(screen.getByText("newConnection.selectDatabases"));

    await waitFor(() => {
      expect(screen.getByText("password authentication failed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("newConnection.general"));
    fireEvent.change(
      await screen.findByPlaceholderText("newConnection.passwordPlaceholder"),
      { target: { value: "secret" } },
    );
    fireEvent.click(screen.getByText("newConnection.selectDatabases"));

    expect(screen.queryByText("password authentication failed")).not.toBeInTheDocument();
  });

  it("passes a newly typed password to test connection and load databases", async () => {
    driverState.schemas = false;
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "get_connection_by_id") {
        return Promise.reject("missing credentials");
      }
      if (command === "list_databases") {
        return Promise.resolve(["postgres"]);
      }
      return Promise.resolve("Connection successful!");
    });

    renderModal({
      id: "imported-1",
      name: "Imported",
      params: {
        driver: "mysql",
        host: "localhost",
        port: 5432,
        username: "develop",
        database: "postgres",
        save_in_keychain: false,
      },
    });

    const passwordInput = await screen.findByPlaceholderText(
      "newConnection.passwordPlaceholder",
    );
    fireEvent.change(passwordInput, { target: { value: "secret" } });

    fireEvent.click(screen.getByText("newConnection.testConnection"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "test_connection",
        expect.objectContaining({
          request: expect.objectContaining({
            connection_id: "imported-1",
            params: expect.objectContaining({
              password: "secret",
            }),
          }),
        }),
      );
    });

    fireEvent.click(screen.getByText("newConnection.selectDatabases"));
    fireEvent.click(screen.getByText("newConnection.loadDatabases"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "list_databases",
        expect.objectContaining({
          request: expect.objectContaining({
            connection_id: "imported-1",
            params: expect.objectContaining({
              password: "secret",
            }),
          }),
        }),
      );
    });
  });
});
