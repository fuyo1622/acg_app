import { db } from './db';
import { removeFromRecord, renameInList, renameInRecord, usesTerm } from '../utils/termUtils';
import { isSameValue } from '../utils/valueUtils';

export function saveTermOrder(field, values) {
  return db.terms.put({ field, values });
}

// Changes every collection item and wishlist entry that uses the value, and saves the
// list, in one transaction: a failure leaves records and list as they were.
async function updateRecordsAndList(field, value, changeRecord, list) {
  const updatedAt = new Date();
  await db.transaction('rw', db.items, db.wishlist, db.terms, async () => {
    for (const table of [db.items, db.wishlist]) {
      await table
        .filter(record => usesTerm(record, field, value))
        .modify(record => {
          if (changeRecord(record)) record.updated_at = updatedAt;
        });
    }
    await db.terms.put({ field, values: list });
  });
}

// Renames a value in the list and in every record. A name the list already has merges
// the two.
export function renameTerm(field, list, from, to) {
  return updateRecordsAndList(
    field,
    from,
    record => renameInRecord(record, field, from, to),
    renameInList(list, from, to),
  );
}

// Deletes a value from the list and from every record that uses it.
export function deleteTerm(field, list, value) {
  return updateRecordsAndList(
    field,
    value,
    record => removeFromRecord(record, field, value),
    list.filter(entry => !isSameValue(entry, value)),
  );
}
