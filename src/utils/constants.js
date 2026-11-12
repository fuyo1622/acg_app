export const DEFAULT_TYPES = [
  'figure', 
  'plush', 
  'acrylic', 
  'badge', 
  'apparel', 
  'poster', 
  'other'
];

// Version 3 added the wishlist section, version 4 several photos per record, version 5
// made a backup a ZIP archive with the photos as image files, and version 6 splits a large
// backup into several such archives, its parts. Older backups are JSON files, contain only
// the collection before version 3, and at most one photo per record before 4.
export const BACKUP_VERSION = 6;
export const WISHLIST_BACKUP_VERSION = 3;
export const PARTED_BACKUP_VERSION = 6;

// A backup is saved in parts of about this size, so no file has to be made whole at once.
// On an iPhone or iPad a part goes to the share sheet, and Safari first reads the whole file
// into memory, twice: a 200 MB part was too much for an iPhone, so there parts are smaller,
// and a part the share sheet still cannot take is made again at half the size, down to
// BACKUP_MIN_PART_BYTES. Photos larger than BACKUP_SHRINK_PHOTO_BYTES are shrunk to the size
// the app stores new photos at, which keeps the parts few.
export const BACKUP_PART_BYTES = 200 * 1024 * 1024;
export const BACKUP_SHARE_PART_BYTES = 100 * 1024 * 1024;
export const BACKUP_MIN_PART_BYTES = 10 * 1024 * 1024;
export const BACKUP_SHRINK_PHOTO_BYTES = 500 * 1024;

export const BACKUP_LIMITS = Object.freeze({
  // A JSON backup from before version 5 is read into memory whole, an archive is not.
  maxFileBytes: 200 * 1024 * 1024,
  maxArchiveBytes: 2 * 1024 * 1024 * 1024,
  maxDataBytes: 50 * 1024 * 1024,
  // A collection stored for years can pass a few thousand items; a backup in parts
  // reads one part at a time, so the records themselves are what this bounds.
  maxItems: 20000,
  maxValuesPerField: 50,
  maxValueLength: 200,
  maxTypeLength: 100,
  maxNotesLength: 5000,
  // Photos are made smaller for a backup, but one that cannot be is kept as it is,
  // and a full-size photo from a recent phone camera can pass 10 MB.
  maxPhotoBytes: 30 * 1024 * 1024,
  maxPhotosPerRecord: 10,
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

// Each photo chosen for an album import is decoded and re-encoded, so an import is
// bounded in size and photos are processed two at a time to keep memory use predictable
// on phones.
export const ALBUM_IMPORT_LIMIT = 100;
export const PHOTO_PROCESSING_CONCURRENCY = 2;
