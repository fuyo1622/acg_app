# Changelog

All notable project changes are recorded here. This project follows the structure of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning
for published releases.

## [Unreleased]

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
