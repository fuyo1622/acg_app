import { mapWithConcurrency } from './concurrencyUtils';
import { PHOTO_PROCESSING_CONCURRENCY } from './constants';
import { compressImage } from './imageUtils';

// Records keep their photos in `photos`, cover first. Records saved before schema
// version 4, and backups made before format version 4, have at most one `photo`.
export function getPhotos(record) {
  if (Array.isArray(record?.photos)) return record.photos.filter(Boolean);
  return record?.photo ? [record.photo] : [];
}

export function getCoverPhoto(record) {
  return getPhotos(record)[0] ?? null;
}

export function isImageFile(file) {
  return typeof file?.type === 'string' && file.type.startsWith('image/');
}

// Safari (WebKit) can store a photo restored from a backup archive by an older version as a
// copy of the whole archive file: the photo still says its own size, but reads as more bytes
// than that. The repair before every backup takes such photos out again (see backupUtils).
export function isDetachedPhoto(photo) {
  return photo instanceof Blob && new Blob([photo]).size !== photo.size;
}

// Safari (WebKit) cannot read a stored photo that is saved again as it was read until the app
// is opened again, so meanwhile its item showed "?" for the photo. A copy made from the
// photo's bytes reads at once, so a stored photo is saved again as such a copy. A photo that
// cannot be read now is kept as it is (it reads again once the app is opened again), and so
// is one stored as a copy of a whole backup, for the repair.
export async function copyStoredPhoto(photo) {
  if (!(photo instanceof Blob) || isDetachedPhoto(photo)) return photo;
  try {
    return new Blob([await photo.arrayBuffer()], { type: photo.type });
  } catch {
    return photo;
  }
}

// Newly chosen files are compressed. Photos already stored keep their quality, so editing an
// item never recompresses them, and are saved as copies of themselves (see copyStoredPhoto).
export function preparePhotosForSaving(photos) {
  return mapWithConcurrency(
    photos,
    PHOTO_PROCESSING_CONCURRENCY,
    photo => (photo instanceof File ? compressImage(photo) : copyStoredPhoto(photo)),
  );
}
