import { describe, expect, it, vi } from 'vitest';
import {
  formatBytes,
  getStorageStatus,
  isStorageNearCapacity,
  requestPersistentStorage,
} from './storageUtils';

describe('storageUtils', () => {
  it('returns usage, quota and persistence status', async () => {
    const manager = {
      estimate: vi.fn().mockResolvedValue({ usage: 80, quota: 100 }),
      persisted: vi.fn().mockResolvedValue(true),
    };

    await expect(getStorageStatus(manager)).resolves.toEqual({
      supported: true,
      usage: 80,
      quota: 100,
      ratio: 0.8,
      persistent: true,
    });
    expect(isStorageNearCapacity(await getStorageStatus(manager))).toBe(true);
  });

  it('gracefully handles unsupported browsers and persistence denial', async () => {
    await expect(getStorageStatus(null)).resolves.toEqual({
      supported: false,
      usage: 0,
      quota: 0,
      ratio: 0,
      persistent: false,
    });
    await expect(requestPersistentStorage({ persist: vi.fn().mockResolvedValue(false) }))
      .resolves.toBe(false);
  });

  it('formats storage values', () => {
    expect(formatBytes(1024, 'en')).toBe('1 KB');
    expect(formatBytes(0, 'en')).toBe('0 B');
  });
});
