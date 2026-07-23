import { toValueArray } from './valueUtils';
import { BACKUP_CONCURRENCY, BACKUP_LIMITS } from './constants';

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/;

export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

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

function validateText(value, label, maxLength, index, { required = false } = {}) {
  if (typeof value !== 'string') {
    if (required && (value === undefined || value === null)) {
      throw new Error(`Item at index ${index} is missing ${label}`);
    }
    throw new Error(`Item at index ${index} has invalid ${label}`);
  }
  if (required && !value.trim()) {
    throw new Error(`Item at index ${index} is missing ${label}`);
  }
  if (value.length > maxLength) {
    throw new Error(`Item at index ${index} exceeds ${label} length limit`);
  }
}

function validateValues(value, label, index) {
  if (value === undefined) return;
  const rawValues = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(rawValues) || !rawValues.every(entry => typeof entry === 'string')) {
    throw new Error(`Item at index ${index} has invalid ${label}`);
  }
  if (rawValues.length > BACKUP_LIMITS.maxValuesPerField) {
    throw new Error(`Item at index ${index} has too many ${label} values`);
  }
  rawValues.forEach(entry => validateText(
    entry,
    label,
    BACKUP_LIMITS.maxValueLength,
    index,
  ));
}

export function validateBackupFile(file) {
  if (!file || typeof file.size !== 'number') throw new Error('Backup file missing');
  if (file.size > BACKUP_LIMITS.maxFileBytes) throw new Error('Backup file is too large');
  return true;
}

export async function serializeBackupItems(items) {
  if (!Array.isArray(items) || items.length > BACKUP_LIMITS.maxItems) {
    throw new Error('Collection exceeds backup item limit');
  }

  return mapWithConcurrency(items, BACKUP_CONCURRENCY, async (item) => {
    const serialized = {
      id: item.id,
      series: toValueArray(item.series),
      character: toValueArray(item.character),
      merchandise_type: item.merchandise_type || '',
      notes: item.notes || '',
      created_at: item.created_at ? item.created_at.toISOString() : null,
      updated_at: item.updated_at ? item.updated_at.toISOString() : null,
    };

    if (item.photo && (item.photo instanceof Blob)) {
      if (item.photo.size > BACKUP_LIMITS.maxPhotoBytes) {
        throw new Error('Photo exceeds backup size limit');
      }
      serialized.photo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read Blob as Data URL'));
        reader.readAsDataURL(item.photo);
      });
    } else {
      serialized.photo = null;
    }
    
    return serialized;
  });
}

export function buildBackupPayload(serializedItems, version) {
  return {
    version,
    timestamp: new Date().toISOString(),
    items: serializedItems
  };
}

export function parseBackupText(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }
}

export function validateBackupPayload(payload, expectedVersion) {
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

  const ids = new Set();

  for (const [index, item] of payload.items.entries()) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${index} is invalid`);
    }

    if (item.id !== undefined && (!Number.isInteger(item.id) || item.id <= 0)) {
      throw new Error(`Item at index ${index} has an invalid id`);
    }
    if (item.id !== undefined) {
      if (ids.has(item.id)) throw new Error(`Item at index ${index} has a duplicate id`);
      ids.add(item.id);
    }

    validateValues(item.series, 'series', index);
    validateValues(item.character, 'character', index);

    if (toValueArray(item.series).length === 0 && toValueArray(item.character).length === 0) {
      throw new Error(`Item at index ${index} must have at least one of series or character`);
    }

    validateText(
      item.merchandise_type,
      'merchandise_type',
      BACKUP_LIMITS.maxTypeLength,
      index,
      { required: true },
    );
    validateText(item.notes ?? '', 'notes', BACKUP_LIMITS.maxNotesLength, index);

    if (item.created_at && Number.isNaN(Date.parse(item.created_at))) {
      throw new Error(`Item at index ${index} has invalid created_at date`);
    }
    if (item.updated_at && Number.isNaN(Date.parse(item.updated_at))) {
      throw new Error(`Item at index ${index} has invalid updated_at date`);
    }

    if (item.photo !== null && typeof item.photo !== 'undefined') {
      if (typeof item.photo !== 'string') {
        throw new Error(`Item at index ${index} contains invalid photo Data URL`);
      }
      try {
        decodeImageDataUrl(item.photo);
      } catch (error) {
        throw new Error(`Item at index ${index} contains invalid photo Data URL: ${error.message}`);
      }
    }
  }

  return true;
}

export async function rehydrateBackupItems(items) {
  return mapWithConcurrency(items, BACKUP_CONCURRENCY, async (item) => {
    const rehydrated = { ...item };
    rehydrated.series = toValueArray(rehydrated.series);
    rehydrated.character = toValueArray(rehydrated.character);
    
    if (rehydrated.created_at) rehydrated.created_at = new Date(rehydrated.created_at);
    if (rehydrated.updated_at) rehydrated.updated_at = new Date(rehydrated.updated_at);
    
    if (rehydrated.photo && typeof rehydrated.photo === 'string') {
      const { mimeType, bytes } = decodeImageDataUrl(rehydrated.photo);
      rehydrated.photo = new Blob([bytes], { type: mimeType });
    }
    
    return rehydrated;
  });
}

export async function replaceItemsInDb(db, hydratedItems) {
  await db.transaction('rw', db.items, async () => {
    await db.items.clear();
    await db.items.bulkAdd(hydratedItems);
  });
}
