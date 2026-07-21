import { DEFAULT_TYPES } from './constants';
import { toValueArray } from './valueUtils';

export function filterItems({ items, searchTerm, filterType, filterSeries, filterCharacter }) {
  if (!items) return [];
  
  const searchLower = (searchTerm || '').toLowerCase();

  return items.filter(item => {
    const seriesValues = toValueArray(item.series);
    const characterValues = toValueArray(item.character);
    const matchesSearch = 
      seriesValues.some(value => value.toLowerCase().includes(searchLower)) ||
      characterValues.some(value => value.toLowerCase().includes(searchLower)) ||
      (item.notes || '').toLowerCase().includes(searchLower);
    
    const matchesType = filterType === 'all' || item.merchandise_type === filterType;
    const matchesSeries = filterSeries === 'all' || seriesValues.includes(filterSeries);
    const matchesCharacter = filterCharacter === 'all' || characterValues.includes(filterCharacter);
    
    return matchesSearch && matchesType && matchesSeries && matchesCharacter;
  });
}


export function getUniqueValues(items) {
  if (!items) return { uniqueSeries: [], uniqueCharacters: [], uniqueCustomTypes: [] };
  
  const uniqueCustomTypes = [...new Set(items.map(i => i.merchandise_type).filter(v => v && !DEFAULT_TYPES.includes(v)))];
  const uniqueSeries = [...new Set(items.flatMap(i => toValueArray(i.series)))];
  const uniqueCharacters = [...new Set(items.flatMap(i => toValueArray(i.character)))];

  return { uniqueSeries, uniqueCharacters, uniqueCustomTypes };
}
