# Changelog

All notable project changes are recorded here. This project follows the structure of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning
for published releases.

## [Unreleased]

### Added

- Browser storage usage, capacity warnings, and an opt-in persistent-storage request.
- Collection pagination with 50 items per page.
- Accessible in-app dialogs, keyboard-operable collection cards and photo controls,
  visible focus styles, and reduced-motion support.
- Error boundary and explicit item-not-found state.
- Playwright end-to-end coverage for CRUD, backup restore, offline startup, and
  service-worker update checks.
- Public support, contribution, conduct, browser-support, and schema documentation.

### Changed

- Backup import validates file size, item count, field limits, decoded image size,
  raster MIME type, and image signatures.
- Backup photo serialization and rehydration use bounded concurrency.
- Import downloads an automatic safety backup before replacing a non-empty collection.
- Destructive and error flows no longer depend on browser `alert()` or `confirm()`.

## [0.1.4] - 2026-07-23

### Added

- Public-release policy, security, privacy, license, and third-party notice files.
- Traditional Chinese README and installation guide.
- Vercel production deployment and release verification.

### Security

- Removed leaked Git history and rotated public repository history before publication.
