import { describe, it, expect, vi } from 'vitest';
import {
  buildBackupPayload,
  estimateBackupBytes,
  exceedsBackupSizeLimit,
  hasWishlistSection,
  mapWithConcurrency,
  rehydrateBackup,
  rehydrateBackupItems,
  rehydrateWishlistEntries,
  replaceBackupInDb,
  serializeBackupItems,
  serializeWishlistEntries,
  validateBackupFile,
  validateBackupPayload,
} from './backupUtils';
import { BACKUP_LIMITS, BACKUP_VERSION } from './constants';

const validPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

describe('validateBackupPayload', () => {
  it('throws when payload format is completely broken', () => {
    expect(() => validateBackupPayload(null, BACKUP_VERSION)).toThrow('Payload is not an object');
    expect(() => validateBackupPayload({ version: 999 }, BACKUP_VERSION)).toThrow('Unsupported backup version: 999');
    expect(() => validateBackupPayload({ version: BACKUP_VERSION }, BACKUP_VERSION)).toThrow('Backup items missing');
  });

  it('throws on items containing missing merchandise_type', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: 'Evangelion', character: 'Asuka', notes: '' } // missing merchandise_type
      ]
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('missing merchandise_type');
  });

  it('throws on items entirely missing both series and character fields natively', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: '', character: '  ', merchandise_type: 'figure', notes: '' }
      ]
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('must have at least one of series or character');
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

  it('serializes multiple series and characters as arrays', async () => {
    const serialized = await serializeBackupItems([{
      id: 1,
      series: ['Evangelion', 'Rebuild of Evangelion'],
      character: ['Asuka', 'Rei'],
      merchandise_type: 'figure',
    }]);

    expect(serialized[0]).toEqual(expect.objectContaining({
      series: ['Evangelion', 'Rebuild of Evangelion'],
      character: ['Asuka', 'Rei'],
    }));
  });

  it('rejects files, item counts and field values that exceed import limits', () => {
    expect(() => validateBackupFile({ size: BACKUP_LIMITS.maxFileBytes + 1 }))
      .toThrow('too large');

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

  it('rehydrates valid images into typed blobs', async () => {
    const [item] = await rehydrateBackupItems([{
      series: 'Evangelion',
      character: [],
      merchandise_type: 'figure',
      photo: validPngDataUrl,
    }]);

    expect(item.photo).toBeInstanceOf(Blob);
    expect(item.photo.type).toBe('image/png');
    expect(item.photo.size).toBe(8);
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

  it('round-trips entries, photos and links through serialization', async () => {
    const photo = new Blob([Uint8Array.from(atob('iVBORw0KGgo='), character => character.charCodeAt(0))], {
      type: 'image/png',
    });
    const stored = {
      ...entry(),
      photo,
      created_at: new Date('2026-09-01T00:00:00.000Z'),
      updated_at: new Date('2026-09-02T00:00:00.000Z'),
    };

    const [serialized] = await serializeWishlistEntries([stored]);
    expect(serialized).toEqual(expect.objectContaining({
      name: 'Asuka figure',
      links: [{ url: 'https://www.amiami.com/item', label: 'AmiAmi' }],
      price: 12800,
      currency: 'JPY',
      order_deadline: '2026-10-15',
      created_at: '2026-09-01T00:00:00.000Z',
      photo: validPngDataUrl,
    }));

    const backup = buildBackupPayload({ items: [], wishlist: [serialized] }, BACKUP_VERSION);
    expect(validateBackupPayload(JSON.parse(JSON.stringify(backup)), BACKUP_VERSION)).toBe(true);

    const [restored] = await rehydrateWishlistEntries([serialized]);
    expect(restored).toEqual(expect.objectContaining({
      id: 1,
      name: 'Asuka figure',
      price: 12800,
      priority: 'high',
      created_at: new Date('2026-09-01T00:00:00.000Z'),
    }));
    expect(restored.photo).toBeInstanceOf(Blob);
    expect(restored.photo.type).toBe('image/png');
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

describe('backup size estimation', () => {
  function itemWithPhoto(photoBytes) {
    const photo = new Blob(['photo'], { type: 'image/webp' });
    Object.defineProperty(photo, 'size', { value: photoBytes });
    return { id: 1, series: ['Series'], character: ['Character'], merchandise_type: 'figure', photo };
  }

  it('returns zero for missing or empty sections', () => {
    expect(estimateBackupBytes()).toBe(0);
    expect(estimateBackupBytes({ items: [], wishlist: [] })).toBe(0);
  });

  it('counts Base64 expansion of photos', () => {
    const withoutPhoto = estimateBackupBytes({ items: [{ ...itemWithPhoto(0), photo: null }] });
    const withPhoto = estimateBackupBytes({ items: [itemWithPhoto(3 * 1024 * 1024)] });

    expect(withPhoto - withoutPhoto).toBeGreaterThan(4 * 1024 * 1024);
  });

  it('counts multi-byte notes as their encoded length', () => {
    const ascii = estimateBackupBytes({ items: [{ series: ['S'], notes: 'aaa' }] });
    const chinese = estimateBackupBytes({ items: [{ series: ['S'], notes: '公仔盒' }] });

    expect(chinese).toBe(ascii + 6);
  });

  it('reports collections that would exceed the import file limit', () => {
    const smallCollection = { items: [itemWithPhoto(1024)] };
    const largeCollection = {
      items: Array.from({ length: 8 }, () => itemWithPhoto(8 * 1024 * 1024)),
    };

    expect(exceedsBackupSizeLimit(smallCollection)).toBe(false);
    expect(estimateBackupBytes(largeCollection)).toBeGreaterThan(BACKUP_LIMITS.maxFileBytes);
    expect(exceedsBackupSizeLimit(largeCollection)).toBe(true);
  });

  it('counts wishlist screenshots toward the same file limit', () => {
    const screenshots = Array.from({ length: 5 }, () => itemWithPhoto(8 * 1024 * 1024));
    const collection = Array.from({ length: 4 }, () => itemWithPhoto(8 * 1024 * 1024));

    expect(exceedsBackupSizeLimit({ items: collection })).toBe(false);
    expect(exceedsBackupSizeLimit({ items: collection, wishlist: screenshots })).toBe(true);
  });
});
