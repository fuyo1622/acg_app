import { describe, it, expect, vi } from 'vitest';
import {
  mapWithConcurrency,
  rehydrateBackupItems,
  replaceItemsInDb,
  serializeBackupItems,
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
      transaction: vi.fn(async (_mode, _table, callback) => callback()),
    };

    await expect(replaceItemsInDb(fakeDb, [{ id: 1 }])).rejects.toThrow('bulk add failed');
  });
});
