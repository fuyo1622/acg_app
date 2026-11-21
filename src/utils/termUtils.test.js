import { describe, expect, it } from 'vitest';
import {
  buildTermList,
  checkTermName,
  countTermUsage,
  getTermLabel,
  removeFromRecord,
  renameInList,
  renameInRecord,
  sortTermsByName,
} from './termUtils';
import { DEFAULT_TYPES } from './constants';

const records = [
  { series: ['Gundam'], character: ['Char', 'Amuro'], merchandise_type: 'figure' },
  { series: ['Evangelion', 'Rebuild of Evangelion'], character: ['Asuka'], merchandise_type: 'Nendoroid' },
  { series: ['evangelion'], character: ['asuka', ' '], merchandise_type: 'Figure' },
];

describe('buildTermList', () => {
  it('lists the values records use, once each, in the order they first appear', () => {
    expect(buildTermList('series', records)).toEqual(['Gundam', 'Evangelion', 'Rebuild of Evangelion']);
    expect(buildTermList('character', records)).toEqual(['Char', 'Amuro', 'Asuka']);
  });

  it('starts the type list with the built-in types and keeps one entry per type', () => {
    expect(buildTermList('merchandise_type', records)).toEqual([...DEFAULT_TYPES, 'Nendoroid']);
  });

  it('puts the saved order first, keeps saved values no record uses, and adds new ones after', () => {
    const saved = ['Rebuild of Evangelion', 'Macross', 'Gundam'];

    expect(buildTermList('series', records, saved)).toEqual(['Rebuild of Evangelion', 'Macross', 'Gundam', 'Evangelion']);
  });

  it('follows a saved type list without the built-in types it left out', () => {
    expect(buildTermList('merchandise_type', records, ['Nendoroid', 'plush'])).toEqual(['Nendoroid', 'plush', 'figure']);
  });
});

describe('countTermUsage', () => {
  it('counts the records that use each value, whatever the case', () => {
    const counts = countTermUsage('series', records);

    expect(counts.get('evangelion')).toBe(2);
    expect(counts.get('gundam')).toBe(1);
    expect(countTermUsage('merchandise_type', records).get('figure')).toBe(2);
  });
});

describe('getTermLabel and sortTermsByName', () => {
  const t = key => ({ figure: 'Figure/Statue', plush: 'Plush' }[key] ?? key);

  it('shows built-in types in the current language and other values as written', () => {
    expect(getTermLabel('merchandise_type', 'figure', t)).toBe('Figure/Statue');
    expect(getTermLabel('merchandise_type', 'Nendoroid', t)).toBe('Nendoroid');
    expect(getTermLabel('series', 'figure', t)).toBe('figure');
  });

  it('sorts English names from A to Z, by their labels and with numbers in order', () => {
    const values = ['plush', 'Nendoroid', 'figure', 'Item 10', 'Item 2'];
    const sorted = sortTermsByName(values, value => getTermLabel('merchandise_type', value, t), 'en');

    expect(sorted).toEqual(['figure', 'Item 2', 'Item 10', 'Nendoroid', 'plush']);
  });

  it('sorts Chinese names by stroke count', () => {
    // 一 has one stroke, 人 two, 大 three, 龍 sixteen.
    expect(sortTermsByName(['龍', '大', '一', '人'], value => value, 'zh-TW')).toEqual(['一', '人', '大', '龍']);
  });
});

describe('renaming and deleting values', () => {
  it('renames a value in the list, or merges it into a value the list already has', () => {
    expect(renameInList(['Gundam', 'EVA', 'Macross'], 'EVA', 'Evangelion')).toEqual(['Gundam', 'Evangelion', 'Macross']);
    expect(renameInList(['Gundam', 'EVA', 'Evangelion'], 'EVA', 'evangelion')).toEqual(['Gundam', 'Evangelion']);
    expect(renameInList(['eva'], 'eva', 'Eva')).toEqual(['Eva']);
  });

  it('renames a value inside a record, keeping each value once', () => {
    const record = { series: ['EVA', 'Evangelion', 'Gundam'], merchandise_type: 'figure' };

    expect(renameInRecord(record, 'series', 'eva', 'Evangelion')).toBe(true);
    expect(record.series).toEqual(['Evangelion', 'Gundam']);
    expect(renameInRecord(record, 'merchandise_type', 'figure', 'Scale figure')).toBe(true);
    expect(record.merchandise_type).toBe('Scale figure');
    expect(renameInRecord(record, 'character', 'Asuka', 'Rei')).toBe(false);
  });

  it('removes a value from a record, leaving a type empty', () => {
    const record = { series: ['Evangelion', 'Gundam'], character: [], merchandise_type: 'Figure' };

    expect(removeFromRecord(record, 'series', 'evangelion')).toBe(true);
    expect(record.series).toEqual(['Gundam']);
    expect(removeFromRecord(record, 'merchandise_type', 'figure')).toBe(true);
    expect(record.merchandise_type).toBe('');
    expect(removeFromRecord(record, 'character', 'Asuka')).toBe(false);
  });

  it('checks a typed name', () => {
    expect(checkTermName('series', '  Gundam  ')).toEqual({ name: 'Gundam' });
    expect(checkTermName('series', '   ')).toEqual({ error: 'termNameRequired' });
    expect(checkTermName('merchandise_type', 'x'.repeat(101))).toEqual({ error: 'termNameTooLong' });
  });
});
