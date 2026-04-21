import { describe, it, expect } from 'vitest';
import { filterItems, getUniqueValues } from './filterUtils';

describe('filterUtils', () => {
  const items = [
    { id: 1, series: 'Evangelion', character: 'Asuka', merchandise_type: 'figure', notes: 'test note' },
    { id: 2, series: 'Gundam', character: 'Char', merchandise_type: 'apparel', notes: 'red' },
    { id: 3, series: 'Evangelion', character: 'Shinji', merchandise_type: 'plush', notes: '' },
    { id: 4, series: 'Custom Series', character: '', merchandise_type: 'custom_stand', notes: '' },
  ];

  it('filters by search term', () => {
    const result = filterItems({ items, searchTerm: 'asuka', filterType: 'all', filterSeries: 'all', filterCharacter: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].character).toBe('Asuka');
  });

  it('filters by series', () => {
    const result = filterItems({ items, searchTerm: '', filterType: 'all', filterSeries: 'Evangelion', filterCharacter: 'all' });
    expect(result).toHaveLength(2);
  });

  it('filters by merchandise type', () => {
    const result = filterItems({ items, searchTerm: '', filterType: 'apparel', filterSeries: 'all', filterCharacter: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].series).toBe('Gundam');
  });

  it('extracts unique values correctly', () => {
    const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = getUniqueValues(items);
    
    expect(uniqueSeries).toContain('Evangelion');
    expect(uniqueSeries).toContain('Gundam');
    expect(uniqueSeries).toContain('Custom Series');
    
    expect(uniqueCharacters).toContain('Asuka');
    expect(uniqueCharacters).toContain('Char');
    expect(uniqueCharacters).not.toContain(''); // empty strings should be filtered

    expect(uniqueCustomTypes).toContain('custom_stand');
    expect(uniqueCustomTypes).not.toContain('figure'); // standard types excluded
  });
});
