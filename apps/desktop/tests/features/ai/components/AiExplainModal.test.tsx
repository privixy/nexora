import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { AiExplainModal } from '../../../../src/features/ai/components/AiExplainModal';

let settings: Record<string, unknown>;
vi.mock('../../../../src/features/settings/hooks/useSettings', () => ({ useSettings: () => ({ settings }) }));
vi.mock('../../../../src/features/settings/hooks/useEditorTheme', () => ({ useEditorTheme: () => ({ id: 'dark' }) }));
vi.mock('../../../../src/shared/ui/Modal', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));
vi.mock('@monaco-editor/react', () => ({ default: () => <div data-testid="editor" /> }));
vi.mock('lucide-react', () => ({
  X: () => null,
  Loader2: () => null,
  BookOpen: () => null,
}));

describe('AiExplainModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings = { aiProvider: 'openai', aiModel: 'gpt-test', language: 'it' };
  });

  it('forwards provider, model, query, and language and renders rejection text', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('explain failed'));
    render(<AiExplainModal isOpen onClose={vi.fn()} query="SELECT 1" />);

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('explain_ai_query', {
      req: {
        provider: 'openai',
        model: 'gpt-test',
        query: 'SELECT 1',
        language: 'Italiano',
      },
    }));
    expect(await screen.findByText('Error: explain failed')).toBeInTheDocument();
  });

  it('shows missing configuration without invoking', async () => {
    settings = { aiProvider: null, aiModel: null, language: 'en' };
    render(<AiExplainModal isOpen onClose={vi.fn()} query="SELECT 1" />);
    expect(await screen.findByText(/AI Provider not configured/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
