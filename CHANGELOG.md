# Changelog

All notable project changes are recorded here. This project follows the structure of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning
for published releases.

## [Unreleased]

## [0.5.0] - 2026-10-09

### Added

- Move to collection: a wishlist entry's page offers to move it into the collection once
  it arrives. The app first asks for a new photo, from the camera or the photo library,
  and keeps the wishlist photo when that step is skipped. The entry's name, price (with
  its currency code), and shop go into the item's notes, and the entry leaves the
  wishlist in the same save.
- The browser storage panel can be hidden to save space on small screens and shown again
  from a storage button in the header. It always shows when storage is nearly full.

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
