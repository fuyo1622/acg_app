export function normalizeKey(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

export function toValueArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  const seen = new Set();

  return values.reduce((result, entry) => {
    if (typeof entry !== 'string') return result;

    const normalized = entry.trim();
    const comparisonKey = normalizeKey(entry);
    if (!normalized || seen.has(comparisonKey)) return result;

    seen.add(comparisonKey);
    result.push(normalized);
    return result;
  }, []);
}

// Values that differ only by case or surrounding space describe the same category.
// The first spelling encountered becomes the canonical label for the whole group.
export function collectUniqueValues(values) {
  const canonical = new Map();

  for (const value of values) {
    const key = normalizeKey(value);
    if (!key || canonical.has(key)) continue;
    canonical.set(key, value.trim());
  }

  return [...canonical.values()];
}

export function isSameValue(left, right) {
  const key = normalizeKey(left);
  return Boolean(key) && key === normalizeKey(right);
}

export function formatValues(value, separator = '、') {
  return toValueArray(value).join(separator);
}
