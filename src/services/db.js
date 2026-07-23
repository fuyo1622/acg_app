import Dexie from 'dexie';
import { toValueArray } from '../utils/valueUtils';

export const DB_NAME = 'acg-merch-db';
export const DB_SCHEMA_VERSION = 2;

export function migrateItemToV2(item) {
  item.series = toValueArray(item.series);
  item.character = toValueArray(item.character);
  return item;
}

export const db = new Dexie(DB_NAME);

// Define database schema
db.version(1).stores({
  // ++id gives auto-incrementing primary key
  // other keys are indexed for filtering
  items: '++id, series, character, merchandise_type, created_at, updated_at'
});

db.version(DB_SCHEMA_VERSION).stores({
  items: '++id, *series, *character, merchandise_type, created_at, updated_at'
}).upgrade(transaction => transaction.table('items').toCollection().modify(migrateItemToV2));
