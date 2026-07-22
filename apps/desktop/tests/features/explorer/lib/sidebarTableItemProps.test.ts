import { describe, it, expect } from 'vitest';
import {
  areTableItemPropsEqual,
  buildTableItemSelector,
  type TableItemComparableProps,
} from '@/features/explorer/lib/sidebarTableItem';

const base: TableItemComparableProps = {
  table: { name: 'users' },
  activeTable: null,
  connectionId: 'conn-1',
  driver: 'postgres',
  canManage: true,
  schemaVersion: 0,
  schema: 'public',
};

describe('areTableItemPropsEqual', () => {
  it('treats identical props as equal', () => {
    expect(areTableItemPropsEqual(base, { ...base })).toBe(true);
  });

  it('ignores changes to the global activeTable when this item is not involved', () => {
    // The sidebar passes the same `activeTable` to every item; switching the
    // active table from one *other* table to another must not re-render this item.
    const prev = { ...base, activeTable: 'orders' };
    const next = { ...base, activeTable: 'products' };
    expect(areTableItemPropsEqual(prev, next)).toBe(true);
  });

  it('re-renders the item that becomes active', () => {
    const prev = { ...base, activeTable: 'orders' };
    const next = { ...base, activeTable: 'users' };
    expect(areTableItemPropsEqual(prev, next)).toBe(false);
  });

  it('re-renders the item that loses focus', () => {
    const prev = { ...base, activeTable: 'users' };
    const next = { ...base, activeTable: 'orders' };
    expect(areTableItemPropsEqual(prev, next)).toBe(false);
  });

  it('re-renders when the table name changes', () => {
    expect(
      areTableItemPropsEqual(base, { ...base, table: { name: 'accounts' } }),
    ).toBe(false);
  });

  it.each([
    ['connectionId', { connectionId: 'conn-2' }],
    ['driver', { driver: 'mysql' }],
    ['canManage', { canManage: false }],
    ['schemaVersion', { schemaVersion: 1 }],
    ['schema', { schema: 'analytics' }],
  ])('re-renders when %s changes', (_label, change) => {
    expect(areTableItemPropsEqual(base, { ...base, ...change })).toBe(false);
  });

  it('ignores callback identity (props not included in the comparison)', () => {
    // Extra/unstable props such as inline callbacks are not part of the
    // comparable shape, so two prop sets differing only by them stay equal.
    const prev = { ...base, onTableClick: () => {} } as TableItemComparableProps;
    const next = { ...base, onTableClick: () => {} } as TableItemComparableProps;
    expect(areTableItemPropsEqual(prev, next)).toBe(true);
  });
});

describe('buildTableItemSelector', () => {
  it('matches a table with a database and schema', () => {
    expect(buildTableItemSelector('users', 'app', 'public')).toBe(
      '[data-table-name="users"][data-database="app"][data-schema="public"]',
    );
  });

  it('renders a missing database and schema as empty strings (matches the DOM attributes)', () => {
    expect(buildTableItemSelector('users')).toBe(
      '[data-table-name="users"][data-database=""][data-schema=""]',
    );
    expect(buildTableItemSelector('users', null, null)).toBe(
      '[data-table-name="users"][data-database=""][data-schema=""]',
    );
  });

  it('escapes double quotes and backslashes so the selector stays valid', () => {
    expect(buildTableItemSelector('we"ird', 'db"one', 'sch\\ema')).toBe(
      '[data-table-name="we\\"ird"][data-database="db\\"one"][data-schema="sch\\\\ema"]',
    );
  });
});
