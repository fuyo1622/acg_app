import { describe, expect, it } from 'vitest';
import { translations } from './LanguageContext';

describe('translations', () => {
  it('defines every interface string in both languages', () => {
    const englishKeys = Object.keys(translations.en).sort();
    const chineseKeys = Object.keys(translations['zh-TW']).sort();

    expect(chineseKeys).toEqual(englishKeys);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = text => (text.match(/\{\w+\}/g) ?? []).sort();

    for (const [key, english] of Object.entries(translations.en)) {
      expect(placeholders(translations['zh-TW'][key]), key).toEqual(placeholders(english));
    }
  });
});
