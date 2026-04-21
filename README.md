# ACG Merchandise Collector App

A local-first, mobile Progressive Web Application (PWA) designed to gracefully catalog Anime, Comic, and Gaming merchandise effortlessly offline. 

## Features
- **Zero-Latency**: 100% Client-side operation using IndexedDB via Dexie.js for immediate, snappy data retention without loading screens.
- **Image handling**: Capture and curate item photos securely on your device natively.
- **Complex Querying**: Fast multi-dimensional filtering attributes for hunting exactly what is owned mid-convention.
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
- User imagery is stored unmodified directly into IndexedDB, preserving original fidelity but rapidly inflating database size footprints depending upon camera settings.

## Documentation Reference
Check the local `docs/` folder for comprehensive implementation records:
- `handoff.md`: Primary reference manual.
- `architecture-decisions.md`: Extracted ADR history for storage & routing choices.
- `open-issues-tech-debt.md`: Upcoming pipelines and testing enhancements.
- `progress-summary.md`: Historical baseline stability records.
