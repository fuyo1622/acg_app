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

// Newly chosen files are compressed; photos already stored as Blobs are kept as they
// are, so editing an item never recompresses its existing photos.
export function preparePhotosForSaving(photos) {
  return mapWithConcurrency(
    photos,
    PHOTO_PROCESSING_CONCURRENCY,
    photo => (photo instanceof File ? compressImage(photo) : photo),
  );
}
