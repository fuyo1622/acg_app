import { toValueArray } from './valueUtils';

// A finished collection item names a series or character and a type. An item may still be
// saved without them and completed later, as album imports are; these are the details it
// still lacks, and an empty list means it is finished.
export function getMissingDetails(item) {
  const missing = [];

  if (toValueArray(item?.series).length === 0 && toValueArray(item?.character).length === 0) {
    missing.push('seriesOrCharacter');
  }

  const type = typeof item?.merchandise_type === 'string' ? item.merchandise_type.trim() : '';
  if (!type || type === '__custom__') missing.push('merchandiseType');

  return missing;
}

export function needsDetails(item) {
  return getMissingDetails(item).length > 0;
}

const MISSING_DETAIL_LABELS = Object.freeze({
  seriesOrCharacter: 'missingSeriesOrCharacter',
  merchandiseType: 'missingType',
});

// "a series or character and a type", or 「系列或角色、類型」.
export function describeMissingDetails(missing, t, lang) {
  return missing.map(key => t(MISSING_DETAIL_LABELS[key])).join(lang === 'en' ? ' and ' : '、');
}
