import { describe, expect, it } from 'vitest';
import { formatWindowTitle } from '../../src/features/connections/lib/windowTitle';

describe('formatWindowTitle', () => {
  it('capitalizes the app name in the base title', () => {
    expect(formatWindowTitle()).toBe('Nexora');
  });

  it('capitalizes the app name in a detailed title', () => {
    expect(formatWindowTitle('Local MySQL (testdb)')).toBe('Nexora - Local MySQL (testdb)');
  });
});
