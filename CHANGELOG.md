# Changelog

All notable project changes are recorded here. This project follows the structure of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning
for published releases.

## [Unreleased]

### Added

- Manage lists (管理分類), linked below the home page filters: add, rename, delete, and
  order the types, series, and characters that the collection and the wishlist share, by
  dragging, with Move up and Move down, or with Sort by name (A to Z in English, stroke
  order in Chinese). Renaming to a name the list has merges the two, and deleting a value
  that items use removes it from them after a confirmation that says how many use it.
  Filters and forms list the values in this order, and backups keep it.

### Changed

- Database schema version 5 adds a table for the saved orders; nothing else changes.
- The English item form names the built-in types the way the filters do, such as
  Figure/Statue instead of figure.

## [0.6.2] - 2026-11-12

### Fixed

- On a phone, the cards of a page seen for the first time stayed empty for half a minute
  or more: each card waited for a small copy of its photo, and the copies are made one at
  a time. A card now shows its photo at once, as before 0.6.0, and swaps in the small copy
  when it is ready. Leaving a page still lets go of its photos, so paging through a large
  collection does not build up memory again.

## [0.6.1] - 2026-11-11

### Fixed

- A backup of a large collection could not be saved on an iPhone: a file of many
  gigabytes is more than the share sheet can take, a ZIP backup stopped at 4 GB, and so
  did a photo over 10 MB. A large backup now comes in files of about 200 MB, made and
  saved one at a time, and the photos in it over 500 KB are made smaller, at most 1600 px
  on the longest side, the size new photos are stored at. To restore it, choose all of its
  files at once; the app says which are missing. A photo that cannot be made smaller is
  kept as it is, up to 30 MB, and a backup holds up to 20,000 items and as many wishlist
  entries, where it used to stop at 2,000. A backup that fits in one file works as before,
  and older backups still import.
- On iPhone, new photos were stored at full size, because Safari cannot make the WebP
  copies the app asked for. Where WebP cannot be made, photos are now compressed as JPEG.

## [0.6.0] - 2026-11-11

### Added

- Import album, in both the collection and the wishlist: choose up to 100 photos, in one
  or more rounds (for example one album at a time). Each photo starts as its own item;
  select the photos of one item and tap Merge (the first becomes the cover), split a
  merged item again, or leave photos out, then add them all in one step.
- Items and wishlist entries hold up to 10 photos. The first is the cover and can be
  changed; item and entry pages show the photos with thumbnails, and cards show how many
  there are.
- Collection items can be saved without a series, character, or type. They are marked
  Needs details, the home page counts them and can list only them, and the item page
  says what is missing with a button to fill it in.
- Swipe between items: on an item or wishlist entry page, swipe left or right, use the
  ‹ › buttons at the top, or press the arrow keys to go to the next or previous one, in the
  order and filters of the list it was opened from. Back still returns to the list.

### Changed

- Album import replaces the wishlist's quick add.
- Moving a wishlist entry into the collection can take several new photos, and keeps all
  of the entry's photos when the photo step is skipped.
- Database schema version 4 stores each record's photos as a list; an existing photo
  becomes the cover during the upgrade.
- A backup is now a ZIP archive (format version 5): backup.json holds the records, and
  each photo is an image file next to it, about a quarter smaller than a photo written
  into JSON. Restoring reads the photos straight from the file, so a large backup no
  longer has to fit in memory. JSON backups from earlier versions still import.
- On iPhone and iPad, a backup is saved through the share sheet once it is ready (tap
  Save, then Save to Files), and the app then names the file and says where to find it. The safety backup before an import is saved the same way,
  and if it is not saved, the app asks before replacing the current data.

### Fixed

- A large backup could not be saved or restored. The app warned that it was over the
  50 MB import limit, and after Continue, Safari often saved nothing, because the
  download's address was revoked the moment the download started. Imports also refused
  any file over 50 MB. Backups now have no such limit, and the download's address stays
  valid long enough to be saved. While a backup is being prepared or restored, the header
  now says so.
- Paging through a large collection or wishlist could crash the app on a phone. Each page
  of cards decoded 50 full-size photos, about 370 MB, and memory kept growing from page to
  page. Cards now show small copies, made once, one at a time, and kept in a separate cache
  that is not part of backups.

### Security

- Updated Vite to 6.4.5 and patched build-tool dependencies for new advisories. They
  affect the development server and build, not the published app.

## [0.5.0] - 2026-10-09

### Added

- Move to collection: a wishlist entry's page offers to move it into the collection once
  it arrives. The app first asks for a new photo, from the camera or the photo library,
  and keeps the wishlist photo when that step is skipped. The entry's name, price (with
  its currency code), and shop go into the item's notes, and the entry leaves the
  wishlist in the same save.
- The browser storage panel can be hidden to save space on small screens and shown again
  from a storage button in the header. It always shows when storage is nearly full.

### Changed

- Updated app libraries: React 19.3, React Router 7.18.4, Dexie 4.4.6, dexie-react-hooks 4.4,
  and lucide-react 1.52.
- Updated test tools: Playwright 1.63, axe 4.13, and Testing Library 16.3.3.
- GitHub Actions now use checkout v7 and setup-node v7, because the v4 versions target a
  deprecated Node.js release.

## [0.4.0] - 2026-10-08

### Added

- A wishlist for merchandise you want, kept apart from the collection. An entry needs
  only a photo, a name, or a link, and can also hold up to 10 shop links, a price and
  currency, the shop, an order deadline, the release time, a priority, a status (want or
  ordered), series, characters, a type, and notes.
- Quick add for the wishlist: choose up to 30 screenshots at once, and each becomes its
  own entry to complete later.
- Wishlist sorting by newest, order deadline, or priority, filters by status and
  priority, and search across names, shops, notes, and link labels and hosts. Order
  deadlines within 7 days are highlighted and passed ones are flagged until the entry is
  ordered.
- A wishlist section in the in-app guide and a wishlist links section in the privacy
  notice.
- Tests for the wishlist utilities, pages, card, backups, and translations, plus
  end-to-end coverage for wishlist entries with photos and links, quick add, backup round
  trips, importing an older backup, the version 2 database upgrade, offline wishlist
  pages, and wishlist accessibility.

### Changed

- Backups use version 3 and hold both the collection and the wishlist. Importing an older
  backup replaces only the collection and keeps the current wishlist; the confirmation
  says which applies. The safety backup made before an import includes the wishlist.
- The IndexedDB schema moves to version 3, which adds a separate wishlist table. Existing
  collections carry over unchanged.
- The collection and the wishlist share one header for language, backups, and storage.
- Development now requires Node.js 22.12–24, because the test runner moved from Vitest 3
  to Vitest 5.

### Fixed

- Opening an edit address with a non-numeric id, such as `/edit/abc`, returns to the
  collection instead of replacing the app with an error screen.
- Updated development dependencies to clear critical and high-severity advisories
  reported by `npm audit` in tinypool, source-map-js, brace-expansion, fast-uri, and
  js-yaml. Runtime dependencies were not affected.

## [0.3.0] - 2026-08-26

### Added

- A not-found page for unknown addresses, replacing the blank screen that the SPA
  rewrite produced.
- An export warning when a collection would produce a backup larger than the import
  limit, so an oversized backup is a deliberate choice rather than a surprise at restore
  time.
- Tests for the collection card, error boundary, value helpers, multi-select keyboard
  behavior, and the not-found page, plus end-to-end coverage for unknown addresses,
  directly opened edit pages, custom types, type search, and filter recovery.
- A WebKit end-to-end project covering the iOS Safari path, beside the existing Chromium
  project that keeps the offline service-worker check.

### Changed

- Series, character, and merchandise-type values that differ only by letter case or
  padding are now treated as one category in filters, filter options, and search.
- Search also matches the merchandise type, by stored value and by translated label.
- A filter whose value no longer exists in the collection returns to "all" instead of
  leaving an empty gallery.
- Saving, cancelling, and going back from an item or edit page now navigate to an
  explicit destination, so a directly opened `/edit/:id` no longer exits the app.
- Editing an item now waits for the type list before choosing between the type dropdown
  and the free-text field, so an existing custom type stays selected in the dropdown.

### Fixed

- Updated dependencies to clear six high-severity and one moderate advisory reported by
  `npm audit`, including the React Router CSRF advisory.

## [0.2.0] - 2026-07-23

### Added

- Browser storage usage, capacity warnings, and an opt-in persistent-storage request.
- Collection pagination with 50 items per page.
- Accessible in-app dialogs, keyboard-operable collection cards and photo controls,
  visible focus styles, and reduced-motion support.
- Error boundary and explicit item-not-found state.
- Playwright end-to-end coverage for CRUD, backup restore, offline startup, and
  service-worker update checks.
- Public support, contribution, conduct, browser-support, and schema documentation.
- Bilingual in-app user guide covering collection management, browser storage, app
  updates, JSON backups, installation, offline use, and feedback.
- A single-source semantic version system, visible App version link, release validation,
  and automatic GitHub Releases for version tags.

### Changed

- Backup import validates file size, item count, field limits, decoded image size,
  raster MIME type, and image signatures.
- Backup photo serialization and rehydration use bounded concurrency.
- Import downloads an automatic safety backup before replacing a non-empty collection.
- Destructive and error flows no longer depend on browser `alert()` or `confirm()`.
- Language selector spacing prevents its label from overlapping the dropdown arrow.

## [0.1.4] - 2026-07-23

### Added

- Public-release policy, security, privacy, license, and third-party notice files.
- Traditional Chinese README and installation guide.
- Vercel production deployment and release verification.

### Security

- Removed leaked Git history and rotated public repository history before publication.
