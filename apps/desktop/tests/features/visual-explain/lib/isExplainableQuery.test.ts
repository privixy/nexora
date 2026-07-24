import { describe, expect, it } from 'vitest';
import { isExplainableQuery } from '../../../../src/features/visual-explain';

describe('isExplainableQuery', () => {
  it.each([
    'SELECT * FROM users',
    'INSERT INTO users VALUES (1)',
    'UPDATE users SET name = "test"',
    'DELETE FROM users WHERE id = 1',
    'REPLACE INTO users VALUES (1, "a")',
    'WITH cte AS (SELECT 1) SELECT * FROM cte',
    'TABLE users',
    '  SELECT 1',
    'select * from users',
    '-- BEFORE index: full scan\nSELECT * FROM audit_log',
    '/* explain this */ SELECT * FROM users',
    '-- comment\n-- another\nDELETE FROM users WHERE id = 1',
  ])('accepts %s', (query) => expect(isExplainableQuery(query)).toBe(true));

  it.each([
    '',
    '   ',
    '-- comment only',
    'CREATE INDEX idx ON t(col)',
    'CREATE TABLE users (id INT)',
    'DROP TABLE users',
    'ALTER TABLE users ADD COLUMN name TEXT',
    'TRUNCATE TABLE users',
    "GRANT SELECT ON users TO 'user'",
    "REVOKE SELECT ON users FROM 'user'",
    '\n\t  CREATE INDEX idx ON t(col)',
    'create index idx on t(col)',
    '-- setup\nCREATE INDEX idx ON t(col)',
    'malformed input',
  ])('rejects %s', (query) => expect(isExplainableQuery(query)).toBe(false));
});
