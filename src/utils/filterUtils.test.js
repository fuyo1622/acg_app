import { describe, it, expect } from 'vitest';
import { filterItems, getUniqueValues, resolveFilterValue } from './filterUtils';

describe('filterUtils', () => {
  const items = [
    { id: 1, series: ['Evangelion', 'Rebuild of Evangelion'], character: ['Asuka', 'Rei'], merchandise_type: 'figure', notes: 'test note' },
    { id: 2, series: 'Gundam', character: 'Char', merchandise_type: 'apparel', notes: 'red' },
    { id: 3, series: 'Evangelion', character: 'Shinji', merchandise_type: 'plush', notes: '' },
    { id: 4, series: 'Custom Series', character: '', merchandise_type: 'custom_stand', notes: '' },
  ];

  it('filters by search term', () => {
    const result = filterItems({ items, searchTerm: 'asuka', filterType: 'all', filterSeries: 'all', filterCharacter: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].character).toContain('Asuka');
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
    expect(uniqueSeries).toContain('Rebuild of Evangelion');
    expect(uniqueSeries).toContain('Gundam');
    expect(uniqueSeries).toContain('Custom Series');
    
    expect(uniqueCharacters).toContain('Asuka');
    expect(uniqueCharacters).toContain('Rei');
    expect(uniqueCharacters).toContain('Char');
    expect(uniqueCharacters).not.toContain(''); // empty strings should be filtered

    expect(uniqueCustomTypes).toContain('custom_stand');
    expect(uniqueCustomTypes).not.toContain('figure'); // standard types excluded
  });

  it('treats values that differ only by case as one category', () => {
    const mixedCase = [
      { id: 1, series: ['Evangelion'], character: ['Asuka'], merchandise_type: 'figure' },
      { id: 2, series: ['evangelion'], character: ['asuka'], merchandise_type: 'Figure' },
      { id: 3, series: [' EVANGELION '], character: ['Rei'], merchandise_type: 'nendoroid' },
    ];

    const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = getUniqueValues(mixedCase);
    expect(uniqueSeries).toEqual(['Evangelion']);
    expect(uniqueCharacters).toEqual(['Asuka', 'Rei']);
    expect(uniqueCustomTypes).toEqual(['nendoroid']);

    const bySeries = filterItems({
      items: mixedCase,
      searchTerm: '',
      filterType: 'all',
      filterSeries: 'Evangelion',
      filterCharacter: 'all',
    });
    expect(bySeries).toHaveLength(3);

    const byType = filterItems({
      items: mixedCase,
      searchTerm: '',
      filterType: 'figure',
      filterSeries: 'all',
      filterCharacter: 'all',
    });
    expect(byType).toHaveLength(2);
  });

  it('searches the merchandise type by stored key and by translated label', () => {
    const getTypeLabel = type => (type === 'plush' ? '玩偶' : type);

    const byKey = filterItems({
      items,
      searchTerm: 'plush',
      filterType: 'all',
      filterSeries: 'all',
      filterCharacter: 'all',
      getTypeLabel,
    });
    expect(byKey).toHaveLength(1);
    expect(byKey[0].id).toBe(3);

    const byLabel = filterItems({
      items,
      searchTerm: '玩偶',
      filterType: 'all',
      filterSeries: 'all',
      filterCharacter: 'all',
      getTypeLabel,
    });
    expect(byLabel).toHaveLength(1);
    expect(byLabel[0].id).toBe(3);
  });

  it('resolves a filter value against the options that still exist', () => {
    expect(resolveFilterValue(['Evangelion', 'Gundam'], 'all')).toBe('all');
    expect(resolveFilterValue(['Evangelion', 'Gundam'], 'Evangelion')).toBe('Evangelion');
    expect(resolveFilterValue(['evangelion'], 'Evangelion')).toBe('evangelion');
    expect(resolveFilterValue(['Gundam'], 'Evangelion')).toBe('all');
    expect(resolveFilterValue([], 'Evangelion')).toBe('all');
  });
});
