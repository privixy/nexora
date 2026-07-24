import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useTaskManager } from '../../../../src/features/tasks/hooks/useTaskManager';

const process = {
  plugin_id: 'plugin-1',
  plugin_name: 'Plugin One',
  pid: 1,
  cpu_percent: 1,
  memory_bytes: 2,
  disk_read_bytes: 3,
  disk_write_bytes: 4,
  status: 'running',
  children: [],
};
const stats = { total_memory_bytes: 100, used_memory_bytes: 20 };

describe('useTaskManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === 'get_process_list') return Promise.resolve([process]);
      if (command === 'get_system_stats') return Promise.resolve(stats);
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads concurrently, retains data during refresh, polls, and cleans up', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { result, unmount } = renderHook(() => useTaskManager());

    expect(invoke).toHaveBeenNthCalledWith(1, 'get_process_list');
    expect(invoke).toHaveBeenNthCalledWith(2, 'get_system_stats');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.processes).toHaveLength(1);

    await act(async () => result.current.refresh());
    expect(result.current.processes).toHaveLength(1);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('orders kill and restart actions before refresh and exposes rejection text', async () => {
    const order: string[] = [];
    vi.mocked(invoke).mockImplementation(async (command) => {
      order.push(command);
      if (command === 'get_process_list') return [process];
      if (command === 'get_system_stats') return stats;
      return undefined;
    });
    const { result } = renderHook(() => useTaskManager());
    await waitFor(() => expect(result.current.loading).toBe(false));
    order.length = 0;

    await act(async () => result.current.killProcess('plugin-1'));
    expect(order).toEqual(['kill_plugin_process', 'get_process_list', 'get_system_stats']);

    order.length = 0;
    await act(async () => result.current.restartProcess('plugin-1'));
    expect(order).toEqual(['disable_plugin', 'enable_plugin', 'get_process_list', 'get_system_stats']);

    vi.mocked(invoke).mockImplementationOnce(async (command) => {
      if (command === 'kill_plugin_process') throw new Error('kill failed');
      return undefined;
    });
    await act(async () => result.current.killProcess('plugin-1'));
    expect(result.current.error).toBe('kill failed');
  });
});
