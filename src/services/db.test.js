import { describe, expect, it } from 'vitest';
import { db, DB_NAME, DB_SCHEMA_VERSION, migrateItemToV2, migrateRecordToV4 } from './db';

describe('database schema', () => {
  it('publishes one canonical schema version and database name', () => {
    expect(DB_NAME).toBe('acg-merch-db');
    expect(DB_SCHEMA_VERSION).toBe(4);
    expect(db.verno).toBe(DB_SCHEMA_VERSION);
  });

  it('turns the single photo of an older record into the first of its photos', () => {
    const photo = new Blob(['photo'], { type: 'image/png' });

    expect(migrateRecordToV4({ series: ['Evangelion'], photo })).toEqual({ series: ['Evangelion'], photos: [photo] });
    expect(migrateRecordToV4({ series: ['Evangelion'], photo: null })).toEqual({ series: ['Evangelion'], photos: [] });
    expect(migrateRecordToV4({ name: 'Asuka figure' })).toEqual({ name: 'Asuka figure', photos: [] });
  });

  it('leaves records that already hold a photo list unchanged', () => {
    const photos = [new Blob(['a'], { type: 'image/png' }), new Blob(['b'], { type: 'image/png' })];
    expect(migrateRecordToV4({ photos })).toEqual({ photos });
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
