import { STORAGE_WARNING_RATIO } from './constants';

export async function getStorageStatus(storageManager = globalThis.navigator?.storage) {
  if (!storageManager?.estimate) {
    return { supported: false, usage: 0, quota: 0, ratio: 0, persistent: false };
  }

  const [{ usage = 0, quota = 0 }, persistent] = await Promise.all([
    storageManager.estimate(),
    storageManager.persisted?.() ?? Promise.resolve(false),
  ]);

  return {
    supported: true,
    usage,
    quota,
    ratio: quota > 0 ? usage / quota : 0,
    persistent: Boolean(persistent),
  };
}

export async function requestPersistentStorage(storageManager = globalThis.navigator?.storage) {
  if (!storageManager?.persist) return false;
  return Boolean(await storageManager.persist());
}

export function formatBytes(bytes, locale = 'en') {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
}

export function isStorageNearCapacity(status) {
  return Boolean(status?.supported && status.quota > 0 && status.ratio >= STORAGE_WARNING_RATIO);
}
