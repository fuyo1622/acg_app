export const DEFAULT_TYPES = [
  'figure', 
  'plush', 
  'acrylic', 
  'badge', 
  'apparel', 
  'poster', 
  'other'
];

export const BACKUP_VERSION = 2;

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
