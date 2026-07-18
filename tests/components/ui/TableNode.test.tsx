import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NodeProps } from '@xyflow/react';
import {
  TableNodeComponent,
  type TableNode,
  type TableNodeData,
} from '../../../src/components/ui/TableNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: {
    Left: 'left',
    Right: 'right',
  },
}));

describe('TableNodeComponent', () => {
  it('lets users select columns for generated visual queries', () => {
    const onColumnCheck = vi.fn();
    const data: TableNodeData = {
      label: 'users',
      columns: [{ name: 'id', type: 'INT' }],
      selectedColumns: {},
      columnAggregations: {},
      columnAliases: {},
      onColumnCheck,
      onColumnAggregation: vi.fn(),
      onColumnAlias: vi.fn(),
    };

    const props = { data } as NodeProps<TableNode>;

    render(<TableNodeComponent {...props} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onColumnCheck).toHaveBeenCalledWith('id', true);
  });
});
