import { describe, it, expect, vi } from 'vitest';
import {
  BACKUP_DATA_FILE,
  createBackupArchive,
  hasWishlistSection,
  mapWithConcurrency,
  readBackupFile,
  rehydrateBackup,
  rehydrateBackupItems,
  rehydrateWishlistEntries,
  replaceBackupInDb,
  validateBackupPayload,
} from './backupUtils';
import { BACKUP_LIMITS, BACKUP_VERSION } from './constants';
import { createZip } from './zipUtils';

const validPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

describe('validateBackupPayload', () => {
  it('throws when payload format is completely broken', () => {
    expect(() => validateBackupPayload(null, BACKUP_VERSION)).toThrow('Payload is not an object');
    expect(() => validateBackupPayload({ version: 999 }, BACKUP_VERSION)).toThrow('Unsupported backup version: 999');
    expect(() => validateBackupPayload({ version: BACKUP_VERSION }, BACKUP_VERSION)).toThrow('Backup items missing');
  });

  it('accepts unfinished items without a series, character, or type', async () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
        { series: 'Evangelion', character: 'Asuka', notes: '' },
        { series: '', character: '  ', merchandise_type: '', notes: '', photos: [] },
      ],
    };
    expect(validateBackupPayload(payload, BACKUP_VERSION)).toBe(true);

    const restored = await rehydrateBackupItems(payload.items);
    expect(restored.map(item => item.merchandise_type)).toEqual(['', '']);
    expect(restored[1]).toEqual(expect.objectContaining({ series: [], character: [], photos: [] }));
  });

  it('still rejects a type that is not text', () => {
    const payload = { version: BACKUP_VERSION, items: [{ series: 'Evangelion', merchandise_type: 7 }] };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('invalid merchandise_type');
  });

  it('throws when photo is not an explicitly defined string mapping to data:image', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: 'Evangelion', merchandise_type: 'figure', photo: 'bad-data' }
      ]
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('invalid photo Data URL');
  });

  it('rejects non-string values inside series and character arrays', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
        { series: ['Evangelion', 42], character: 'Asuka', merchandise_type: 'figure' },
      ],
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('invalid series');
  });

  it('passes perfectly valid offline serialization footprints natively', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: 'Evangelion', character: 'Asuka', merchandise_type: 'figure', notes: '', photo: validPngDataUrl },
         { series: '', character: 'Rei Ayanami', merchandise_type: 'plush', notes: '', photo: null }
      ]
    };
    expect(validateBackupPayload(payload, BACKUP_VERSION)).toBe(true);
  });

  it('accepts legacy version 1 strings and rehydrates them as arrays', async () => {
    const payload = {
      version: 1,
      items: [
        { series: 'Evangelion', character: 'Asuka', merchandise_type: 'figure', notes: '', photo: null },
      ],
    };

    expect(validateBackupPayload(payload, BACKUP_VERSION)).toBe(true);
    await expect(rehydrateBackupItems(payload.items)).resolves.toEqual([
      expect.objectContaining({ series: ['Evangelion'], character: ['Asuka'] }),
    ]);
  });

  it('rejects files, item counts and field values that exceed import limits', async () => {
    const hugeJson = { size: BACKUP_LIMITS.maxFileBytes + 1, slice: () => new Blob(['{"version":4']) };
    await expect(readBackupFile(hugeJson)).rejects.toThrow('too large');

    const tooManyItems = {
      version: BACKUP_VERSION,
      items: Array.from({ length: BACKUP_LIMITS.maxItems + 1 }, () => ({})),
    };
    expect(() => validateBackupPayload(tooManyItems, BACKUP_VERSION))
      .toThrow('too many items');

    const longNotes = {
      version: BACKUP_VERSION,
      items: [{
        series: 'Evangelion',
        merchandise_type: 'figure',
        notes: 'x'.repeat(BACKUP_LIMITS.maxNotesLength + 1),
      }],
    };
    expect(() => validateBackupPayload(longNotes, BACKUP_VERSION))
      .toThrow('notes length limit');
  });

  it('checks decoded image signatures instead of trusting the declared MIME type', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [{
        series: 'Evangelion',
        merchandise_type: 'figure',
        photo: 'data:image/jpeg;base64,iVBORw0KGgo=',
      }],
    };

    expect(() => validateBackupPayload(payload, BACKUP_VERSION))
      .toThrow('MIME type does not match');
  });

  it('restores the single photo of an older backup as the first of the photos', async () => {
    const [item] = await rehydrateBackupItems([{
      series: 'Evangelion',
      character: [],
      merchandise_type: 'figure',
      photo: validPngDataUrl,
    }]);

    expect(item).not.toHaveProperty('photo');
    expect(item.photos).toHaveLength(1);
    expect(item.photos[0]).toBeInstanceOf(Blob);
    expect(item.photos[0].type).toBe('image/png');
    expect(item.photos[0].size).toBe(8);
  });

  it('accepts several photos per item and restores them in order', async () => {
    const gifDataUrl = `data:image/gif;base64,${btoa('GIF89a01')}`;
    const payload = {
      version: BACKUP_VERSION,
      items: [{ series: ['Evangelion'], merchandise_type: 'figure', photos: [validPngDataUrl, gifDataUrl] }],
    };
    expect(validateBackupPayload(payload, BACKUP_VERSION)).toBe(true);

    const [item] = await rehydrateBackupItems(payload.items);
    expect(item.photos.map(photo => photo.type)).toEqual(['image/png', 'image/gif']);
  });

  it('rejects photo lists that are too long or hold anything but image Data URLs', () => {
    const withPhotos = photos => ({
      version: BACKUP_VERSION,
      items: [{ series: ['Evangelion'], merchandise_type: 'figure', photos }],
    });

    expect(() => validateBackupPayload(
      withPhotos(Array.from({ length: BACKUP_LIMITS.maxPhotosPerRecord + 1 }, () => validPngDataUrl)),
      BACKUP_VERSION,
    )).toThrow('Item at index 0 has invalid photos');
    expect(() => validateBackupPayload(withPhotos(validPngDataUrl), BACKUP_VERSION)).toThrow('invalid photos');
    expect(() => validateBackupPayload(withPhotos([7]), BACKUP_VERSION)).toThrow('invalid photo Data URL');
    expect(() => validateBackupPayload(withPhotos(['bad-data']), BACKUP_VERSION)).toThrow('invalid photo Data URL');
  });

  it('limits mapper concurrency while preserving result order', async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async value => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8]);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });

  it('propagates a replacement transaction failure', async () => {
    const error = new Error('bulk add failed');
    const fakeDb = {
      items: {
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockRejectedValue(error),
      },
      transaction: vi.fn(async (_mode, _tables, callback) => callback()),
    };

    await expect(replaceBackupInDb(fakeDb, { items: [{ id: 1 }] })).rejects.toThrow('bulk add failed');
  });
});

describe('wishlist backups', () => {
  function fakeDb() {
    const table = () => ({
      clear: vi.fn().mockResolvedValue(undefined),
      bulkAdd: vi.fn().mockResolvedValue(undefined),
    });
    const db = { items: table(), wishlist: table() };
    db.transaction = vi.fn(async (_mode, _tables, callback) => callback());
    return db;
  }

  function entry(fields = {}) {
    return {
      id: 1,
      name: 'Asuka figure',
      series: ['Evangelion'],
      character: [],
      merchandise_type: '',
      links: [{ url: 'https://www.amiami.com/item', label: 'AmiAmi' }],
      price: 12800,
      currency: 'JPY',
      shop: 'AmiAmi',
      order_deadline: '2026-10-15',
      release: '2027-03',
      priority: 'high',
      status: 'want',
      notes: '',
      photo: null,
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-02T00:00:00.000Z',
      ...fields,
    };
  }

  function payload(wishlist, version = BACKUP_VERSION) {
    return { version, items: [], wishlist };
  }

  it('accepts a version 3 backup with wishlist entries', () => {
    expect(validateBackupPayload(payload([entry(), entry({ id: 2, name: '', photo: validPngDataUrl })]), BACKUP_VERSION))
      .toBe(true);
    expect(hasWishlistSection(payload([]))).toBe(true);
  });

  it('treats older backups as collection-only, even with a stray wishlist key', () => {
    const older = { version: 2, items: [], wishlist: 'ignored' };

    expect(hasWishlistSection(older)).toBe(false);
    expect(validateBackupPayload(older, BACKUP_VERSION)).toBe(true);
    expect(hasWishlistSection({ version: 3, items: [] })).toBe(false);
  });

  it('refuses links that are not web addresses', () => {
    const planted = entry({ links: [{ url: 'javascript:alert(1)', label: 'Shop' }] });
    expect(() => validateBackupPayload(payload([planted]), BACKUP_VERSION))
      .toThrow('Wishlist entry at index 0 has a link that is not a web address');

    const tooMany = entry({ links: Array.from({ length: 11 }, (_, index) => ({ url: `https://example.com/${index}` })) });
    expect(() => validateBackupPayload(payload([tooMany]), BACKUP_VERSION)).toThrow('invalid links');
  });

  it('rejects malformed wishlist fields', () => {
    const invalid = (fields, message) => expect(
      () => validateBackupPayload(payload([entry(fields)]), BACKUP_VERSION),
    ).toThrow(message);

    invalid({ price: -1 }, 'invalid price');
    invalid({ price: '12800' }, 'invalid price');
    invalid({ currency: 'yen' }, 'invalid currency');
    invalid({ order_deadline: '2026-02-30' }, 'invalid order_deadline');
    invalid({ status: 'bought' }, 'invalid status');
    invalid({ priority: 'urgent' }, 'invalid priority');
    invalid({ name: 'x'.repeat(301) }, 'name length limit');
    invalid({ name: ' ', links: [], photo: null }, 'must have a photo, a name, or a link');
    invalid({ photo: 'data:image/jpeg;base64,iVBORw0KGgo=' }, 'MIME type does not match');
  });

  it('rejects a wishlist section that is not a list or repeats ids', () => {
    expect(() => validateBackupPayload(payload({}), BACKUP_VERSION))
      .toThrow('Backup wishlist has an invalid format');
    expect(() => validateBackupPayload(payload([entry(), entry()]), BACKUP_VERSION))
      .toThrow('Wishlist entry at index 1 has a duplicate id');
  });

  it('round-trips entries, photos and links through a backup archive', async () => {
    const photo = new Blob([Uint8Array.from(atob('iVBORw0KGgo='), character => character.charCodeAt(0))], {
      type: 'image/png',
    });
    const stored = {
      ...entry(),
      photos: [photo, photo],
      created_at: new Date('2026-09-01T00:00:00.000Z'),
      updated_at: new Date('2026-09-02T00:00:00.000Z'),
    };

    const archiveBlob = await createBackupArchive({ items: [], wishlist: [stored] });
    const { payload: backup, archive } = await readBackupFile(new File([archiveBlob], 'acg-backup.zip'));
    expect(backup.wishlist[0]).toEqual(expect.objectContaining({
      name: 'Asuka figure',
      links: [{ url: 'https://www.amiami.com/item', label: 'AmiAmi' }],
      price: 12800,
      currency: 'JPY',
      order_deadline: '2026-10-15',
      created_at: '2026-09-01T00:00:00.000Z',
      photos: ['photos/wishlist/0001-1.png', 'photos/wishlist/0001-2.png'],
    }));
    expect(validateBackupPayload(backup, BACKUP_VERSION, archive)).toBe(true);

    const [restored] = await rehydrateWishlistEntries(backup.wishlist, archive);
    expect(restored).toEqual(expect.objectContaining({
      id: 1,
      name: 'Asuka figure',
      price: 12800,
      priority: 'high',
      created_at: new Date('2026-09-01T00:00:00.000Z'),
    }));
    expect(restored.photos).toHaveLength(2);
    expect(restored.photos[0]).toBeInstanceOf(Blob);
    expect(restored.photos[0].type).toBe('image/png');
  });

  it('restores only known fields and dates entries that had none', async () => {
    const [restored] = await rehydrateWishlistEntries([{ name: 'Rei plush', extra: 'dropped' }]);

    expect(restored).not.toHaveProperty('extra');
    expect(restored).not.toHaveProperty('id');
    expect(restored.created_at).toBeInstanceOf(Date);
    expect(restored).toEqual(expect.objectContaining({ links: [], status: 'want', currency: 'TWD' }));
  });

  it('rehydrates the wishlist only when the backup has one', async () => {
    await expect(rehydrateBackup({ version: 2, items: [] }))
      .resolves.toEqual({ items: [], wishlist: undefined });
    await expect(rehydrateBackup(payload([entry()])))
      .resolves.toEqual({ items: [], wishlist: [expect.objectContaining({ name: 'Asuka figure' })] });
  });

  it('replaces both tables in one transaction when the backup has a wishlist', async () => {
    const db = fakeDb();
    await replaceBackupInDb(db, { items: [{ id: 1 }], wishlist: [{ id: 2 }] });

    expect(db.transaction).toHaveBeenCalledWith('rw', [db.items, db.wishlist], expect.any(Function));
    expect(db.items.bulkAdd).toHaveBeenCalledWith([{ id: 1 }]);
    expect(db.wishlist.clear).toHaveBeenCalled();
    expect(db.wishlist.bulkAdd).toHaveBeenCalledWith([{ id: 2 }]);
  });

  it('leaves the wishlist untouched when an older backup is imported', async () => {
    const db = fakeDb();
    await replaceBackupInDb(db, { items: [{ id: 1 }], wishlist: undefined });

    expect(db.transaction).toHaveBeenCalledWith('rw', [db.items], expect.any(Function));
    expect(db.wishlist.clear).not.toHaveBeenCalled();
    expect(db.wishlist.bulkAdd).not.toHaveBeenCalled();
  });
});

describe('backup archives (format 5)', () => {
  const pngBytes = () => Uint8Array.from(atob('iVBORw0KGgo='), character => character.charCodeAt(0));
  const png = () => new Blob([pngBytes()], { type: 'image/png' });
  const gif = () => new Blob(['GIF89a01'], { type: 'image/gif' });

  async function roundTrip(sections) {
    const archive = await createBackupArchive(sections);
    return readBackupFile(new File([archive], 'acg-backup.zip', { type: 'application/zip' }));
  }

  it('stores the records in backup.json and each photo as an image file', async () => {
    const { payload, archive } = await roundTrip({
      items: [
        { id: 1, series: ['Evangelion', 'Rebuild'], character: ['Asuka', 'Rei'], merchandise_type: 'figure', notes: '盒損', photos: [png(), gif()] },
        { id: 2, series: ['B'], merchandise_type: 'figure', photo: png() },
      ],
      wishlist: [{ id: 3, name: 'Rei plush', links: [], photos: [png()] }],
    });

    expect(payload.version).toBe(BACKUP_VERSION);
    expect(archive.names[0]).toBe(BACKUP_DATA_FILE);
    expect(payload.items[0]).toEqual(expect.objectContaining({
      series: ['Evangelion', 'Rebuild'],
      character: ['Asuka', 'Rei'],
      notes: '盒損',
      photos: ['photos/items/0001-1.png', 'photos/items/0001-2.gif'],
    }));
    // A record from before version 4 keeps its single photo as the first of its photos.
    expect(payload.items[1].photos).toEqual(['photos/items/0002-1.png']);
    expect(payload.items[1]).not.toHaveProperty('photo');
    expect(payload.wishlist[0].photos).toEqual(['photos/wishlist/0001-1.png']);
    expect(archive.size('photos/items/0001-2.gif')).toBe(8);
  });

  it('round-trips collection and wishlist photos in order', async () => {
    const { payload, archive } = await roundTrip({
      items: [{ id: 1, series: ['A'], merchandise_type: 'figure', photos: [png(), gif()] }],
      wishlist: [{ id: 2, name: 'Rei plush', links: [], photos: [gif()] }],
    });
    expect(validateBackupPayload(payload, BACKUP_VERSION, archive)).toBe(true);

    const restored = await rehydrateBackup(payload, archive);
    expect(restored.items[0].photos.map(photo => photo.type)).toEqual(['image/png', 'image/gif']);
    expect(new Uint8Array(await restored.items[0].photos[0].arrayBuffer())).toEqual(pngBytes());
    expect(restored.wishlist[0]).toEqual(expect.objectContaining({ id: 2, name: 'Rei plush' }));
    expect(await restored.wishlist[0].photos[0].text()).toBe('GIF89a01');
  });

  it('refuses a photo whose contents do not match its file type', async () => {
    const archive = await createZip([
      {
        name: BACKUP_DATA_FILE,
        data: JSON.stringify({ version: 5, items: [{ series: ['A'], photos: ['photos/items/0001-1.png'] }] }),
      },
      { name: 'photos/items/0001-1.png', data: '<script>alert(1)</script>' },
    ]);
    const { payload, archive: opened } = await readBackupFile(new File([archive], 'planted.zip'));

    expect(validateBackupPayload(payload, BACKUP_VERSION, opened)).toBe(true);
    await expect(rehydrateBackup(payload, opened)).rejects.toThrow('Photo type does not match its contents');
  });

  it('refuses photos that are missing from the archive or outside its photos folder', async () => {
    const archive = await createZip([
      { name: BACKUP_DATA_FILE, data: '{}' },
      { name: 'photos/items/0001-1.png', data: png() },
      { name: 'notes.png', data: png() },
    ]);
    const { archive: opened } = await readBackupFile(new File([archive], 'backup.zip'));
    const withPhotos = photos => ({ version: 5, items: [{ series: ['A'], photos }] });

    expect(validateBackupPayload(withPhotos(['photos/items/0001-1.png']), BACKUP_VERSION, opened)).toBe(true);
    expect(() => validateBackupPayload(withPhotos(['photos/items/0002-1.png']), BACKUP_VERSION, opened))
      .toThrow('refers to a missing photo');
    expect(() => validateBackupPayload(withPhotos(['notes.png']), BACKUP_VERSION, opened))
      .toThrow('refers to a missing photo');
    expect(() => validateBackupPayload(withPhotos(['data:image/png;base64,iVBORw0KGgo=']), BACKUP_VERSION, opened))
      .toThrow('refers to a missing photo');
  });

  it('refuses an archive without its backup data', async () => {
    const archive = await createZip([{ name: 'photos/items/0001-1.png', data: png() }]);

    await expect(readBackupFile(new File([archive], 'backup.zip'))).rejects.toThrow('Backup data is missing');
  });

  it('will not write a photo type that it could not restore', async () => {
    const heic = new Blob(['heic'], { type: 'image/heic' });

    await expect(createBackupArchive({ items: [{ id: 1, series: ['A'], photos: [heic] }], wishlist: [] }))
      .rejects.toThrow('Unsupported photo type: image/heic');
  });

  it('still reads a JSON backup from an earlier version', async () => {
    const json = JSON.stringify({ version: 4, items: [{ series: ['A'], photos: [validPngDataUrl] }], wishlist: [] });
    const { payload, archive } = await readBackupFile(new File([json], 'acg-backup.json', { type: 'application/json' }));

    expect(archive).toBeNull();
    expect(validateBackupPayload(payload, BACKUP_VERSION, archive)).toBe(true);
    const restored = await rehydrateBackup(payload, archive);
    expect(restored.items[0].photos[0].type).toBe('image/png');
  });
});
