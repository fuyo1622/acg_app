export function toValueArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  const seen = new Set();

  return values.reduce((result, entry) => {
    if (typeof entry !== 'string') return result;

    const normalized = entry.trim();
    const comparisonKey = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(comparisonKey)) return result;

    seen.add(comparisonKey);
    result.push(normalized);
    return result;
  }, []);
}

export function formatValues(value, separator = '、') {
  return toValueArray(value).join(separator);
}
