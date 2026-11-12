import { BACKUP_LIMITS, DEFAULT_TYPES } from './constants';
import { collectUniqueValues, isSameValue, normalizeKey, toValueArray } from './valueUtils';

// The fields whose values the user manages as ordered lists, shared by the collection and
// the wishlist.
export const TERM_FIELDS = ['merchandise_type', 'series', 'character'];

export function termMaxLength(field) {
  return field === 'merchandise_type' ? BACKUP_LIMITS.maxTypeLength : BACKUP_LIMITS.maxValueLength;
}

// The values a record holds for a field: series and characters are lists, a type is one
// string (or none, before it is filled in).
export function recordTerms(record, field) {
  if (field === 'merchandise_type') {
    const type = typeof record?.merchandise_type === 'string' ? record.merchandise_type.trim() : '';
    return type && type !== '__custom__' ? [type] : [];
  }
  return toValueArray(record?.[field]);
}

// A field's list in the user's order: the saved order first, then any value the records
// use that it lacks, in the order the records first use them. Without a saved order, the
// type list starts with the built-in types. Spellings that differ only by case or spaces
// are one value, written the way it first appears.
export function buildTermList(field, records = [], saved) {
  const base = Array.isArray(saved) ? saved : (field === 'merchandise_type' ? DEFAULT_TYPES : []);
  return collectUniqueValues([...base, ...records.flatMap(record => recordTerms(record, field))]);
}

// How many records use each value of a field, keyed by the value's normalized form.
export function countTermUsage(field, records = []) {
  const counts = new Map();
  for (const record of records) {
    for (const value of recordTerms(record, field)) {
      const key = normalizeKey(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

// Built-in types are stored as keys and shown in the current language.
export function getTermLabel(field, value, t) {
  return field === 'merchandise_type' && DEFAULT_TYPES.includes(value) ? t(value) : value;
}

// Name order in the user's language: A to Z in English; in Chinese, stroke order, with
// Chinese names ahead of Latin ones and Japanese kana in kana order.
export function sortTermsByName(values, getLabel, lang) {
  const collator = new Intl.Collator(lang === 'zh-TW' ? 'zh-Hant-TW' : 'en', { numeric: true, sensitivity: 'base' });
  return [...values].sort((left, right) => collator.compare(getLabel(left), getLabel(right)));
}

// The list after renaming a value. A new name the list already has merges the two, and
// the merged value keeps its place.
export function renameInList(list, from, to) {
  const target = list.find(value => isSameValue(value, to) && !isSameValue(value, from));
  if (target) return list.filter(value => !isSameValue(value, from));
  return list.map(value => (isSameValue(value, from) ? to : value));
}

export function usesTerm(record, field, value) {
  return recordTerms(record, field).some(entry => isSameValue(entry, value));
}

// Applies a rename to one record, in place, keeping each value once. Returns whether the
// record changed.
export function renameInRecord(record, field, from, to) {
  if (!usesTerm(record, field, from)) return false;
  if (field === 'merchandise_type') {
    record.merchandise_type = to;
  } else {
    record[field] = toValueArray(toValueArray(record[field]).map(value => (isSameValue(value, from) ? to : value)));
  }
  return true;
}

// Removes a value from one record, in place. Returns whether the record changed.
export function removeFromRecord(record, field, value) {
  if (!usesTerm(record, field, value)) return false;
  if (field === 'merchandise_type') {
    record.merchandise_type = '';
  } else {
    record[field] = toValueArray(record[field]).filter(entry => !isSameValue(entry, value));
  }
  return true;
}

// Checks a name the user typed for a field. Returns the trimmed name, or the key of the
// error message to show.
export function checkTermName(field, name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { error: 'termNameRequired' };
  if (trimmed.length > termMaxLength(field)) return { error: 'termNameTooLong' };
  return { name: trimmed };
}
