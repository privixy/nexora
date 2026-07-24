import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiDropdownButton } from '../../../../src/features/ai/components/AiDropdownButton';

vi.mock('lucide-react', () => ({
  Sparkles: () => null,
  BookOpen: () => null,
  ChevronUp: () => null,
}));

describe('AiDropdownButton', () => {
  it('selects generate and explain actions and closes the dropdown', () => {
    const onGenerate = vi.fn();
    const onExplain = vi.fn();
    render(<AiDropdownButton onGenerate={onGenerate} onExplain={onExplain} />);

    fireEvent.click(screen.getByTitle('AI'));
    fireEvent.click(screen.getByText('ai.generateSql'));
    expect(onGenerate).toHaveBeenCalledOnce();
    expect(screen.queryByText('ai.explain')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('AI'));
    fireEvent.click(screen.getByText('ai.explain'));
    expect(onExplain).toHaveBeenCalledOnce();
  });

  it('disables explain independently', () => {
    render(<AiDropdownButton onGenerate={vi.fn()} onExplain={vi.fn()} disableExplain />);
    fireEvent.click(screen.getByTitle('AI'));
    expect(screen.getByText('ai.explain').closest('button')).toBeDisabled();
  });
});
