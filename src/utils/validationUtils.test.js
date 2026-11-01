import { describe, it, expect } from 'vitest';
import { describeMissingDetails, getMissingDetails, needsDetails } from './validationUtils';

describe('getMissingDetails', () => {
  it('reports a missing series or character', () => {
    expect(getMissingDetails({ series: '   ', character: '', merchandise_type: 'figure' }))
      .toEqual(['seriesOrCharacter']);
  });

  it('accepts a series alone, a character alone, or several of each', () => {
    expect(getMissingDetails({ series: 'Evangelion', character: '', merchandise_type: 'figure' })).toEqual([]);
    expect(getMissingDetails({ series: '', character: 'Asuka', merchandise_type: 'figure' })).toEqual([]);
    expect(getMissingDetails({
      series: ['Evangelion', 'Rebuild'],
      character: ['Asuka', 'Rei'],
      merchandise_type: 'figure',
    })).toEqual([]);
  });

  it('reports a missing type, including the unfinished custom choice', () => {
    expect(getMissingDetails({ series: 'A', character: 'B', merchandise_type: '' })).toEqual(['merchandiseType']);
    expect(getMissingDetails({ series: 'A', character: 'B', merchandise_type: '__custom__' }))
      .toEqual(['merchandiseType']);
    expect(getMissingDetails({ series: 'A', character: 'B', merchandise_type: 'acrylic stand' })).toEqual([]);
  });

  it('lists everything an album-imported item still lacks', () => {
    const imported = { series: [], character: [], merchandise_type: '', photos: [] };
    expect(getMissingDetails(imported)).toEqual(['seriesOrCharacter', 'merchandiseType']);
    expect(needsDetails(imported)).toBe(true);
    expect(needsDetails({ series: ['A'], character: [], merchandise_type: 'plush' })).toBe(false);
  });
});

describe('describeMissingDetails', () => {
  const labels = { missingSeriesOrCharacter: 'a series or character', missingType: 'a type' };
  const t = key => labels[key];

  it('joins the missing details for the interface language', () => {
    expect(describeMissingDetails(['seriesOrCharacter', 'merchandiseType'], t, 'en'))
      .toBe('a series or character and a type');
    expect(describeMissingDetails(['seriesOrCharacter', 'merchandiseType'], t, 'zh-TW'))
      .toBe('a series or character、a type');
    expect(describeMissingDetails(['merchandiseType'], t, 'en')).toBe('a type');
  });
});
