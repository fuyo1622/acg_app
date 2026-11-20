import { db } from './db';
import { removeFromRecord, renameInList, renameInRecord, usesTerm } from '../utils/termUtils';
import { copyStoredPhoto, getPhotos } from '../utils/photoUtils';
import { PHOTO_COPY_BATCH_BYTES } from '../utils/constants';
import { isSameValue } from '../utils/valueUtils';

export function saveTermOrder(field, values) {
  return db.terms.put({ field, values });
}

const photoBytesOf = record => getPhotos(record)
  .reduce((total, photo) => total + (photo instanceof Blob ? photo.size : 0), 0);

// Consecutive records with about `batchBytes` of photos each; a larger record is a batch of
// its own.
function inBatches(records, batchBytes) {
  const batches = [];
  let batch = [];
  let bytes = 0;
  for (const record of records) {
    const size = photoBytesOf(record);
    if (batch.length > 0 && bytes + size > batchBytes) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(record);
    bytes += size;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

const timeOf = value => (value instanceof Date ? value.getTime() : value ?? null);

// Changes every collection item and wishlist entry that uses the value, then saves the list.
// A changed record is saved with copies of its photos, which Safari can read at once (see
// copyStoredPhoto), so the records are changed in batches of about `batchBytes` of photos,
// each in a transaction of its own, and only one batch's copies are held at a time. The list
// is saved last: a failure leaves it as it was, and the records not reached yet, so the same
// change made again finishes it. A record changed elsewhere in the meantime stops the change.
async function updateRecordsAndList(field, value, changeRecord, list, {
  batchBytes = PHOTO_COPY_BATCH_BYTES,
} = {}) {
  const updatedAt = new Date();
  for (const table of [db.items, db.wishlist]) {
    const records = await table.filter(record => usesTerm(record, field, value)).toArray();
    for (const batch of inBatches(records, batchBytes)) {
      const read = [];
      const changed = [];
      for (const record of batch) {
        const next = { ...record };
        if (!changeRecord(next)) continue;
        next.updated_at = updatedAt;
        if (Array.isArray(next.photos)) next.photos = await Promise.all(next.photos.map(copyStoredPhoto));
        read.push(record);
        changed.push(next);
      }
      if (changed.length === 0) continue;
      await db.transaction('rw', table, async () => {
        const current = await table.bulkGet(read.map(record => record.id));
        if (current.some((record, index) => timeOf(record?.updated_at) !== timeOf(read[index].updated_at))) {
          throw new Error('A record changed while the list was being changed');
        }
        await table.bulkPut(changed);
      });
    }
  }
  await db.terms.put({ field, values: list });
}

// Renames a value in the list and in every record. A name the list already has merges
// the two.
export function renameTerm(field, list, from, to, options) {
  return updateRecordsAndList(
    field,
    from,
    record => renameInRecord(record, field, from, to),
    renameInList(list, from, to),
    options,
  );
}

// Deletes a value from the list and from every record that uses it.
export function deleteTerm(field, list, value, options) {
  return updateRecordsAndList(
    field,
    value,
    record => removeFromRecord(record, field, value),
    list.filter(entry => !isSameValue(entry, value)),
    options,
  );
}
