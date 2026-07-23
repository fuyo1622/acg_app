# ACG Merchandise Collector App

A local-first, mobile Progressive Web Application (PWA) designed to catalog Anime, Comic, and Gaming merchandise offline.

Live app: [https://acg-app-steel.vercel.app/](https://acg-app-steel.vercel.app/)

For the current canonical project spec, see [`docs/project-spec.md`](docs/project-spec.md). For mobile installation steps, see [`docs/install-guide.md`](docs/install-guide.md).

For the current Traditional Chinese iPhone/Vercel deployment and hands-on test procedure, see [`docs/iphone-vercel-testing-guide.zh-TW.md`](docs/iphone-vercel-testing-guide.zh-TW.md).

For public-release readiness and the prioritized checklist, see [`docs/public-release-readiness.zh-TW.md`](docs/public-release-readiness.zh-TW.md). Privacy and security policies are available in [`PRIVACY.md`](PRIVACY.md) and [`SECURITY.md`](SECURITY.md).

Source code is released under the [`MIT License`](LICENSE). Application asset provenance is documented in [`ASSETS.md`](ASSETS.md), and production dependency notices are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Features
- **Client-Side Operations**: Local client-side storage using IndexedDB via Dexie.js.
- **Image Handling**: Capture or choose item photos and compress new image files before storing them on your device.
- **Offline Backup**: Export your collection as a single portable JSON file, and import it back with a replace-style restore flow.
- **Installable PWA**: Install from supported mobile browsers for home screen access.
- **Querying**: Multi-dimensional filtering attributes for searching specific owned items.
- **Bilingual Context**: Switch dynamically between Traditional Chinese (`zh-TW`) and English.

## Tech Stack
- React 19
- Vite
- Dexie + IndexedDB
- React Router 
- vite-plugin-pwa

## Project Scripts
1. **`npm install`**: Prepare local environment context.
2. **`npm run dev`**: Execute live server at `localhost:5173`.
3. **`npm run build`**: Assemble standard production assets locally into `/dist`.
4. **`npm run lint`**: Trigger ESLint configuration pipelines against `/src`.
5. **`npm test`**: Initiate internal logic regressions via Vitest.
6. **`npm run check`**: Run lint, tests, and the production build.
7. **`npm run notices`**: Regenerate production third-party license notices.
8. **`npm run audit`**: Check dependencies against npm's current advisory database.

## Limitations
- Operates locally without built-in cross-device sync. Moving data between devices currently requires manual export/import.
- User imagery is compressed locally before storage in normal upload flows to reduce the database footprint, but overall storage can still grow with many photos. Native browser mechanisms are used for EXIF orientation handling, which may have edge cases on outdated devices.

## Documentation Reference
Check the local `docs/` folder for comprehensive implementation records:
- `project-spec.md`: Canonical current project spec.
- `install-guide.md`: Android Chrome and iOS Safari PWA installation guide.
- `iphone-vercel-testing-guide.zh-TW.md`: Traditional Chinese Vercel deployment, iPhone installation, and stage acceptance test guide.
- `handoff.md`: Practical reference manual for future agents/developers.
- `architecture-decisions.md`: Extracted ADR history for storage & routing choices.
- `open-issues-tech-debt.md`: Upcoming pipelines and testing enhancements.
- `progress-summary.md`: Historical baseline stability records.
