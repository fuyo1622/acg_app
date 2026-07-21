import { describe, it, expect } from 'vitest';
import { validateItem } from './validationUtils';

describe('validateItem', () => {
  it('fails if neither series nor character is provided', () => {
    const result = validateItem({ series: '   ', character: '', merchandise_type: 'figure' });
    expect(result.isValid).toBe(false);
    expect(result.errorKey).toBe('validationRequireOne');
  });

  it('succeeds if only series is provided', () => {
    const result = validateItem({ series: 'Evangelion', character: '', merchandise_type: 'figure' });
    expect(result.isValid).toBe(true);
  });

  it('succeeds if only character is provided', () => {
    const result = validateItem({ series: '', character: 'Asuka', merchandise_type: 'figure' });
    expect(result.isValid).toBe(true);
  });

  it('supports multiple series and characters', () => {
    const result = validateItem({
      series: ['Evangelion', 'Rebuild of Evangelion'],
      character: ['Asuka', 'Rei'],
      merchandise_type: 'figure',
    });
    expect(result.isValid).toBe(true);
  });

  it('fails if merchandise type is missing or __custom__', () => {
    const missingType = validateItem({ series: 'A', character: 'B', merchandise_type: '' });
    expect(missingType.isValid).toBe(false);
    expect(missingType.errorKey).toBe('validationRequireType');

    const customTypePlaceholder = validateItem({ series: 'A', character: 'B', merchandise_type: '__custom__' });
    expect(customTypePlaceholder.isValid).toBe(false);
    expect(customTypePlaceholder.errorKey).toBe('validationRequireType');
  });

  it('succeeds with custom type text', () => {
    const result = validateItem({ series: 'A', character: 'B', merchandise_type: 'acrylic stand' });
    expect(result.isValid).toBe(true);
  });
});
