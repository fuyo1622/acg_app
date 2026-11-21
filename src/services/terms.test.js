import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { deleteTerm, renameTerm } from './terms';

vi.mock('./db', () => ({ db: {} }));

// A table that keeps its records by id, and a transaction that runs its work at once.
function fakeTable(records = []) {
  const rows = new Map(records.map(record => [record.id ?? record.field, record]));
  return {
    rows,
    filter: vi.fn(test => ({ toArray: async () => [...rows.values()].filter(test) })),
    bulkGet: vi.fn(async ids => ids.map(id => rows.get(id))),
    bulkPut: vi.fn(async changed => changed.forEach(record => rows.set(record.id, record))),
    put: vi.fn(async record => rows.set(record.id ?? record.field, record)),
  };
}

const photo = (size, fill) => new Blob([new Uint8Array(size).fill(fill)], { type: 'image/jpeg' });
const bytesOf = async blob => Array.from(new Uint8Array(await blob.arrayBuffer()));
const earlier = new Date('2026-11-01T10:00:00Z');
const record = (id, series, ...photos) => ({ id, series, character: [`Character ${id}`], photos, updated_at: earlier });
const storedIds = table => table.bulkPut.mock.calls.map(([records]) => records.map(stored => stored.id));

beforeEach(() => {
  db.items = fakeTable();
  db.wishlist = fakeTable();
  db.terms = fakeTable();
  db.transaction = vi.fn(async (_mode, _table, work) => work());
});

describe('deleting a name from a list', () => {
  it('takes it off every record that uses it, with copies of their photos, and then off the list', async () => {
    const macross = photo(300, 1);
    const gundam = photo(200, 2);
    db.items = fakeTable([record(1, ['Macross'], macross), record(2, ['Gundam'], gundam), record(3, ['Macross', 'Gundam'])]);
    db.wishlist = fakeTable([record(1, ['Macross'])]);

    await deleteTerm('series', ['Macross', 'Gundam'], 'Macross');

    expect(storedIds(db.items)).toEqual([[1, 3]]);
    const first = db.items.rows.get(1);
    expect(first.series).toEqual([]);
    expect(first.updated_at.getTime()).toBeGreaterThan(earlier.getTime());
    expect(first.photos[0]).not.toBe(macross);
    expect(await bytesOf(first.photos[0])).toEqual(await bytesOf(macross));
    expect(db.items.rows.get(2).photos[0]).toBe(gundam);
    expect(db.items.rows.get(3).series).toEqual(['Gundam']);
    expect(db.wishlist.rows.get(1).series).toEqual([]);

    expect(db.terms.put).toHaveBeenCalledWith({ field: 'series', values: ['Gundam'] });
    expect(db.terms.put.mock.invocationCallOrder[0])
      .toBeGreaterThan(db.wishlist.bulkPut.mock.invocationCallOrder[0]);
  });

  it('changes the records in batches of about the given size of photos', async () => {
    db.items = fakeTable([1, 2, 3, 4, 5].map(id => record(id, ['Macross'], photo(100, id))));

    await deleteTerm('series', ['Macross'], 'Macross', { batchBytes: 250 });

    expect(storedIds(db.items)).toEqual([[1, 2], [3, 4], [5]]);
    expect(db.transaction).toHaveBeenCalledTimes(3);
  });

  it('stops, leaving the list as it was, when a record was changed in the meantime', async () => {
    db.items = fakeTable([record(1, ['Macross'], photo(100, 1))]);
    db.items.bulkGet.mockResolvedValueOnce([{ ...record(1, ['Macross']), updated_at: new Date() }]);

    await expect(deleteTerm('series', ['Macross'], 'Macross')).rejects.toThrow('changed');

    expect(db.items.bulkPut).not.toHaveBeenCalled();
    expect(db.terms.put).not.toHaveBeenCalled();
  });
});

describe('renaming a name in a list', () => {
  it('renames it in every record that uses it and in the list', async () => {
    db.items = fakeTable([record(1, ['EVA'], photo(100, 1)), record(2, ['Gundam'])]);

    await renameTerm('series', ['EVA', 'Gundam'], 'EVA', 'Evangelion');

    expect(storedIds(db.items)).toEqual([[1]]);
    expect(db.items.rows.get(1).series).toEqual(['Evangelion']);
    expect(db.terms.put).toHaveBeenCalledWith({ field: 'series', values: ['Evangelion', 'Gundam'] });
  });
});
