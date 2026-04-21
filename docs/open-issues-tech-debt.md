# Open Issues and Tech Debt

## Testing Gaps
- **Title**: React Component Integration Tests Extensibility
- **Affected Files**: `src/pages/AddEditItem.jsx`, `src/pages/Home.jsx`
- **Why It Matters**: While business logic is perfectly covered, component-level rendering behaviors are not checked for false positives. React Router mappings can break unexpectedly.
- **Recommended Next Step**: Utilize `@testing-library/react` and `jsdom` configuration to perform snapshot and smoke mapping routines across Core components.
- **Priority**: Medium

## DB/Data-Model Caveats
- **Title**: Synchronous Storage Capacity Limits on IndexedDB Array Iterations
- **Affected Files**: `src/services/db.js`, `src/pages/Home.jsx`
- **Why It Matters**: The Home Page currently live queries `db.items.orderBy('created_at').reverse().toArray()`. If collection sizes push 1,000+ heavily populated blobs, RAM spike renders can happen upon querying the entire data set before filtering occurs.
- **Recommended Next Step**: Shift dexie indexing to execute filtering BEFORE creating the javascript array (utilizing deeper `.where()` logic instead of doing it mostly client side).
- **Priority**: Medium

## PWA / Deployment Caveats
- **Title**: Asset Manifest Precision
- **Affected Files**: `vite.config.js`
- **Why It Matters**: High resolution caching might override device quotas limiting OS operations aggressively. The maximumFileSizeToCacheInBytes is set generously to `15MB`.
- **Recommended Next Step**: Verify actual service worker payload sizes on mobile emulation.
- **Priority**: Low

## Database Constraints
- **Title**: Base64 JSON Payload Inflation
- **Affected Files**: `src/utils/backupUtils.js`
- **Why It Matters**: To ensure totally offline user portability across basic hardware without massive backend systems, Database Exports natively encode raw Image Blobs directly into Base64 representations dynamically nested inside single `.json` files. This artificially spikes memory signatures dynamically (up to 30%) over standard dual-binary schemas natively increasing system thresholds temporally upon executing Array Hydration bounds.
- **Recommended Next Step**: In future scaling scopes pushing deeply over standard quotas, explore splitting `dexie-export-import` binary `.ndjson` dependencies dynamically.
- **Priority**: Low
