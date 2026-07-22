import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DatabaseProvider } from '../../src/contexts/DatabaseProvider';
import { useDatabase } from '../../src/hooks/useDatabase';
import type { DatabaseData, SchemaData } from '../../src/contexts/DatabaseContext';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
vi.mock('../../src/utils/autocomplete', () => ({ clearAutocompleteCache: vi.fn() }));
vi.mock('../../src/features/settings/hooks/useSettings', () => ({
  useSettings: () => ({ settings: { showNativeTitlebar: false, queryTimeout: 30 } }),
}));

describe('DatabaseProvider context tuples', () => {
  it('keeps the previous database visible while loading a newly activated database and invokes the exact context tuple', async () => {
    const pendingLoads: Array<{ command: string; args: unknown; resolve: (value: unknown) => void }> = [];
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === 'get_connections') {
        return Promise.resolve([{ id: 'conn-pg', name: 'Warehouse', params: { driver: 'postgres', database: ['app', 'analytics'] } }]);
      }
      if (cmd === 'test_connection') return Promise.resolve('Connection successful!');
      if (cmd === 'get_driver_manifest') {
        return Promise.resolve({ id: 'postgres', name: 'PostgreSQL', version: '1.0.0', capabilities: { schemas: true, multiple_databases: true, materialized_views: true } });
      }
      if (cmd === 'get_schemas') return Promise.resolve(['public']);
      if (cmd === 'get_selected_schemas') return Promise.resolve(['public']);
      if (cmd === 'get_schema_preference') return Promise.resolve('public');
      if (cmd === 'get_tables' || cmd === 'get_views' || cmd === 'get_materialized_views' || cmd === 'get_routines' || cmd === 'get_triggers') {
        const request = { command: cmd, args, resolve: (_value: unknown) => {} };
        const promise = new Promise<unknown>((resolve) => {
          request.resolve = resolve;
        });
        pendingLoads.push(request);
        return promise;
      }
      if (cmd === 'register_active_connection') return Promise.resolve(undefined);
      if (cmd === 'set_window_title') return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(DatabaseProvider, null, children);
    const { result } = renderHook(() => useDatabase(), { wrapper });

    await act(async () => {
      const connectPromise = result.current.connect('conn-pg');
      await waitFor(() => expect(pendingLoads).toHaveLength(5));
      pendingLoads.splice(0).forEach((load) => load.resolve(load.command === 'get_tables' ? [{ name: 'users' }] : []));
      await connectPromise;
    });

    expect(result.current.activeDatabase).toBe('app');
    expect(result.current.databaseDataMap.app?.schemaDataMap?.public?.tables).toEqual([{ name: 'users' }]);

    act(() => {
      result.current.setActiveDatabaseContext('analytics');
    });

    await waitFor(() => expect(result.current.activeDatabase).toBe('analytics'));
    expect(result.current.schemas).toEqual(['public']);
    expect(result.current.schemaDataMap.public?.tables).toEqual([{ name: 'users' }]);
    expect(pendingLoads.map((load) => load.args)).toEqual(expect.arrayContaining([{ connectionId: 'conn-pg', database: 'analytics', schema: 'public' }]));

    await act(async () => {
      pendingLoads.splice(0).forEach((load) => load.resolve(load.command === 'get_tables' ? [{ name: 'events' }] : []));
    });

    await waitFor(() => {
      expect(result.current.databaseDataMap.analytics?.schemaDataMap?.public?.tables).toEqual([{ name: 'events' }]);
    });
  });

  it('passes the exact context tuple when activating a schema table after a stale previous selection', async () => {
    const previousSchema: SchemaData = { tables: [{ name: 'users' }], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true };
    const analyticsSchema: SchemaData = { tables: [{ name: 'events' }], views: [], routines: [], triggers: [], isLoading: false, isLoaded: true };
    const appData: DatabaseData = {
      tables: [],
      views: [],
      routines: [],
      triggers: [],
      isLoading: false,
      isLoaded: true,
      schemas: ['public'],
      schemaDataMap: { public: previousSchema },
      activeSchema: 'public',
      selectedSchemas: ['public'],
      needsSchemaSelection: false,
    };
    const analyticsData: DatabaseData = {
      ...appData,
      schemaDataMap: { reporting: analyticsSchema },
      activeSchema: 'reporting',
      selectedSchemas: ['reporting'],
    };

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_connections') return Promise.resolve([{ id: 'conn-pg', name: 'Warehouse', params: { driver: 'postgres', database: ['app', 'analytics'] } }]);
      if (cmd === 'test_connection') return Promise.resolve('Connection successful!');
      if (cmd === 'get_driver_manifest') return Promise.resolve({ id: 'postgres', name: 'PostgreSQL', version: '1.0.0', capabilities: { schemas: true, multiple_databases: true } });
      if (cmd === 'set_schema_preference') return Promise.resolve(undefined);
      if (cmd === 'register_active_connection') return Promise.resolve(undefined);
      if (cmd === 'set_window_title') return Promise.resolve(undefined);
      return Promise.resolve([]);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(DatabaseProvider, null, children);
    const { result } = renderHook(() => useDatabase(), { wrapper });

    await act(async () => {
      await result.current.connect('conn-pg');
    });

    act(() => {
      result.current.loadDatabaseData('app', 'conn-pg', true, {
        ...result.current.connectionDataMap['conn-pg'],
        databaseDataMap: { app: appData, analytics: analyticsData },
      });
    });
    act(() => {
      result.current.setActiveTableContext('events', 'analytics', 'reporting');
    });

    expect(result.current.activeDatabase).toBe('analytics');
    expect(result.current.activeSchema).toBe('reporting');
    expect(result.current.activeTable).toBe('events');
    expect(invoke).toHaveBeenCalledWith('set_schema_preference', { connectionId: 'conn-pg', schema: 'reporting' });
  });
});
