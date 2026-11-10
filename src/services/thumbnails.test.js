import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stored: new Map(),
  failures: { read: false, write: false },
  reads: { count: 0 },
  createThumbnail: vi.fn(),
}));

vi.mock('dexie', () => ({
  default: class FakeDexie {
    version() {
      return { stores: () => {} };
    }

    thumbnails = {
      get: async (key) => {
        mocks.reads.count += 1;
        if (mocks.failures.read) throw new Error('No IndexedDB');
        return mocks.stored.get(key);
      },
      put: async (entry) => {
        if (mocks.failures.write) throw new Error('Blobs are not supported here');
        mocks.stored.set(entry.key, entry);
      },
      where: () => ({
        startsWith: prefix => ({
          primaryKeys: async () => [...mocks.stored.keys()].filter(key => key.startsWith(prefix)),
        }),
      }),
      bulkDelete: async (keys) => {
        keys.forEach(key => mocks.stored.delete(key));
      },
    };
  },
}));

vi.mock('../utils/imageUtils', () => ({
  createThumbnail: mocks.createThumbnail,
}));

const cover = new Blob(['a full-size photo'], { type: 'image/webp' });
const small = new Blob(['small'], { type: 'image/jpeg' });

function record(fields = {}) {
  return { id: 7, updated_at: new Date('2026-11-01T00:00:00.000Z'), ...fields };
}

// A fresh copy of the module, as after reopening the app.
const openApp = () => import('./thumbnails');

describe('card thumbnails', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.stored.clear();
    mocks.failures.read = false;
    mocks.failures.write = false;
    mocks.reads.count = 0;
    mocks.createThumbnail.mockReset();
    mocks.createThumbnail.mockResolvedValue(small);
  });

  it('makes a small copy once, and reuses it after the app is reopened', async () => {
    const first = await openApp();
    expect(await first.getCardImage('items', record(), cover)).toBe(small);
    expect(mocks.createThumbnail).toHaveBeenCalledWith(cover, 480);
    expect(mocks.stored.get('items:7').blob).toBe(small);

    vi.resetModules();
    const second = await openApp();
    expect(await second.getCardImage('items', record(), cover)).toBe(small);
    expect(mocks.createThumbnail).toHaveBeenCalledTimes(1);
  });

  it('answers from memory while the app stays open', async () => {
    const { getCardImage } = await openApp();
    await getCardImage('items', record(), cover);
    const readsAfterFirst = mocks.reads.count;

    expect(await getCardImage('items', record(), cover)).toBe(small);
    expect(mocks.reads.count).toBe(readsAfterFirst);
  });

  it('forgets the oldest copies in memory instead of growing without limit', async () => {
    const { getCardImage } = await openApp();
    for (let id = 0; id <= 200; id += 1) await getCardImage('items', record({ id }), cover);
    const reads = mocks.reads.count;

    await getCardImage('items', record({ id: 0 }), cover);

    expect(mocks.reads.count).toBe(reads + 1);
    expect(mocks.createThumbnail).toHaveBeenCalledTimes(201);
  });

  it('makes a new copy after the record is saved again', async () => {
    const { getCardImage } = await openApp();
    await getCardImage('items', record(), cover);
    const newCopy = new Blob(['new'], { type: 'image/jpeg' });
    mocks.createThumbnail.mockResolvedValue(newCopy);

    const saved = record({ updated_at: new Date('2026-11-02T00:00:00.000Z') });

    expect(await getCardImage('items', saved, cover)).toBe(newCopy);
    expect(mocks.stored.get('items:7').blob).toBe(newCopy);
  });

  it('keeps collection items and wishlist entries with the same id apart', async () => {
    const { getCardImage } = await openApp();
    await getCardImage('items', record(), cover);
    await getCardImage('wishlist', record(), cover);

    expect([...mocks.stored.keys()].sort()).toEqual(['items:7', 'wishlist:7']);
  });

  it('shows an already small cover as it is, without storing a copy', async () => {
    mocks.createThumbnail.mockResolvedValue(cover);
    const { getCardImage } = await openApp();

    expect(await getCardImage('items', record(), cover)).toBe(cover);
    expect(mocks.stored.size).toBe(0);
  });

  it('still shows the copy where it cannot be stored or read back', async () => {
    mocks.failures.read = true;
    mocks.failures.write = true;
    const { getCardImage } = await openApp();

    expect(await getCardImage('items', record(), cover)).toBe(small);
  });

  it('decodes one photo at a time, in the order the cards asked', async () => {
    let active = 0;
    let mostActive = 0;
    const order = [];
    mocks.createThumbnail.mockImplementation(async (photo) => {
      active += 1;
      mostActive = Math.max(mostActive, active);
      order.push(photo);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return small;
    });
    const covers = [1, 2, 3, 4].map(number => new Blob([String(number)], { type: 'image/webp' }));
    const { getCardImage } = await openApp();

    await Promise.all(covers.map((photo, id) => getCardImage('items', record({ id }), photo)));

    expect(mostActive).toBe(1);
    expect(order).toEqual(covers);
  });

  it('skips the work for a card that has left the screen', async () => {
    const controller = new AbortController();
    const { getCardImage } = await openApp();

    const pending = getCardImage('items', record(), cover, controller.signal);
    controller.abort();

    expect(await pending).toBeNull();
    expect(mocks.createThumbnail).not.toHaveBeenCalled();
    expect(mocks.stored.size).toBe(0);
  });

  it('removes copies of records that are gone, once per visit and per list', async () => {
    for (const key of ['items:1', 'items:2', 'wishlist:2']) mocks.stored.set(key, { key });
    const { pruneThumbnails } = await openApp();

    await pruneThumbnails('items', [1]);
    expect([...mocks.stored.keys()].sort()).toEqual(['items:1', 'wishlist:2']);

    mocks.stored.set('items:9', { key: 'items:9' });
    await pruneThumbnails('items', [1]);
    expect(mocks.stored.has('items:9')).toBe(true);
  });
});
