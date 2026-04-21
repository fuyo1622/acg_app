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

## Hardware Limitations
- **Title**: Native Canvas EXIF Reorientation Fragmentation
- **Affected Files**: `src/utils/imageUtils.js`
- **Why It Matters**: While modern browsers respect EXIF tags natively when decoding buffers via `createImageBitmap({ imageOrientation: 'from-image' })`, some outdated clients might ignore orientation properties silently when exporting `image/webp`.
- **Recommended Next Step**: Wait for older hardware cycles to pass.
- **Priority**: Low
