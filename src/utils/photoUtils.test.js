import { describe, expect, it, vi } from 'vitest';
import { compressImage } from './imageUtils';
import { copyStoredPhoto, isDetachedPhoto, preparePhotosForSaving } from './photoUtils';

vi.mock('./imageUtils', () => ({
  compressImage: vi.fn(async file => new Blob([`compressed ${file.name}`], { type: 'image/jpeg' })),
}));

const bytesOf = async blob => Array.from(new Uint8Array(await blob.arrayBuffer()));
const storedPhoto = (bytes, type = 'image/jpeg') => new Blob([Uint8Array.from(bytes)], { type });

// What Safari can leave in its database for a photo an older version restored: a copy of the
// whole backup that still says it is the photo.
function storedAsBackupCopy(photo) {
  const copy = new Blob([new Uint8Array(photo.size * 10)], { type: photo.type });
  Object.defineProperty(copy, 'size', { value: photo.size });
  return copy;
}

describe('saving a stored photo again', () => {
  it('saves it as a copy of its bytes, of the same type', async () => {
    const stored = storedPhoto([1, 2, 3, 4], 'image/webp');

    const copy = await copyStoredPhoto(stored);

    expect(copy).not.toBe(stored);
    expect(copy).toBeInstanceOf(Blob);
    expect(copy.type).toBe('image/webp');
    expect(await bytesOf(copy)).toEqual([1, 2, 3, 4]);
  });

  it('keeps a photo that cannot be read now as it is', async () => {
    const unreadable = storedPhoto([1, 2, 3]);
    unreadable.arrayBuffer = () => Promise.reject(new DOMException('The object is in an invalid state.', 'InvalidStateError'));

    expect(await copyStoredPhoto(unreadable)).toBe(unreadable);
  });

  it('keeps a photo stored as a copy of a whole backup as it is, for the repair', async () => {
    const damaged = storedAsBackupCopy(storedPhoto([1, 2, 3]));
    expect(isDetachedPhoto(damaged)).toBe(true);

    expect(await copyStoredPhoto(damaged)).toBe(damaged);
  });

  it('leaves anything that is not a photo alone', async () => {
    expect(await copyStoredPhoto(null)).toBeNull();
    expect(await copyStoredPhoto('photo')).toBe('photo');
  });
});

describe('preparing the photos of a form for saving', () => {
  it('compresses newly chosen files and saves stored photos as copies, in order', async () => {
    const chosen = new File([new Uint8Array(5)], 'IMG_1.JPG', { type: 'image/jpeg' });
    const stored = storedPhoto([9, 8, 7], 'image/png');

    const [first, second] = await preparePhotosForSaving([stored, chosen]);

    expect(second.type).toBe('image/jpeg');
    expect(await second.text()).toBe('compressed IMG_1.JPG');
    expect(compressImage).toHaveBeenCalledWith(chosen);
    expect(first).not.toBe(stored);
    expect(first.type).toBe('image/png');
    expect(await bytesOf(first)).toEqual([9, 8, 7]);
  });
});
