import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { ExplainAiAnalysis } from '../../../../src/features/visual-explain/components/visual-explain/ExplainAiAnalysis';

let settings: Record<string, unknown>;

vi.mock('../../../../src/features/settings/hooks/useSettings', () => ({
  useSettings: () => ({ settings }),
}));

const plan = {
  root: { id: 'root' },
  original_query: 'SELECT * FROM users',
  driver: 'postgres',
  has_analyze_data: true,
  raw_output: 'Seq Scan on users',
};

describe('ExplainAiAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings = {
      aiProvider: 'openai',
      aiModel: 'gpt-test',
      language: 'it',
    };
  });

  it('automatically analyzes raw output with exact provider, model, query, and language', async () => {
    vi.mocked(invoke).mockResolvedValue('Use an index');

    render(<ExplainAiAnalysis plan={plan as never} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('analyze_ai_explain_plan', {
        req: {
          provider: 'openai',
          model: 'gpt-test',
          query: 'SQL Query:\nSELECT * FROM users\n\nEXPLAIN output:\nSeq Scan on users',
          language: 'Italiano',
        },
      });
    });
    expect(await screen.findByText('Use an index')).toBeInTheDocument();
  });

  it('shows missing provider and rejection text', async () => {
    settings = { aiProvider: null, aiModel: null, language: 'en' };
    const { unmount } = render(<ExplainAiAnalysis plan={plan as never} />);
    expect(screen.getAllByText('editor.visualExplain.aiConfigRequired').length).toBeGreaterThan(0);
    expect(invoke).not.toHaveBeenCalled();
    unmount();

    settings = { aiProvider: 'openai', aiModel: null, language: 'en' };
    vi.mocked(invoke).mockRejectedValueOnce(new Error('analysis failed'));
    render(<ExplainAiAnalysis plan={plan as never} />);
    expect(await screen.findByText('Error: analysis failed')).toBeInTheDocument();
  });
});
