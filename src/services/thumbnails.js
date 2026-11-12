import Dexie from 'dexie';
import { createThumbnail } from '../utils/imageUtils';

// List cards show small copies of the cover photos. Decoding 50 full-size photos for one
// page of cards takes hundreds of megabytes, and a phone kills a page that uses that much.
//
// The copies live in a database of their own: they can always be made again, so they stay
// out of the real data, its schema, and its backups.
const CARD_THUMBNAIL_SIZE = 480;
const MEMORY_CACHE_SIZE = 200;

const thumbnailDb = new Dexie('acg-thumbnails');
thumbnailDb.version(1).stores({ thumbnails: 'key' });

const remembered = new Map();
const prunedStores = new Set();
let queue = Promise.resolve();

// Every save changes updated_at, so a replaced cover never keeps its old copy.
function signatureOf(record, cover) {
  const changedAt = new Date(record.updated_at ?? record.created_at ?? 0).getTime();
  return `${changedAt}:${cover.size}:${cover.type}`;
}

function remember(key, signature, image) {
  remembered.delete(key);
  remembered.set(key, { signature, image });
  if (remembered.size > MEMORY_CACHE_SIZE) remembered.delete(remembered.keys().next().value);
}

// The cache is only a convenience: where it cannot be read or written, such as in private
// browsing, the copy is simply made again next time.
async function readStored(key) {
  try {
    return await thumbnailDb.thumbnails.get(key);
  } catch {
    return undefined;
  }
}

async function writeStored(entry) {
  try {
    await thumbnailDb.thumbnails.put(entry);
  } catch {
    // See readStored.
  }
}

// One at a time, so at most one full-size photo is decoded at any moment. A card that has
// left the screen gives up its turn.
function inTurn(task, signal) {
  const turn = queue.then(() => (signal?.aborted ? null : task()));
  queue = turn.catch(() => {});
  return turn;
}

// The image to show on a record's card: its small copy, or the cover itself when the cover
// is already small. Null if the card left the screen first.
//
// Making a copy takes a moment per photo and the cards take turns, so a page of 50 cards
// seen for the first time stayed empty for half a minute or more. When the copy has to be
// made, `onWait` is called first, so the card can show the photo itself meanwhile.
export async function getCardImage(storeName, record, cover, { signal, onWait } = {}) {
  const key = `${storeName}:${record.id}`;
  const signature = signatureOf(record, cover);

  const known = remembered.get(key);
  if (known?.signature === signature) return known.image;

  const stored = await readStored(key);
  if (stored?.signature === signature && stored.blob instanceof Blob) {
    remember(key, signature, stored.blob);
    return stored.blob;
  }

  if (signal?.aborted) return null;
  onWait?.();
  const image = await inTurn(() => createThumbnail(cover, CARD_THUMBNAIL_SIZE), signal);
  if (!image) return null;

  remember(key, signature, image);
  if (image !== cover) await writeStored({ key, signature, blob: image });
  return image;
}

// Drops the copies of records that no longer exist, once per visit to the app.
export async function pruneThumbnails(storeName, ids) {
  if (prunedStores.has(storeName)) return;
  prunedStores.add(storeName);

  try {
    const prefix = `${storeName}:`;
    const live = new Set(ids.map(id => `${prefix}${id}`));
    const keys = await thumbnailDb.thumbnails.where('key').startsWith(prefix).primaryKeys();
    const orphans = keys.filter(key => !live.has(key));
    if (orphans.length > 0) await thumbnailDb.thumbnails.bulkDelete(orphans);
  } catch {
    // See readStored.
  }
}
