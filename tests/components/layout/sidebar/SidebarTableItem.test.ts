import { describe, expect, it } from 'vitest';
import { getSidebarTableContext } from '@/utils/sidebarTableItem';

describe('getSidebarTableContext', () => {
  it('preserves database and schema for multi-database table actions', () => {
    expect(getSidebarTableContext('users', 'analytics', 'public')).toEqual({
      tableName: 'users',
      database: 'analytics',
      schema: 'public',
    });
  });

  it('preserves database for schema-less multi-database table actions', () => {
    expect(getSidebarTableContext('orders', 'shop')).toEqual({
      tableName: 'orders',
      database: 'shop',
      schema: undefined,
    });
  });
});
