# Architecture Decisions

## Local-First Storage
**Decision**: Store all merchandise item metadata and photos locally using IndexedDB (via Dexie.js).
**Context**: The application target audience shops at conventions, comic shops, and events where internet connectivity can be spotty or unreliable. 
**Choice**: IndexedDB combined with object URLs for photos, managed under a PWA caching strategy.
**Consequences**: Eliminates network latency, removes the need for user authentication or paid database clusters. However, restricts data syncing across multiple user devices natively unless import/export logic is specifically built.

## Database Schema Versioning
**Decision**: Did not migrate Dexie schema during refactoring.
**Context**: The app holds critical user data. Migrating the schema purely for stylistic database property naming changes runs a high risk of wiping IndexedDB entirely locally.
**Choice**: Retain `db.version(1)`.
**Consequences**: The project avoids creating accidental data-loss bugs, but limits the ability to rapidly restructure column sets.

## Validation Unified Approach
**Decision**: Use pure JavaScript validation logic and decouple from HTML validation.
**Context**: HTML's `required` attributes conflict tightly with "Either A or B required" constraint matching, producing confusing UI blockages.
**Choice**: Formally extract `validateItem(formData)` to pure functions and manage UI errors independently.
**Consequences**: Validation logic is now 100% covered by Vitest suites safely avoiding UI rendering overhead.

## Search/Filter Extraction
**Decision**: Extract search & index mapping out of `Home.jsx`.
**Context**: `Home.jsx` was highly coupled and generating truthiness syntax linting errors due to messy array combinations.
**Choice**: `filterUtils.js` containing `filterItems()` pure function.
**Consequences**: Removes UI from filtering pipeline, enables straightforward unit testing over complex matching scenarios.

## Object URL Lifecycle
**Decision**: Implement `useObjectUrl` hook.
**Context**: `URL.createObjectURL(file)` was happening mid-render loop. React re-renders were causing memory leaks in browser caches without `revokeObjectURL` called properly.
**Choice**: Wrapped creation in `useEffect` within a single hook that automatically fires the revoke destructor upon unmount.
**Consequences**: Intended to manage object URL lifecycles safely. Needed extraction of an `ItemCard` component so list rendering respects unmounting safely.

## Extractor Boundary (Web Crawler)
**Decision**: Delay integration of `web_crawler`.
**Context**: Incorporating external headless scripts into an offline-first PWA fundamentally changes the security permissions stack.
**Choice**: Exclude it from the main component loop for this phase.
**Consequences**: Maintains system purity and focus towards the base application cataloging feature.

## Image Compression
**Decision**: Implement asynchronous client-side canvas-mediated compression defaulting to `image/webp` dynamically.
**Context**: Heavy native phone photos (3MB-8MB) stored raw severely fragmented the `db.items` rendering the Dexie limits incredibly tight.
**Choice**: `createImageBitmap` natively respects EXIF rotation without WASM bloat. It passes payloads to an active canvas resized proportionately below `1600px`. Yielding `image/webp` explicitly preserves arbitrary Alpha/Transparency channels out of PNG uploads ensuring black-box voids don't happen.
**Consequences**: Safely keeps device quotas manageable entirely offline without an authentication or cloud backend hook. Allows original blob passthroughs upon render limits.
