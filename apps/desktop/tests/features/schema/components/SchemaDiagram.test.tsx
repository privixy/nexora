import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SchemaDiagram } from '../../../../src/features/schema/components/SchemaDiagram';
import type { TableSchema } from '../../../../src/types/editor';

type GetSchema = (
  connectionId: string,
  schemaVersion?: number,
  schema?: string,
  database?: string,
) => Promise<TableSchema[]>;

const getSchemaMock = vi.hoisted(() => vi.fn<GetSchema>());

vi.mock('../../../../src/features/editor/hooks/useEditor', () => ({
  useEditor: () => ({ getSchema: getSchemaMock }),
}));

vi.mock('../../../../src/features/settings', () => ({
  DEFAULT_SETTINGS: { erDiagramDefaultLayout: 'LR' },
  useSettings: () => ({ settings: {} }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('lucide-react', () => ({
  Loader2: () => null,
  ArrowLeftRight: () => null,
  ArrowUpDown: () => null,
  Maximize2: () => null,
  Focus: () => null,
}));

const reactFlowMocks = vi.hoisted(() => ({
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  fitView: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
}));

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReactFlow: ({ children }: { children?: ReactNode }) => <div data-testid="react-flow">{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  useNodesState: (initial: unknown[]) => [initial, reactFlowMocks.setNodes, reactFlowMocks.onNodesChange],
  useEdgesState: (initial: unknown[]) => [initial, reactFlowMocks.setEdges, reactFlowMocks.onEdgesChange],
  useReactFlow: () => ({
    fitView: reactFlowMocks.fitView,
    zoomIn: reactFlowMocks.zoomIn,
    zoomOut: reactFlowMocks.zoomOut,
  }),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

const schema: TableSchema[] = [
  {
    name: 'users',
    columns: [
      {
        name: 'id',
        data_type: 'INT',
        is_pk: true,
        is_nullable: false,
        is_auto_increment: false,
      },
    ],
    foreign_keys: [],
  },
];

describe('SchemaDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSchemaMock.mockResolvedValue(schema);
  });

  it('loads the selected database without treating it as schema', async () => {
    render(
      <SchemaDiagram
        connectionId="conn-1"
        refreshTrigger={0}
        database="analytics"
      />,
    );

    await waitFor(() => {
      expect(getSchemaMock).toHaveBeenCalledWith(
        'conn-1',
        undefined,
        undefined,
        'analytics',
      );
    });
  });

  it('keeps database and schema separate when loading PostgreSQL diagrams', async () => {
    render(
      <SchemaDiagram
        connectionId="conn-1"
        refreshTrigger={0}
        database="analytics"
        schema="public"
      />,
    );

    await waitFor(() => {
      expect(getSchemaMock).toHaveBeenCalledWith(
        'conn-1',
        undefined,
        'public',
        'analytics',
      );
    });
  });

  it('reloads with the same database context after refresh', async () => {
    const { rerender } = render(
      <SchemaDiagram
        connectionId="conn-1"
        refreshTrigger={0}
        database="analytics"
      />,
    );

    await waitFor(() => {
      expect(getSchemaMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SchemaDiagram
        connectionId="conn-1"
        refreshTrigger={1}
        database="analytics"
      />,
    );

    await waitFor(() => {
      expect(getSchemaMock).toHaveBeenCalledTimes(2);
    });
    expect(getSchemaMock).toHaveBeenLastCalledWith(
      'conn-1',
      undefined,
      undefined,
      'analytics',
    );
  });
});
