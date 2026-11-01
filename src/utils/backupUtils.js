import { toValueArray } from './valueUtils';
import { isWebUrl } from './linkUtils';
import { mapWithConcurrency } from './concurrencyUtils';
import { getPhotos } from './photoUtils';
import { createWishlistEntry, isDateKey } from './wishlistUtils';
import { createZip, isZip, readZip } from './zipUtils';
import {
  BACKUP_CONCURRENCY,
  BACKUP_LIMITS,
  BACKUP_VERSION,
  DEFAULT_WISHLIST_CURRENCY,
  WISHLIST_BACKUP_VERSION,
  WISHLIST_LIMITS,
  WISHLIST_PRIORITIES,
  WISHLIST_STATUSES,
} from './constants';

export { mapWithConcurrency };

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const WISHLIST_SUBJECT = 'Wishlist entry';

export const BACKUP_DATA_FILE = 'backup.json';
const PHOTO_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const PHOTO_TYPES = Object.fromEntries(Object.entries(PHOTO_EXTENSIONS).map(([type, extension]) => [extension, type]));
const ARCHIVE_PHOTO_PATTERN = /^photos\/[\w/-]+\.(png|jpg|webp|gif)$/;

function dataUrlToBytes(dataUrl) {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) throw new Error('Invalid photo Data URL');

  const [, mimeType, base64] = match;
  if (base64.length === 0 || base64.length % 4 !== 0) {
    throw new Error('Invalid photo encoding');
  }

  let decoded;
  try {
    decoded = atob(base64);
  } catch {
    throw new Error('Invalid photo encoding');
  }

  const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
  if (bytes.byteLength === 0 || bytes.byteLength > BACKUP_LIMITS.maxPhotoBytes) {
    throw new Error('Invalid photo size');
  }

  return { mimeType, bytes };
}

function hasMatchingImageSignature(mimeType, bytes) {
  if (mimeType === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  if (mimeType === 'image/gif') {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    return header === 'GIF87a' || header === 'GIF89a';
  }
  return false;
}

export function decodeImageDataUrl(dataUrl) {
  const decoded = dataUrlToBytes(dataUrl);
  if (!hasMatchingImageSignature(decoded.mimeType, decoded.bytes)) {
    throw new Error('Photo MIME type does not match its contents');
  }
  return decoded;
}

function validateText(value, label, maxLength, index, { required = false, subject = 'Item' } = {}) {
  if (typeof value !== 'string') {
    if (required && (value === undefined || value === null)) {
      throw new Error(`${subject} at index ${index} is missing ${label}`);
    }
    throw new Error(`${subject} at index ${index} has invalid ${label}`);
  }
  if (required && !value.trim()) {
    throw new Error(`${subject} at index ${index} is missing ${label}`);
  }
  if (value.length > maxLength) {
    throw new Error(`${subject} at index ${index} exceeds ${label} length limit`);
  }
}

function validateValues(value, label, index, subject = 'Item') {
  if (value === undefined) return;
  const rawValues = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(rawValues) || !rawValues.every(entry => typeof entry === 'string')) {
    throw new Error(`${subject} at index ${index} has invalid ${label}`);
  }
  if (rawValues.length > BACKUP_LIMITS.maxValuesPerField) {
    throw new Error(`${subject} at index ${index} has too many ${label} values`);
  }
  rawValues.forEach(entry => validateText(
    entry,
    label,
    BACKUP_LIMITS.maxValueLength,
    index,
    { subject },
  ));
}

function validateRecordId(record, index, ids, subject) {
  if (record.id === undefined) return;
  if (!Number.isInteger(record.id) || record.id <= 0) {
    throw new Error(`${subject} at index ${index} has an invalid id`);
  }
  if (ids.has(record.id)) throw new Error(`${subject} at index ${index} has a duplicate id`);
  ids.add(record.id);
}

function validateTimestamps(record, index, subject) {
  for (const field of ['created_at', 'updated_at']) {
    if (record[field] && Number.isNaN(Date.parse(record[field]))) {
      throw new Error(`${subject} at index ${index} has invalid ${field} date`);
    }
  }
}

function validatePhoto(photo, index, subject) {
  if (photo === null || photo === undefined) return;
  if (typeof photo !== 'string') {
    throw new Error(`${subject} at index ${index} contains invalid photo Data URL`);
  }
  try {
    decodeImageDataUrl(photo);
  } catch (error) {
    throw new Error(`${subject} at index ${index} contains invalid photo Data URL: ${error.message}`);
  }
}

// Format 5 stores each photo as a file in the backup archive, format 4 stores `photos` as
// Data URLs, cover first, and earlier formats store at most one `photo`.
function validatePhotos(record, index, subject, archive) {
  if (archive) {
    if (!Array.isArray(record.photos) || record.photos.length > BACKUP_LIMITS.maxPhotosPerRecord) {
      throw new Error(`${subject} at index ${index} has invalid photos`);
    }
    for (const path of record.photos) {
      if (typeof path !== 'string' || !ARCHIVE_PHOTO_PATTERN.test(path) || !archive.has(path)) {
        throw new Error(`${subject} at index ${index} refers to a missing photo`);
      }
      const size = archive.size(path);
      if (!(size > 0 && size <= BACKUP_LIMITS.maxPhotoBytes)) {
        throw new Error(`${subject} at index ${index} has a photo of invalid size`);
      }
    }
    return;
  }

  if (record.photos === undefined) {
    validatePhoto(record.photo, index, subject);
    return;
  }
  if (!Array.isArray(record.photos) || record.photos.length > BACKUP_LIMITS.maxPhotosPerRecord) {
    throw new Error(`${subject} at index ${index} has invalid photos`);
  }
  for (const photo of record.photos) {
    if (typeof photo !== 'string') {
      throw new Error(`${subject} at index ${index} contains invalid photo Data URL`);
    }
    validatePhoto(photo, index, subject);
  }
}

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function validateItem(item, index, ids, archive) {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`Item at index ${index} is invalid`);
  }

  validateRecordId(item, index, ids, 'Item');
  validateValues(item.series, 'series', index);
  validateValues(item.character, 'character', index);

  // A series or character and a type are not required: an item without them is saved as
  // needing details, the way an album import leaves it.
  validateText(item.merchandise_type ?? '', 'merchandise_type', BACKUP_LIMITS.maxTypeLength, index);
  validateText(item.notes ?? '', 'notes', BACKUP_LIMITS.maxNotesLength, index);
  validateTimestamps(item, index, 'Item');
  validatePhotos(item, index, 'Item', archive);
}

// Links render as anchors, so a backup may only carry the same web addresses the form
// accepts. A crafted file must not be able to plant a javascript: link.
function validateLinks(links, index) {
  if (links === undefined) return;
  if (!Array.isArray(links) || links.length > WISHLIST_LIMITS.maxLinks) {
    throw new Error(`${WISHLIST_SUBJECT} at index ${index} has invalid links`);
  }

  for (const link of links) {
    if (typeof link !== 'object' || link === null || !isWebUrl(link.url)) {
      throw new Error(`${WISHLIST_SUBJECT} at index ${index} has a link that is not a web address`);
    }
    validateText(link.label ?? '', 'link label', WISHLIST_LIMITS.maxLinkLabelLength, index, {
      subject: WISHLIST_SUBJECT,
    });
  }
}

function validateChoice(value, choices, label, index) {
  if (value !== undefined && !choices.includes(value)) {
    throw new Error(`${WISHLIST_SUBJECT} at index ${index} has invalid ${label}`);
  }
}

function validateWishlistEntry(entry, index, ids, archive) {
  const subject = WISHLIST_SUBJECT;
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${subject} at index ${index} is invalid`);
  }

  validateRecordId(entry, index, ids, subject);
  validateText(entry.name ?? '', 'name', WISHLIST_LIMITS.maxNameLength, index, { subject });
  validateValues(entry.series, 'series', index, subject);
  validateValues(entry.character, 'character', index, subject);
  validateText(entry.merchandise_type ?? '', 'merchandise_type', BACKUP_LIMITS.maxTypeLength, index, {
    subject,
  });
  validateLinks(entry.links, index);

  const { price } = entry;
  if (!isBlank(price) && !(
    typeof price === 'number' && Number.isFinite(price) && price >= 0 && price <= WISHLIST_LIMITS.maxPrice
  )) {
    throw new Error(`${subject} at index ${index} has an invalid price`);
  }
  if (!isBlank(entry.currency) && !CURRENCY_CODE_PATTERN.test(entry.currency)) {
    throw new Error(`${subject} at index ${index} has an invalid currency`);
  }
  if (!isBlank(entry.order_deadline) && !isDateKey(entry.order_deadline)) {
    throw new Error(`${subject} at index ${index} has an invalid order_deadline`);
  }

  validateText(entry.shop ?? '', 'shop', WISHLIST_LIMITS.maxShopLength, index, { subject });
  validateText(entry.release ?? '', 'release', WISHLIST_LIMITS.maxReleaseLength, index, { subject });
  validateChoice(entry.priority, WISHLIST_PRIORITIES, 'priority', index);
  validateChoice(entry.status, WISHLIST_STATUSES, 'status', index);
  validateText(entry.notes ?? '', 'notes', BACKUP_LIMITS.maxNotesLength, index, { subject });
  validateTimestamps(entry, index, subject);
  validatePhotos(entry, index, subject, archive);

  const hasName = typeof entry.name === 'string' && entry.name.trim() !== '';
  if (getPhotos(entry).length === 0 && !hasName && !(entry.links?.length > 0)) {
    throw new Error(`${subject} at index ${index} must have a photo, a name, or a link`);
  }
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function itemMetadata(item) {
  return {
    id: item.id,
    series: toValueArray(item.series),
    character: toValueArray(item.character),
    merchandise_type: item.merchandise_type || '',
    notes: item.notes || '',
    created_at: toIsoString(item.created_at),
    updated_at: toIsoString(item.updated_at),
  };
}

function wishlistMetadata(entry) {
  return {
    id: entry.id,
    name: entry.name || '',
    series: toValueArray(entry.series),
    character: toValueArray(entry.character),
    merchandise_type: entry.merchandise_type || '',
    links: (entry.links ?? []).map(link => ({ url: link.url, label: link.label || '' })),
    price: typeof entry.price === 'number' && Number.isFinite(entry.price) ? entry.price : null,
    currency: entry.currency || DEFAULT_WISHLIST_CURRENCY,
    shop: entry.shop || '',
    order_deadline: entry.order_deadline || null,
    release: entry.release || '',
    priority: entry.priority || 'medium',
    status: entry.status || 'want',
    notes: entry.notes || '',
    created_at: toIsoString(entry.created_at),
    updated_at: toIsoString(entry.updated_at),
  };
}

// Format 5 is a ZIP archive: backup.json holds the records, and each photo is an image
// file next to it, referred to by its path. Photos stay binary instead of growing by a
// third as Data URLs, and the archive refers to the stored Blobs instead of copying them.
export async function createBackupArchive({ items, wishlist }, version = BACKUP_VERSION) {
  const files = [];
  const describe = (records, toMetadata, folder, limitMessage) => {
    if (!Array.isArray(records) || records.length > BACKUP_LIMITS.maxItems) {
      throw new Error(limitMessage);
    }
    return records.map((record, index) => ({
      ...toMetadata(record),
      photos: getPhotos(record).filter(photo => photo instanceof Blob).map((photo, position) => {
        const extension = PHOTO_EXTENSIONS[photo.type];
        if (!extension) throw new Error(`Unsupported photo type: ${photo.type || 'unknown'}`);
        if (photo.size > BACKUP_LIMITS.maxPhotoBytes) throw new Error('Photo exceeds backup size limit');
        const name = `photos/${folder}/${String(index + 1).padStart(4, '0')}-${position + 1}.${extension}`;
        files.push({ name, data: photo });
        return name;
      }),
    }));
  };

  const payload = buildBackupPayload({
    items: describe(items, itemMetadata, 'items', 'Collection exceeds backup item limit'),
    wishlist: describe(wishlist, wishlistMetadata, 'wishlist', 'Wishlist exceeds backup entry limit'),
  }, version);
  return createZip([{ name: BACKUP_DATA_FILE, data: JSON.stringify(payload, null, 2) }, ...files]);
}

// Reads a backup file: a ZIP archive from format 5 on, or a JSON file from earlier
// versions. Photos in an archive are read later, one at a time, straight from the file.
export async function readBackupFile(file) {
  if (!file || typeof file.size !== 'number') throw new Error('Backup file missing');

  if (await isZip(file)) {
    if (file.size > BACKUP_LIMITS.maxArchiveBytes) throw new Error('Backup file is too large');
    const archive = await readZip(file);
    if (!archive.has(BACKUP_DATA_FILE)) throw new Error('Backup data is missing from the archive');
    if (archive.size(BACKUP_DATA_FILE) > BACKUP_LIMITS.maxDataBytes) throw new Error('Backup data is too large');
    return { payload: parseBackupText(await archive.text(BACKUP_DATA_FILE)), archive };
  }

  if (file.size > BACKUP_LIMITS.maxFileBytes) throw new Error('Backup file is too large');
  return { payload: parseBackupText(await file.text()), archive: null };
}

export function buildBackupPayload({ items, wishlist }, version) {
  return {
    version,
    timestamp: new Date().toISOString(),
    items,
    wishlist,
  };
}

export function parseBackupText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }
}

// Backups made before version 3 hold only the collection. Importing one replaces the
// collection and leaves the current wishlist alone.
export function hasWishlistSection(payload) {
  return payload?.version >= WISHLIST_BACKUP_VERSION && payload.wishlist !== undefined;
}

// `archive` is the opened backup archive for format 5, whose photos are files in it.
export function validateBackupPayload(payload, expectedVersion, archive = null) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload is not an object');
  }
  if (!Number.isInteger(payload.version) || payload.version < 1 || payload.version > expectedVersion) {
    throw new Error(`Unsupported backup version: ${payload.version}`);
  }
  if (!Array.isArray(payload.items)) {
    throw new Error('Backup items missing or invalid format');
  }
  if (payload.items.length > BACKUP_LIMITS.maxItems) {
    throw new Error('Backup contains too many items');
  }

  const itemIds = new Set();
  payload.items.forEach((item, index) => validateItem(item, index, itemIds, archive));

  if (hasWishlistSection(payload)) {
    if (!Array.isArray(payload.wishlist)) {
      throw new Error('Backup wishlist has an invalid format');
    }
    if (payload.wishlist.length > BACKUP_LIMITS.maxItems) {
      throw new Error('Backup contains too many wishlist entries');
    }

    const entryIds = new Set();
    payload.wishlist.forEach((entry, index) => validateWishlistEntry(entry, index, entryIds, archive));
  }

  return true;
}

// Returns the photos of a backup record as Blobs: slices of the archive for format 5, or
// decoded Data URLs from the `photos` or older `photo` form. An archive photo must start
// like the image type its name gives, so a backup cannot plant another kind of file.
async function photosFromBackup(record, archive) {
  if (!archive) {
    return getPhotos(record).map(dataUrl => {
      const { mimeType, bytes } = decodeImageDataUrl(dataUrl);
      return new Blob([bytes], { type: mimeType });
    });
  }

  const photos = [];
  for (const path of record.photos) {
    const type = PHOTO_TYPES[path.slice(path.lastIndexOf('.') + 1)];
    const photo = await archive.file(path, type);
    if (!hasMatchingImageSignature(type, new Uint8Array(await photo.slice(0, 12).arrayBuffer()))) {
      throw new Error('Photo type does not match its contents');
    }
    photos.push(photo);
  }
  return photos;
}

export async function rehydrateBackupItems(items, archive = null) {
  return mapWithConcurrency(items, BACKUP_CONCURRENCY, async (item) => {
    const rehydrated = { ...item };
    rehydrated.series = toValueArray(rehydrated.series);
    rehydrated.character = toValueArray(rehydrated.character);
    rehydrated.merchandise_type = typeof item.merchandise_type === 'string' ? item.merchandise_type : '';

    if (rehydrated.created_at) rehydrated.created_at = new Date(rehydrated.created_at);
    if (rehydrated.updated_at) rehydrated.updated_at = new Date(rehydrated.updated_at);

    rehydrated.photos = await photosFromBackup(item, archive);
    delete rehydrated.photo;

    return rehydrated;
  });
}

// Only known fields are restored. An entry without dates gets the import time, because
// the wishlist reads entries through the created_at index and would skip it otherwise.
export async function rehydrateWishlistEntries(entries, archive = null) {
  return mapWithConcurrency(entries, BACKUP_CONCURRENCY, async (entry) => {
    const createdAt = entry.created_at ? new Date(entry.created_at) : new Date();
    const rehydrated = createWishlistEntry({
      name: entry.name ?? '',
      series: toValueArray(entry.series),
      character: toValueArray(entry.character),
      merchandise_type: entry.merchandise_type ?? '',
      links: (entry.links ?? []).map(link => ({ url: link.url, label: link.label ?? '' })),
      price: entry.price ?? null,
      currency: entry.currency || DEFAULT_WISHLIST_CURRENCY,
      shop: entry.shop ?? '',
      order_deadline: entry.order_deadline || null,
      release: entry.release ?? '',
      priority: entry.priority ?? 'medium',
      status: entry.status ?? 'want',
      notes: entry.notes ?? '',
      created_at: createdAt,
      updated_at: entry.updated_at ? new Date(entry.updated_at) : createdAt,
    });

    if (entry.id !== undefined) rehydrated.id = entry.id;
    rehydrated.photos = await photosFromBackup(entry, archive);

    return rehydrated;
  });
}

export async function rehydrateBackup(payload, archive = null) {
  return {
    items: await rehydrateBackupItems(payload.items, archive),
    wishlist: hasWishlistSection(payload)
      ? await rehydrateWishlistEntries(payload.wishlist, archive)
      : undefined,
  };
}

// Replaces the collection, and the wishlist when the backup has one, in one transaction,
// so a failure leaves both tables as they were.
export async function replaceBackupInDb(db, { items, wishlist }) {
  const tables = wishlist ? [db.items, db.wishlist] : [db.items];

  await db.transaction('rw', tables, async () => {
    await db.items.clear();
    await db.items.bulkAdd(items);

    if (wishlist) {
      await db.wishlist.clear();
      await db.wishlist.bulkAdd(wishlist);
    }
  });
}
