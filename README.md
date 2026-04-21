# ACG Merchandise Collector App

A local-first, mobile Progressive Web Application (PWA) designed to catalog Anime, Comic, and Gaming merchandise offline. 

## Features
- **Client-Side Operations**: 100% Client-side operation using IndexedDB via Dexie.js for data retention without loading screens.
- **Image Handling**: Capture and securely compress item photos automatically before storing them on your device.
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

## Limitations
- Operates totally offline securely, so cross-device syncs natively do not function without third party integrations.
- User imagery is compressed locally before storage in normal upload flows to reduce the database footprint, but overall storage can still grow with many photos. Native browser mechanisms are used for EXIF orientation handling, which may have edge cases on outdated devices.

## Documentation Reference
Check the local `docs/` folder for comprehensive implementation records:
- `handoff.md`: Primary reference manual.
- `architecture-decisions.md`: Extracted ADR history for storage & routing choices.
- `open-issues-tech-debt.md`: Upcoming pipelines and testing enhancements.
- `progress-summary.md`: Historical baseline stability records.
