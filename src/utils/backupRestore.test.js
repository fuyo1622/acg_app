import { describe, expect, it, vi } from 'vitest';
import { replaceBackupInDb } from './backupUtils';

// A table that records what is stored in it, and a transaction that runs its work at once.
function fakeDb() {
  const table = () => ({
    clear: vi.fn().mockResolvedValue(undefined),
    bulkAdd: vi.fn().mockResolvedValue(undefined),
  });
  const db = { items: table(), wishlist: table(), terms: table() };
  db.transaction = vi.fn(async (_mode, _tables, work) => work());
  return db;
}

// A restored photo: a slice of the backup file it came from, as a restore reads it.
function photoSlice(bytes, fill) {
  const file = new File([new Uint8Array(1000).fill(7), new Uint8Array(bytes).fill(fill)], 'acg-backup.zip');
  return file.slice(1000, 1000 + bytes, 'image/jpeg');
}

const record = (id, ...photos) => ({ id, series: [`Series ${id}`], photos });
const bytesOf = async blob => Array.from(new Uint8Array(await blob.arrayBuffer()));
const storedIds = table => table.bulkAdd.mock.calls.map(([records]) => records.map(stored => stored.id));

describe('restoring a backup', () => {
  it('stores each photo as a copy of itself, not as the slice of the file it came from', async () => {
    const db = fakeDb();
    const slice = photoSlice(300, 4);

    await replaceBackupInDb(db, { items: [record(1, slice)], wishlist: [] });

    const [[[stored]]] = db.items.bulkAdd.mock.calls;
    const [photo] = stored.photos;
    expect(photo).not.toBe(slice);
    expect(photo).toBeInstanceOf(Blob);
    expect(photo.type).toBe('image/jpeg');
    expect(photo.size).toBe(300);
    expect(await bytesOf(photo)).toEqual(await bytesOf(slice));
    expect(stored).toEqual(expect.objectContaining({ id: 1, series: ['Series 1'] }));
  });

  it('stores the records in batches of about the given size of photos, emptying the tables only first', async () => {
    const db = fakeDb();
    const onProgress = vi.fn();
    const items = [1, 2, 3, 4, 5].map(id => record(id, photoSlice(100, id)));

    await replaceBackupInDb(db, { items, wishlist: [] }, { batchBytes: 250, onProgress });

    expect(storedIds(db.items)).toEqual([[1, 2], [3, 4], [5]]);
    expect(db.transaction).toHaveBeenCalledTimes(3);
    expect(db.items.clear).toHaveBeenCalledTimes(1);
    expect(db.wishlist.clear).toHaveBeenCalledTimes(1);
    // Emptied in the first transaction, before its batch is stored.
    expect(db.items.clear.mock.invocationCallOrder[0]).toBeLessThan(db.items.bulkAdd.mock.invocationCallOrder[0]);
    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { done: 2, total: 5 },
      { done: 4, total: 5 },
      { done: 5, total: 5 },
    ]);
  });

  it('keeps a record larger than a batch in a batch of its own', async () => {
    const db = fakeDb();
    const items = [record(1, photoSlice(100, 1)), record(2, photoSlice(400, 2)), record(3, photoSlice(100, 3))];

    await replaceBackupInDb(db, { items, wishlist: [] }, { batchBytes: 250 });

    expect(storedIds(db.items)).toEqual([[1], [2], [3]]);
  });

  it('stores the collection and the wishlist apart, after emptying both', async () => {
    const db = fakeDb();
    const items = [record(1, photoSlice(50, 1)), record(2)];
    const wishlist = [record(3, photoSlice(50, 3)), record(4)];

    await replaceBackupInDb(db, { items, wishlist });

    expect(storedIds(db.items)).toEqual([[1, 2]]);
    expect(storedIds(db.wishlist)).toEqual([[3, 4]]);
    expect(db.transaction).toHaveBeenCalledWith('rw', [db.items, db.wishlist, db.terms], expect.any(Function));
    expect(db.items.clear).toHaveBeenCalledTimes(1);
    expect(db.wishlist.clear).toHaveBeenCalledTimes(1);
    expect(db.wishlist.clear.mock.invocationCallOrder[0]).toBeLessThan(db.items.bulkAdd.mock.invocationCallOrder[0]);
  });

  it('leaves the wishlist alone for a backup made before it existed', async () => {
    const db = fakeDb();

    await replaceBackupInDb(db, { items: [record(1)], wishlist: undefined });

    expect(db.transaction).toHaveBeenCalledWith('rw', [db.items, db.terms], expect.any(Function));
    expect(db.wishlist.clear).not.toHaveBeenCalled();
    expect(db.wishlist.bulkAdd).not.toHaveBeenCalled();
  });

  it('replaces the order of the lists in the first batch, and keeps the default order without one', async () => {
    const db = fakeDb();
    const terms = [{ field: 'series', values: ['Gundam', 'Evangelion'] }];
    const items = [1, 2, 3].map(id => record(id, photoSlice(100, id)));

    await replaceBackupInDb(db, { items, wishlist: [], terms }, { batchBytes: 150 });

    expect(db.terms.clear).toHaveBeenCalledTimes(1);
    expect(db.terms.bulkAdd).toHaveBeenCalledTimes(1);
    expect(db.terms.bulkAdd).toHaveBeenCalledWith(terms);
    expect(db.terms.bulkAdd.mock.invocationCallOrder[0]).toBeLessThan(db.items.bulkAdd.mock.invocationCallOrder[0]);

    const older = fakeDb();
    await replaceBackupInDb(older, { items, wishlist: [] }, { batchBytes: 150 });
    expect(older.terms.clear).toHaveBeenCalledTimes(1);
    expect(older.terms.bulkAdd).not.toHaveBeenCalled();
  });

  it('empties the tables for a backup without records', async () => {
    const db = fakeDb();

    await replaceBackupInDb(db, { items: [], wishlist: [] });

    expect(db.items.clear).toHaveBeenCalledTimes(1);
    expect(db.wishlist.clear).toHaveBeenCalledTimes(1);
    expect(db.items.bulkAdd).not.toHaveBeenCalled();
  });

  it('fails as a whole when the first batch fails, as nothing was changed', async () => {
    const db = fakeDb();
    db.items.bulkAdd.mockRejectedValueOnce(new Error('bulk add failed'));
    const items = [1, 2, 3].map(id => record(id, photoSlice(100, id)));

    const failure = await replaceBackupInDb(db, { items, wishlist: [] }, { batchBytes: 150 }).catch(error => error);

    expect(failure.message).toBe('bulk add failed');
    expect(failure.partial).toBeUndefined();
    expect(db.items.bulkAdd).toHaveBeenCalledTimes(1);
  });

  it('says the backup was restored in part when a later batch fails', async () => {
    const db = fakeDb();
    const cause = new Error('quota exceeded');
    db.items.bulkAdd.mockResolvedValueOnce(undefined).mockRejectedValueOnce(cause);
    const items = [1, 2, 3].map(id => record(id, photoSlice(100, id)));

    const failure = await replaceBackupInDb(db, { items, wishlist: [] }, { batchBytes: 150 }).catch(error => error);

    expect(failure.partial).toBe(true);
    expect(failure.cause).toBe(cause);
    expect(storedIds(db.items)).toEqual([[1], [2]]);
  });
});
