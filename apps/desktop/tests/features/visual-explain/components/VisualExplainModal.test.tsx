import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { VisualExplainModal } from '../../../../src/features/visual-explain/components/VisualExplainModal';

vi.mock('../../../../src/features/settings/hooks/useSettings', () => ({
  useSettings: () => ({ settings: { aiEnabled: false } }),
}));
vi.mock('../../../../src/features/connections', () => ({
  useDatabase: () => ({
    getConnectionData: () => null,
    connections: [],
  }),
}));
vi.mock('../../../../src/features/plugins/hooks/useDrivers', () => ({
  useDrivers: () => ({ allDrivers: [] }),
}));
vi.mock('../../../../src/shared/ui/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));
vi.mock('../../../../src/features/visual-explain/components/VisualExplainView', () => ({
  VisualExplainView: ({ error }: { error: string | null }) => <div>{error}</div>,
}));

const plan = {
  root: { id: 'root' },
  original_query: 'SELECT 1',
  driver: 'sqlite',
  has_analyze_data: false,
  raw_output: null,
};

describe('VisualExplainModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs explain with an explicit null schema and reruns with analyze state', async () => {
    vi.mocked(invoke).mockResolvedValue(plan);

    render(
      <VisualExplainModal
        isOpen
        onClose={vi.fn()}
        query="SELECT 1"
        connectionId="conn-1"
      />,
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('explain_query_plan', {
        connectionId: 'conn-1',
        query: 'SELECT 1',
        analyze: true,
        schema: null,
      });
    });

    const callsBeforeRerun = vi.mocked(invoke).mock.calls.length;
    fireEvent.click(screen.getByText('editor.visualExplain.rerun'));

    await waitFor(() => {
      expect(vi.mocked(invoke).mock.calls.length).toBeGreaterThan(callsBeforeRerun);
    });
  });

  it('shows validation and backend rejection text', async () => {
    const { rerender } = render(
      <VisualExplainModal
        isOpen
        onClose={vi.fn()}
        query="CREATE TABLE users (id INT)"
        connectionId="conn-1"
      />,
    );

    expect(await screen.findByText('editor.visualExplain.notExplainable')).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();

    vi.mocked(invoke).mockRejectedValueOnce(new Error('explain failed'));
    rerender(
      <VisualExplainModal
        isOpen
        onClose={vi.fn()}
        query="SELECT 2"
        connectionId="conn-1"
      />,
    );

    expect(await screen.findByText('Error: explain failed')).toBeInTheDocument();
  });
});
