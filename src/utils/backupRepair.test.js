import { describe, expect, it, vi } from 'vitest';
import {
  createBackupParts,
  isDetachedPhoto,
  readBackupFiles,
  recoverDetachedPhoto,
  repairDetachedPhotos,
} from './backupUtils';

const pngSignature = () => Uint8Array.from(atob('iVBORw0KGgo='), character => character.charCodeAt(0));

// A PNG-looking photo of `size` bytes, its bytes after the signature set by `fill`.
function photoOfSize(size, fill = 0) {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set(pngSignature());
  return new Blob([bytes], { type: 'image/png' });
}

const item = (id, ...photos) => ({ id, series: [`Series ${id}`], merchandise_type: 'figure', photos });

async function backupArchive(sections) {
  const { value } = await createBackupParts(sections, { partBytes: Infinity }).next();
  return value.blob;
}

// What Safari can leave in its database for a photo restored from `archive`: a copy of the
// whole archive that still says it is the photo.
function storedAsArchiveCopy(archive, photo) {
  const copy = new Blob([archive], { type: photo.type });
  Object.defineProperty(copy, 'size', { value: photo.size });
  return copy;
}

const bytesOf = async blob => Array.from(new Uint8Array(await blob.arrayBuffer()));

describe('photos stored as copies of a whole backup archive', () => {
  it('are told apart from photos stored as themselves', async () => {
    const photo = photoOfSize(300);
    const archive = await backupArchive({ items: [item(1, photo)], wishlist: [] });

    expect(isDetachedPhoto(photo)).toBe(false);
    expect(isDetachedPhoto(storedAsArchiveCopy(archive, photo))).toBe(true);
    expect(isDetachedPhoto('not a photo')).toBe(false);
  });

  it('are taken out of their archive copy by their record and place', async () => {
    // Two photos of the same size, so only the record and place tell them apart.
    const first = photoOfSize(300, 1);
    const second = photoOfSize(300, 2);
    const archive = await backupArchive({ items: [item(7, first, second)], wishlist: [] });

    const recovered = await recoverDetachedPhoto(storedAsArchiveCopy(archive, second), { section: 'items', id: 7, index: 1 });

    expect(recovered.size).toBe(300);
    expect(recovered.type).toBe('image/png');
    expect(isDetachedPhoto(recovered)).toBe(false);
    expect(await bytesOf(recovered)).toEqual(await bytesOf(second));
  });

  it('are found by their size when the record does not tell, but not guessed between equal sizes', async () => {
    const small = photoOfSize(200, 3);
    const large = photoOfSize(400, 4);
    const twin = photoOfSize(400, 5);
    const archive = await backupArchive({ items: [item(1, small), item(2, large), item(3, twin)], wishlist: [] });

    expect(await bytesOf(await recoverDetachedPhoto(storedAsArchiveCopy(archive, small)))).toEqual(await bytesOf(small));
    expect(await recoverDetachedPhoto(storedAsArchiveCopy(archive, large))).toBeNull();
    expect(await bytesOf(await recoverDetachedPhoto(storedAsArchiveCopy(archive, large), { section: 'items', id: 2, index: 0 })))
      .toEqual(await bytesOf(large));
  });

  it('are not replaced by anything that is not the photo', async () => {
    const archive = await backupArchive({ items: [item(1, photoOfSize(300))], wishlist: [] });

    // No photo of that size in the archive, and a copy of something that is not an archive.
    expect(await recoverDetachedPhoto(storedAsArchiveCopy(archive, photoOfSize(123)))).toBeNull();
    expect(await recoverDetachedPhoto(storedAsArchiveCopy(new Blob(['not an archive at all']), photoOfSize(20)))).toBeNull();
  });

  it('are repaired in the database one record at a time, leaving the rest as it is', async () => {
    const restored = photoOfSize(300, 6);
    const kept = photoOfSize(250, 7);
    const archive = await backupArchive({ items: [item(1, restored)], wishlist: [] });
    const lost = storedAsArchiveCopy(archive, photoOfSize(999));
    const table = records => ({ toArray: vi.fn(async () => records), put: vi.fn(async () => 1) });
    const db = {
      items: table([
        { id: 1, photos: [storedAsArchiveCopy(archive, restored), kept] },
        { id: 2, photos: [kept] },
        { id: 3, photos: [lost] },
      ]),
      wishlist: table([]),
    };
    const onProgress = vi.fn();

    const result = await repairDetachedPhotos(db, { onProgress });

    expect(result).toEqual({ repaired: 1, failed: 1 });
    expect(db.items.put).toHaveBeenCalledTimes(1);
    const [{ id, photos }] = db.items.put.mock.calls[0];
    expect(id).toBe(1);
    expect(await bytesOf(photos[0])).toEqual(await bytesOf(restored));
    expect(photos[1]).toBe(kept);
    expect(onProgress).toHaveBeenCalledWith({ section: 'items', done: 0, total: 3 });
  });

  it('can be left out of a new backup when they cannot be read, instead of filling it', async () => {
    const photos = [photoOfSize(100), photoOfSize(100)];
    const onPhotoDone = vi.fn();
    const parts = createBackupParts({ items: [item(1, ...photos)], wishlist: [] }, {
      preparePhoto: async photo => (photo === photos[1] ? null : photo),
      onPhotoDone,
    });
    const { value } = await parts.next();

    const [{ payload, archive }] = await readBackupFiles([new File([value.blob], 'backup.zip')]);
    expect(payload.items[0].photos).toEqual(['photos/items/0001-1.png']);
    expect(archive.size('photos/items/0001-1.png')).toBe(100);
    expect(onPhotoDone).toHaveBeenCalledTimes(2);
  });
});
