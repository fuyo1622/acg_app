import { describe, expect, it } from 'vitest';
import { db, DB_NAME, DB_SCHEMA_VERSION, migrateItemToV2 } from './db';

describe('database schema', () => {
  it('publishes one canonical schema version and database name', () => {
    expect(DB_NAME).toBe('acg-merch-db');
    expect(DB_SCHEMA_VERSION).toBe(3);
    expect(db.verno).toBe(DB_SCHEMA_VERSION);
  });

  it('keeps the collection and the wishlist in separate tables', () => {
    expect(db.tables.map(table => table.name).sort()).toEqual(['items', 'wishlist']);
    expect(db.items.schema.indexes.map(index => index.name))
      .toEqual(expect.arrayContaining(['series', 'character', 'merchandise_type', 'created_at']));
    expect(db.wishlist.schema.primKey).toEqual(expect.objectContaining({ keyPath: 'id', auto: true }));
    expect(db.wishlist.schema.indexes.map(index => index.name))
      .toEqual(expect.arrayContaining(['status', 'created_at', 'updated_at']));
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
