import { DEFAULT_TYPES } from './constants';

export function filterItems({ items, searchTerm, filterType, filterSeries, filterCharacter }) {
  if (!items) return [];
  
  const searchLower = (searchTerm || '').toLowerCase();

  return items.filter(item => {
    const matchesSearch = 
      (item.series || '').toLowerCase().includes(searchLower) ||
      (item.character || '').toLowerCase().includes(searchLower) ||
      (item.notes || '').toLowerCase().includes(searchLower);
    
    const matchesType = filterType === 'all' || item.merchandise_type === filterType;
    const matchesSeries = filterSeries === 'all' || item.series === filterSeries;
    const matchesCharacter = filterCharacter === 'all' || item.character === filterCharacter;
    
    return matchesSearch && matchesType && matchesSeries && matchesCharacter;
  });
}


export function getUniqueValues(items) {
  if (!items) return { uniqueSeries: [], uniqueCharacters: [], uniqueCustomTypes: [] };
  
  const uniqueCustomTypes = [...new Set(items.map(i => i.merchandise_type).filter(v => v && !DEFAULT_TYPES.includes(v)))];
  const uniqueSeries = [...new Set(items.map(i => i.series).filter(Boolean))];
  const uniqueCharacters = [...new Set(items.map(i => i.character).filter(Boolean))];

  return { uniqueSeries, uniqueCharacters, uniqueCustomTypes };
}
