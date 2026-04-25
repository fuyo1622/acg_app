# Project Spec: ACG Merchandise Collector

## Product goal
ACG Merchandise Collector is a local-first web app for cataloging Anime, Comic, and Games merchandise. The core job is to help a user quickly check what they already own, especially while shopping at events, stores, or conventions where network access may be unreliable.

The current product is an offline-capable MVP focused on manual collection management on one device, with manual backup and restore for portability.

## Target user / usage context
- A collector of ACG merchandise such as figures, plushes, acrylic stands, badges, apparel, posters, and other related goods.
- A mobile-first user who may open the app while outside, compare a potential purchase against their existing collection, and avoid duplicate purchases.
- A user who values local ownership of data over account-based sync or cloud storage.

## Current feature set
- PWA shell built with React 19 and Vite.
- Installable PWA metadata and service worker generation through `vite-plugin-pwa`.
- Local IndexedDB persistence through Dexie.
- Home gallery view with item cards.
- Search by series, character, or notes.
- Filter by merchandise type, series, and character.
- Add item flow with optional photo, series, character, merchandise type, and notes.
- Edit item flow for existing records.
- Delete item flow from the edit page.
- Item detail page with larger photo and metadata display.
- Language switching between English and Traditional Chinese keys.
- Client-side image compression before storing newly selected photos.
- Object URL lifecycle handling for Blob-backed images in list/detail rendering.
- Manual JSON export and import backup actions.
- Replace-style import that clears existing items and bulk-adds imported items after validation and confirmation.
- ESLint, production build, and Vitest test baselines.

## Current non-goals
- No user accounts, authentication, cloud backend, or hosted sync.
- No multi-device automatic synchronization.
- No remote image storage.
- No schema migration beyond the current Dexie version 1 schema.
- No automated web crawling in the main app flow.
- No heavy browser E2E framework in the current test baseline.
- No product feature work implied by this spec document.

## Core user flows
- **Browse collection**: Open `/`, view items in reverse creation order, scan photo cards, and use filters or text search to narrow the gallery.
- **Add item**: Open `/add`, optionally choose or capture a photo, enter at least a series or character, choose a merchandise type, add optional notes, and save to IndexedDB.
- **View detail**: Open `/item/:id` from the gallery to see the item photo, title fields, type, notes, and creation date.
- **Edit item**: Open `/edit/:id`, adjust metadata, optionally replace or clear the photo, and save changes.
- **Delete item**: Use the delete action on the edit page and confirm deletion.
- **Export backup**: Use the Home export action to download a single JSON file containing metadata and photo Data URLs.
- **Import backup**: Use the Home import action to choose a JSON backup file, validate it, confirm replacement, rehydrate photos to Blobs, clear current items, and bulk-add the imported items.
- **Switch language**: Use the language selector on Home to switch labels between `en` and `zh-TW`.

## Data model overview
The current IndexedDB database is named `acg-merch-db` and is defined in `src/services/db.js`.

Dexie schema version 1 contains a single `items` table:

```text
++id, series, character, merchandise_type, created_at, updated_at
```

The effective item shape used by the app is:

- `id`: auto-incremented primary key.
- `series`: string, optional as long as `character` is present.
- `character`: string, optional as long as `series` is present.
- `merchandise_type`: required string, usually one of the default types or a user-entered custom type.
- `notes`: optional string.
- `photo`: optional Blob/File-like image payload stored in IndexedDB.
- `created_at`: Date set when an item is created.
- `updated_at`: Date set when an item is saved.

## Storage and local-first constraints
- All app data is stored locally in the browser through IndexedDB.
- The app does not require a backend to add, view, edit, delete, export, or import collection data.
- IndexedDB quota behavior varies by browser and device. Large collections with many photos may encounter storage or memory limits.
- Home currently reads the item table into an array before client-side search and filtering, which is practical for the MVP but may need pagination or Dexie-level filtering for larger collections.
- PWA caching supports offline app loading, but data durability still depends on the browser retaining site storage.

## PWA installability behavior
- The app is intended to be installable as a PWA from supported mobile browsers.
- Android installation is through the browser install prompt or **Add to Home screen** / **Install app** browser menu action.
- iOS installation uses Safari's **Add to Home Screen** flow.
- Installability depends on production HTTPS hosting, a valid web app manifest, generated service worker files, and browser-specific install criteria.
- The iOS touch icon is `public/apple-touch-icon.png`, a 180x180 PNG derived from the existing PWA icon asset.
- The current Vite config does not set `base`. This is suitable for root deployments. If the app is deployed to GitHub Pages under `/acg_app/`, `base: '/acg_app/'` may be needed, but the deployment target should be confirmed before changing it.

## Image handling behavior
- New image selections pass through `compressImage` before storage when the selected photo is a `File`.
- Compression skips non-image inputs and small files below the configured threshold.
- Larger images are decoded through `createImageBitmap` when available, with a fallback image element path.
- Images are resized within `1600x1600` bounds and exported with the preferred `image/webp` MIME type when that produces a smaller result.
- If decoding, canvas access, or export fails, the original file is retained rather than blocking the save.
- Restored backup images are rehydrated as `Blob` values. The edit flow does not recompress an existing restored Blob unless the user selects a new File.
- Display paths use object URLs and the `useObjectUrl` hook revokes URLs on cleanup to reduce browser-side object URL retention.

## Backup / restore behavior
- Export serializes current items into a JSON payload with a backup `version`, `timestamp`, and `items`.
- Blob photos are encoded as `data:image/...` Data URLs in the JSON file.
- Import parses JSON, validates the backup version and item shape, asks for confirmation, rehydrates Data URLs back to Blobs, then replaces the entire local `items` table inside a Dexie transaction.
- Malformed backups are rejected before the DB replacement path is called.
- The replace-style import avoids duplicate merge behavior, but it is destructive to the current local collection after confirmation.
- Base64 Data URLs make backups portable as a single file, but increase file size and memory use compared with binary export formats.

## i18n behavior
- The app uses `LanguageContext` and local translation dictionaries rather than an external i18n library.
- Supported language keys are `en` and `zh-TW`.
- The selected language is stored in `localStorage` under `appLang`.
- Labels and validation alerts use translation keys through `t(key)`.
- Existing translations should be treated as app content. Any encoding issue should be verified in the running app before being documented as a current bug.

## Testing baseline
- The repo uses Vitest with the configured `jsdom` environment.
- Existing pure utility tests cover validation, filtering, backup payload validation, and image compression fallback behavior.
- Existing component smoke tests cover:
  - Home empty state and mocked item rendering.
  - Backup export/import action presence and hidden file input wiring.
  - Malformed backup rejection without DB replacement.
  - Add form render, invalid submit blocking, and valid mocked DB add.
  - Editing a restored Blob-backed item without triggering unintended recompression.
- The project intentionally uses existing Testing Library dependencies and does not include a heavy E2E framework.

## Documentation map
- `docs/project-spec.md`: Canonical current project spec.
- `README.md`: Entry point with feature summary, commands, and doc links.
- `docs/install-guide.md`: User-facing Android/iOS installation steps and manual PWA verification checklist.
- `docs/handoff.md`: Practical handoff for future agents/developers.
- `docs/architecture-decisions.md`: Historical architecture decisions and tradeoffs.
- `docs/open-issues-tech-debt.md`: Known technical debt and future risk areas.
- `docs/progress-summary.md`: Historical summary of recent stabilization work.

## Known limitations
- No cloud sync or multi-device conflict resolution.
- Import is replace-only and can overwrite local data after confirmation.
- Backup files can become large because photos are embedded as Base64 Data URLs.
- Large collections may strain memory because Home currently loads all items before filtering.
- Browser storage policies can evict local data in some conditions, depending on browser and platform.
- The `web_crawler/` directory is not part of the core app runtime and should be treated as non-core historical or experimental tooling unless a future task explicitly integrates it.
- Component smoke tests do not replace manual checks for full PWA install/offline behavior.

## Future roadmap
- Add pagination or IndexedDB-level filtering for larger collections.
- Explore more scalable backup formats if collections with many photos become common.
- Improve backup UX around replace warnings and post-import reporting.
- Add focused component tests for Item Detail and delete behavior.
- Verify PWA caching and storage behavior on representative mobile browsers.
- Consider storage quota messaging if image-heavy collections become a common support issue.
- Keep `web_crawler/` separate unless there is a clear product decision to support import automation.
