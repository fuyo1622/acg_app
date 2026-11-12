import { describe, expect, it, vi } from 'vitest';
import {
  BACKUP_DATA_FILE,
  BackupPartsError,
  createBackupParts,
  readBackupFiles,
  rehydrateBackupFiles,
  validateBackupFiles,
  validateBackupPayload,
} from './backupUtils';
import { BACKUP_VERSION } from './constants';
import { createZip } from './zipUtils';

const pngSignature = () => Uint8Array.from(atob('iVBORw0KGgo='), character => character.charCodeAt(0));

// A PNG-looking photo of exactly `size` bytes. Parts only count bytes.
function photoOfSize(size) {
  const bytes = new Uint8Array(size);
  bytes.set(pngSignature());
  return new Blob([bytes], { type: 'image/png' });
}

const item = (id, ...photos) => ({ id, series: [`Series ${id}`], merchandise_type: 'figure', photos });
const entry = (id, ...photos) => ({ id, name: `Entry ${id}`, links: [], photos });

async function collectParts(sections, options) {
  const parts = [];
  for await (const part of createBackupParts(sections, options)) parts.push(part);
  return parts;
}

const asFiles = parts => parts.map(part => new File([part.blob], `acg-backup-part${part.number}.zip`, {
  type: 'application/zip',
}));

// Parts of items 1, 2, and 3 with wishlist entry 4, which has no photo.
async function threeParts() {
  return asFiles(await collectParts({
    items: [item(1, photoOfSize(100)), item(2, photoOfSize(100)), item(3, photoOfSize(100))],
    wishlist: [entry(4)],
  }, { partBytes: 150 }));
}

// A part written by hand, to test what a restore does with damaged or tampered parts.
async function handMadePart(payload) {
  const blob = await createZip([{ name: BACKUP_DATA_FILE, data: JSON.stringify(payload) }]);
  return new File([blob], 'acg-backup-part.zip', { type: 'application/zip' });
}

describe('backups in parts (format 6)', () => {
  it('puts whole records into parts of about the given size, and the totals into the last', async () => {
    const parts = await collectParts({
      items: [item(1, photoOfSize(100)), item(2, photoOfSize(100)), item(3, photoOfSize(100))],
      wishlist: [entry(4, photoOfSize(100))],
    }, { partBytes: 250 });

    expect(parts.map(({ number, last }) => [number, last])).toEqual([[1, false], [2, true]]);
    const [first, second] = (await readBackupFiles(asFiles(parts))).map(({ payload }) => payload);
    expect(first.version).toBe(BACKUP_VERSION);
    expect(first.items.map(record => record.id)).toEqual([1, 2]);
    expect(first.wishlist).toEqual([]);
    expect(first.part).toEqual({ backup: expect.stringMatching(/^[\w-]{8,64}$/), number: 1, last: false });
    expect(second.items.map(record => record.id)).toEqual([3]);
    expect(second.wishlist.map(record => record.id)).toEqual([4]);
    expect(second.part).toEqual({ backup: first.part.backup, number: 2, last: true, parts: 2, items: 3, wishlist: 1 });
    // Each part numbers the photos of its own records.
    expect(second.items[0].photos).toEqual(['photos/items/0001-1.png']);
  });

  it('makes one part when everything fits', async () => {
    const parts = await collectParts({ items: [item(1, photoOfSize(100))], wishlist: [entry(2)] });

    expect(parts).toHaveLength(1);
    const [{ payload }] = await readBackupFiles(asFiles(parts));
    expect(payload.part).toEqual(expect.objectContaining({ number: 1, last: true, parts: 1, items: 1, wishlist: 1 }));
  });

  it('gives a record larger than a part a part of its own', async () => {
    const parts = await collectParts({
      items: [item(1, photoOfSize(100)), item(2, photoOfSize(200), photoOfSize(200)), item(3, photoOfSize(100))],
      wishlist: [],
    }, { partBytes: 250 });

    const opened = await readBackupFiles(asFiles(parts));
    expect(opened.map(({ payload }) => payload.items.map(record => record.id))).toEqual([[1], [2], [3]]);
  });

  it('counts each photo as it will be stored, after it is made smaller', async () => {
    const preparePhoto = vi.fn(async () => photoOfSize(10));
    const onPhotoDone = vi.fn();

    const parts = await collectParts({
      items: [item(1, photoOfSize(100), photoOfSize(100)), item(2, photoOfSize(100))],
      wishlist: [entry(3, photoOfSize(100))],
    }, { partBytes: 250, preparePhoto, onPhotoDone });

    expect(preparePhoto).toHaveBeenCalledTimes(4);
    expect(onPhotoDone).toHaveBeenCalledTimes(4);
    expect(parts).toHaveLength(1);
    const [{ archive }] = await readBackupFiles(asFiles(parts));
    expect(archive.size('photos/items/0001-2.png')).toBe(10);
  });

  describe('a part that could not be saved', () => {
    // Drives the parts the way the app does: `answer(part)` says what to pass to `next()`
    // after each part; `undefined` means it was saved. Returns the parts that were saved.
    async function saveParts(sections, options, answer) {
      const parts = createBackupParts(sections, options);
      const saved = [];
      let step = await parts.next();
      while (!step.done) {
        const request = answer(step.value);
        if (!request) saved.push(step.value);
        step = await parts.next(request);
      }
      return saved;
    }

    const restore = async parts => {
      const opened = await readBackupFiles(asFiles(parts));
      validateBackupFiles(opened, BACKUP_VERSION);
      return rehydrateBackupFiles(opened);
    };

    const sixItems = () => ({ items: [1, 2, 3, 4, 5, 6].map(id => item(id, photoOfSize(100))), wishlist: [entry(7)] });

    it('is made again as smaller parts from its own number on, and later parts keep the smaller size', async () => {
      let failed = false;
      const saved = await saveParts(sixItems(), { partBytes: 300 }, (part) => {
        if (part.number !== 1 || failed) return undefined;
        failed = true;
        return { partBytes: 150 };
      });

      const opened = await readBackupFiles(asFiles(saved));
      expect(opened.map(({ payload }) => payload.items.map(record => record.id))).toEqual([[1], [2], [3], [4], [5], [6]]);
      expect(opened.map(({ payload }) => payload.part.number)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(opened.at(-1).payload.part).toEqual(expect.objectContaining({ last: true, parts: 6, items: 6, wishlist: 1 }));
      const restored = await restore(saved);
      expect(restored.items.map(record => record.id)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(restored.wishlist.map(record => record.id)).toEqual([7]);
    });

    it('is made again more than once, and only the new last part carries the totals', async () => {
      // Everything fits in one part; it fails at 1,000 bytes and again at 400.
      const tries = [];
      const saved = await saveParts(sixItems(), { partBytes: 1000 }, (part) => {
        tries.push(part.number);
        if (tries.length === 1) return { partBytes: 400 };
        if (tries.length === 2) return { partBytes: 200 };
        return undefined;
      });

      const opened = await readBackupFiles(asFiles(saved));
      expect(opened.map(({ payload }) => payload.items.map(record => record.id))).toEqual([[1, 2], [3, 4], [5, 6]]);
      expect(opened.map(({ payload }) => payload.part.last)).toEqual([false, false, true]);
      expect(opened.at(-1).payload.part).toEqual(expect.objectContaining({ parts: 3, items: 6, wishlist: 1 }));
      expect(tries).toEqual([1, 1, 1, 2, 3]);
      expect((await restore(saved)).items).toHaveLength(6);
    });

    it('is offered again as it is when one record is already larger than the smaller size', async () => {
      const sections = { items: [item(1, photoOfSize(200), photoOfSize(200))], wishlist: [] };
      let asked = 0;
      const saved = await saveParts(sections, { partBytes: 1000 }, () => (asked++ === 0 ? { partBytes: 100 } : undefined));

      expect(asked).toBe(2);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toEqual(expect.objectContaining({ number: 1, last: true }));
      expect((await restore(saved)).items.map(record => record.id)).toEqual([1]);
    });

    it('does not prepare its photos again', async () => {
      const preparePhoto = vi.fn(async photo => photo);
      let failed = false;
      await saveParts(sixItems(), { partBytes: 300, preparePhoto }, (part) => {
        if (part.number !== 1 || failed) return undefined;
        failed = true;
        return { partBytes: 150 };
      });

      expect(preparePhoto).toHaveBeenCalledTimes(6);
    });

    it('makes an empty backup again as one empty last part', async () => {
      let asked = 0;
      const saved = await saveParts({ items: [], wishlist: [] }, {}, () => (asked++ === 0 ? { partBytes: 1 } : undefined));

      expect(saved).toEqual([expect.objectContaining({ number: 1, last: true })]);
      const [{ payload }] = await readBackupFiles(asFiles(saved));
      expect(payload.part).toEqual(expect.objectContaining({ parts: 1, items: 0, wishlist: 0 }));
    });
  });

  it('restores every record of every part, whatever order the files come in', async () => {
    const files = (await threeParts()).reverse();

    const opened = await readBackupFiles(files);
    expect(opened.map(({ payload }) => payload.part.number)).toEqual([1, 2, 3]);
    expect(validateBackupFiles(opened, BACKUP_VERSION)).toBe(true);

    const restored = await rehydrateBackupFiles(opened);
    expect(restored.items.map(record => record.id)).toEqual([1, 2, 3]);
    expect(restored.wishlist.map(record => record.id)).toEqual([4]);
    expect(restored.items[2].photos[0]).toBeInstanceOf(Blob);
    expect(restored.items[2].photos[0].size).toBe(100);
  });

  it('says which parts are missing', async () => {
    const [first, , last] = await threeParts();

    await expect(readBackupFiles([first, last])).rejects.toMatchObject({
      name: 'BackupPartsError',
      code: 'missingParts',
      missing: [2],
      total: 3,
    });
  });

  it('says when the last part is missing, since only it knows how many there are', async () => {
    const [first, second] = await threeParts();

    await expect(readBackupFiles([first, second])).rejects.toMatchObject({ code: 'missingParts', missing: [], total: null });
  });

  it('refuses parts of different backups, a part chosen twice, and several separate backups', async () => {
    const [first] = await threeParts();
    const [, otherSecond, otherLast] = await threeParts();
    const json = (version = 4) => new File([JSON.stringify({ version, items: [], wishlist: [] })], 'old.json');

    await expect(readBackupFiles([first, otherSecond, otherLast])).rejects.toMatchObject({ code: 'mixedBackups' });
    await expect(readBackupFiles([first, first])).rejects.toMatchObject({ code: 'repeatedParts', number: 1 });
    await expect(readBackupFiles([json(), json()])).rejects.toMatchObject({ code: 'severalBackups' });
    await expect(readBackupFiles([json(), first])).rejects.toBeInstanceOf(BackupPartsError);
  });

  it('refuses parts that do not add up to the backup the last part describes', async () => {
    const part = (number, last, items) => ({
      version: BACKUP_VERSION,
      items,
      wishlist: [],
      part: last
        ? { backup: 'backup-0001', number, last: true, parts: number, items: 2, wishlist: 0 }
        : { backup: 'backup-0001', number, last: false },
    });

    const short = await readBackupFiles([await handMadePart(part(1, true, [item(1)]))]);
    expect(() => validateBackupFiles(short, BACKUP_VERSION)).toThrow('Backup parts do not add up');

    const repeated = await readBackupFiles([
      await handMadePart(part(1, false, [item(1)])),
      await handMadePart(part(2, true, [item(1)])),
    ]);
    expect(() => validateBackupFiles(repeated, BACKUP_VERSION)).toThrow('Backup parts repeat an item');

    const whole = await readBackupFiles([
      await handMadePart(part(1, false, [item(1)])),
      await handMadePart(part(2, true, [item(2)])),
    ]);
    expect(validateBackupFiles(whole, BACKUP_VERSION)).toBe(true);
  });

  it('rejects malformed part information', () => {
    const payload = part => ({ version: BACKUP_VERSION, items: [], wishlist: [], part });

    expect(() => validateBackupPayload(payload({ backup: 'x', number: 1, last: true }), BACKUP_VERSION))
      .toThrow('Backup part information is invalid');
    expect(() => validateBackupPayload(payload({ backup: 'backup-0001', number: 0, last: false }), BACKUP_VERSION))
      .toThrow('Backup part information is invalid');
    expect(() => validateBackupPayload(payload({ backup: 'backup-0001', number: 2, last: true, parts: 3, items: 0, wishlist: 0 }), BACKUP_VERSION))
      .toThrow('Backup part information is invalid');
    expect(() => validateBackupPayload({ ...payload({ backup: 'backup-0001', number: 1, last: false }), version: 5 }, BACKUP_VERSION))
      .toThrow('Backup part information is invalid');
  });

  it('keeps a photo that could not be made smaller, even one over 10 MB', async () => {
    const fullSize = photoOfSize(12 * 1024 * 1024);
    const files = asFiles(await collectParts({ items: [item(1, fullSize)], wishlist: [] }, {
      preparePhoto: async photo => photo,
    }));

    const opened = await readBackupFiles(files);
    expect(validateBackupFiles(opened, BACKUP_VERSION)).toBe(true);
    const [restored] = (await rehydrateBackupFiles(opened)).items;
    expect(restored.photos[0].size).toBe(12 * 1024 * 1024);
  });

  it('backs up and restores a collection of more than 2,000 items', async () => {
    const items = Array.from({ length: 2500 }, (_, index) => item(index + 1));
    const files = asFiles(await collectParts({ items, wishlist: [] }));

    const opened = await readBackupFiles(files);
    expect(validateBackupFiles(opened, BACKUP_VERSION)).toBe(true);
    expect((await rehydrateBackupFiles(opened)).items).toHaveLength(2500);
  });

  it('still restores one backup file made before parts existed', async () => {
    const oldArchive = await handMadePart({ version: 5, items: [item(1)], wishlist: [] });

    const opened = await readBackupFiles([oldArchive]);
    expect(opened).toHaveLength(1);
    expect(validateBackupFiles(opened, BACKUP_VERSION)).toBe(true);
    expect((await rehydrateBackupFiles(opened)).items.map(record => record.id)).toEqual([1]);
  });
});
