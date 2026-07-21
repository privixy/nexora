import { describe, expect, it } from 'vitest';
import { resolveEditorContext } from '../../src/utils/editorContext';
import type { DriverCapabilities } from '../../src/types/plugins';

const multiDbSchemas: DriverCapabilities = {
  multiple_databases: true,
  schemas: true,
};

const multiDbNoSchemas: DriverCapabilities = {
  multiple_databases: true,
  schemas: false,
};

describe('resolveEditorContext', () => {
  it('uses tab database over active database for schema-capable drivers', () => {
    expect(resolveEditorContext({
      tab: { database: 'analytics', schema: 'public' },
      capabilities: multiDbSchemas,
      activeDatabase: 'app',
      activeSchema: 'public',
      selectedDatabases: ['app', 'analytics'],
    })).toEqual({ database: 'analytics', schema: 'public' });
  });

  it('falls back to active database and schema for schema-capable drivers', () => {
    expect(resolveEditorContext({
      tab: null,
      capabilities: multiDbSchemas,
      activeDatabase: 'analytics',
      activeSchema: 'reporting',
      selectedDatabases: ['app', 'analytics'],
    })).toEqual({ database: 'analytics', schema: 'reporting' });
  });

  it('does not treat schema as database when a tab database exists', () => {
    expect(resolveEditorContext({
      tab: { database: 'analytics', schema: 'legacy' },
      capabilities: multiDbNoSchemas,
      activeDatabase: 'app',
      activeSchema: null,
      selectedDatabases: ['app', 'analytics'],
    })).toEqual({ database: 'analytics' });
  });
});
