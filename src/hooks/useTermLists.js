import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { TERM_FIELDS, buildTermList } from '../utils/termUtils';

// The user's saved orders of types, series, and characters, by field. Undefined while
// they load.
export function useSavedTermOrders() {
  const saved = useLiveQuery(() => db.terms.toArray(), []);
  return useMemo(() => {
    if (!Array.isArray(saved)) return undefined;
    return Object.fromEntries(
      saved
        .filter(entry => TERM_FIELDS.includes(entry?.field) && Array.isArray(entry.values))
        .map(entry => [entry.field, entry.values]),
    );
  }, [saved]);
}

// The lists of types, series, and characters in the user's order, completed with the
// values these records use.
export function useTermLists(records) {
  const saved = useSavedTermOrders();
  return useMemo(
    () => Object.fromEntries(TERM_FIELDS.map(field => [field, buildTermList(field, records ?? [], saved?.[field])])),
    [records, saved],
  );
}
