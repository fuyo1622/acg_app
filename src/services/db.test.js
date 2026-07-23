import { describe, expect, it } from 'vitest';
import { DB_NAME, DB_SCHEMA_VERSION, migrateItemToV2 } from './db';

describe('database schema', () => {
  it('publishes one canonical schema version and database name', () => {
    expect(DB_NAME).toBe('acg-merch-db');
    expect(DB_SCHEMA_VERSION).toBe(2);
  });

  it('migrates legacy scalar series and character fields to arrays', () => {
    const legacy = { series: 'Evangelion', character: '', merchandise_type: 'figure' };
    expect(migrateItemToV2(legacy)).toEqual({
      series: ['Evangelion'],
      character: [],
      merchandise_type: 'figure',
    });
  });

  it('preserves version 2 array values', () => {
    const current = { series: ['Evangelion'], character: ['Asuka'] };
    expect(migrateItemToV2(current)).toEqual(current);
  });
});
