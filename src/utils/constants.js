export const DEFAULT_TYPES = [
  'figure', 
  'plush', 
  'acrylic', 
  'badge', 
  'apparel', 
  'poster', 
  'other'
];

// Version 3 added the wishlist section. Older backups contain only the collection.
export const BACKUP_VERSION = 3;
export const WISHLIST_BACKUP_VERSION = 3;

export const BACKUP_LIMITS = Object.freeze({
  maxFileBytes: 50 * 1024 * 1024,
  maxItems: 2000,
  maxValuesPerField: 50,
  maxValueLength: 200,
  maxTypeLength: 100,
  maxNotesLength: 5000,
  maxPhotoBytes: 10 * 1024 * 1024,
});

export const BACKUP_CONCURRENCY = 4;
export const COLLECTION_PAGE_SIZE = 50;
export const STORAGE_WARNING_RATIO = 0.8;

export const WISHLIST_STATUSES = ['want', 'ordered'];
export const WISHLIST_STATUS_LABELS = Object.freeze({ want: 'statusWant', ordered: 'statusOrdered' });
export const WISHLIST_PRIORITIES = ['high', 'medium', 'low'];
export const WISHLIST_PRIORITY_LABELS = Object.freeze({
  high: 'priorityHigh',
  medium: 'priorityMedium',
  low: 'priorityLow',
});
export const WISHLIST_CURRENCIES = ['TWD', 'JPY', 'USD', 'CNY', 'HKD', 'KRW', 'EUR'];
export const DEFAULT_WISHLIST_CURRENCY = 'TWD';
export const WISHLIST_DEADLINE_SOON_DAYS = 7;

// The form enforces the same limits that backup import checks, so every saved entry can
// be restored from the app's own export.
export const WISHLIST_LIMITS = Object.freeze({
  maxLinks: 10,
  maxUrlLength: 2048,
  maxLinkLabelLength: 100,
  maxNameLength: 300,
  maxShopLength: 200,
  maxReleaseLength: 100,
  maxPrice: 1_000_000_000,
});

// Each chosen screenshot is decoded and re-encoded, so a batch is bounded in size and
// processed two at a time to keep memory use predictable on phones.
export const QUICK_ADD_LIMIT = 30;
export const QUICK_ADD_CONCURRENCY = 2;
