import { DEFAULT_TYPES } from './constants';
import { collectUniqueValues, isSameValue, normalizeKey, toValueArray } from './valueUtils';

const DEFAULT_TYPE_KEYS = new Set(DEFAULT_TYPES.map(normalizeKey));

function matchesSelection(values, selected) {
  return selected === 'all' || values.some(value => isSameValue(value, selected));
}

export function filterItems({
  items,
  searchTerm,
  filterType,
  filterSeries,
  filterCharacter,
  getTypeLabel = type => type,
}) {
  if (!items) return [];

  const searchLower = normalizeKey(searchTerm);

  return items.filter(item => {
    const seriesValues = toValueArray(item.series);
    const characterValues = toValueArray(item.character);
    const type = item.merchandise_type || '';
    const searchableValues = [
      ...seriesValues,
      ...characterValues,
      type,
      getTypeLabel(type),
      item.notes || '',
    ];

    const matchesSearch = !searchLower
      || searchableValues.some(value => normalizeKey(value).includes(searchLower));

    const matchesType = matchesSelection([type], filterType);
    const matchesSeries = matchesSelection(seriesValues, filterSeries);
    const matchesCharacter = matchesSelection(characterValues, filterCharacter);

    return matchesSearch && matchesType && matchesSeries && matchesCharacter;
  });
}


export function getUniqueValues(items) {
  if (!items) return { uniqueSeries: [], uniqueCharacters: [], uniqueCustomTypes: [] };

  const uniqueCustomTypes = collectUniqueValues(
    items
      .map(item => item.merchandise_type)
      .filter(type => typeof type === 'string' && !DEFAULT_TYPE_KEYS.has(normalizeKey(type))),
  );
  const uniqueSeries = collectUniqueValues(items.flatMap(item => toValueArray(item.series)));
  const uniqueCharacters = collectUniqueValues(items.flatMap(item => toValueArray(item.character)));

  return { uniqueSeries, uniqueCharacters, uniqueCustomTypes };
}

// Keeps a selected filter usable after the collection changes: it falls back to "all"
// when the value disappears, and re-points at the canonical spelling when only the
// casing of the remaining items changed.
export function resolveFilterValue(options, selected) {
  if (selected === 'all') return 'all';
  return options.find(option => isSameValue(option, selected)) ?? 'all';
}
