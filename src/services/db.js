import Dexie from 'dexie';

export const db = new Dexie('acg-merch-db');

// Define database schema
db.version(1).stores({
  // ++id gives auto-incrementing primary key
  // other keys are indexed for filtering
  items: '++id, series, character, merchandise_type, created_at, updated_at'
});
