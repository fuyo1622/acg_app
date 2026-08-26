import { describe, it, expect } from 'vitest';
import { collectUniqueValues, formatValues, isSameValue, normalizeKey, toValueArray } from './valueUtils';

describe('valueUtils', () => {
  it('normalizes only strings', () => {
    expect(normalizeKey('  Evangelion ')).toBe('evangelion');
    expect(normalizeKey(undefined)).toBe('');
    expect(normalizeKey(42)).toBe('');
  });

  it('converts strings, arrays and invalid entries into a clean value array', () => {
    expect(toValueArray('Gundam')).toEqual(['Gundam']);
    expect(toValueArray(['Rei', ' Rei ', 'REI', '', null, 7])).toEqual(['Rei']);
    expect(toValueArray(undefined)).toEqual([]);
  });

  it('keeps the first spelling when collecting values across items', () => {
    expect(collectUniqueValues(['Evangelion', 'evangelion', ' EVANGELION ', 'Gundam']))
      .toEqual(['Evangelion', 'Gundam']);
    expect(collectUniqueValues(['', '   ', null])).toEqual([]);
  });

  it('compares values without case or padding, and never matches empty values', () => {
    expect(isSameValue('Evangelion', ' evangelion ')).toBe(true);
    expect(isSameValue('Evangelion', 'Gundam')).toBe(false);
    expect(isSameValue('', '')).toBe(false);
    expect(isSameValue(undefined, undefined)).toBe(false);
  });

  it('joins values with the requested separator', () => {
    expect(formatValues(['Asuka', 'Rei'], ', ')).toBe('Asuka, Rei');
    expect(formatValues(['Asuka', 'Rei'])).toBe('Asuka、Rei');
  });
});
