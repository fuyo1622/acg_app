# Handoff Document: ACG Merchandise App

## Project Purpose
This is a local-first web application designed for mobile devices. Its main goal is to allow users to catalog their ACG (Anime, Comic, Games) merchandise easily. The app provides a quick way to check your collection when shopping outdoors, preventing duplicate purchases by pairing photos with lightweight searchable metadata.

For the canonical current project spec, start with `docs/project-spec.md`. For Android/iOS installation instructions, see `docs/install-guide.md`. This handoff is a practical companion focused on implementation context.

## Architecture & Stack
- **Framework**: React 19 + Vite
- **Routing**: React Router (`react-router-dom`)
- **Storage**: IndexedDB managed via Dexie.js (`dexie` + `dexie-react-hooks`)
- **PWA**: `vite-plugin-pwa` for offline caching and installation capabilities
- **Design System**: Vanilla CSS with modern standard custom properties

## PWA Install Notes
- `vite.config.js` defines the generated manifest and service worker behavior through `vite-plugin-pwa`.
- `index.html` contains the favicon, theme color, and iOS home screen metadata.
- The current Vite config does not set `base`. Keep that for root deployments; consider `base: '/acg_app/'` only if the confirmed production target is GitHub Pages under that subpath.
- Manual Android/iOS install checks are listed in `docs/install-guide.md`.

## Core App Flows
- **Home (`/`)**: Displays the collection as a grid, handles multi-dimensional filtering (text search, series dropdown, character dropdown, type dropdown), and provides language switching.
- **Add/Edit Item (`/add`, `/edit/:id`)**: Form capturing item details including photo (via camera/gallery), multi-value series and characters with filtered in-form dropdowns, type, and optional notes.
- **Item Detail (`/item/:id`)**: Full-screen view of a specific merchandise item's photo and exact details.

## Important Files
- `src/services/db.js`: Contains the Dexie database initialization and schema configuration. Data boundary logic resides here.
- `src/pages/Home.jsx`: The main view and search mechanism.
- `src/pages/AddEditItem.jsx`: Core data-entry loop and offline image capture component.
- `src/contexts/LanguageContext.jsx`: Handles simple but effective i18n without heavy libraries.

## Setup and Commands
- `npm install`: Install dependencies.
- `npm run dev`: Boot local development server.
- `npm run build`: Compile for production.
- `npm run lint`: Run ESLint.
- `npm test`: Run Vitest suite.

## What Was Refactored Recently
- **Validation**: Replaced inline mixed constraints with pure utility logic. `HTML required` was dropped for dynamic JS validation requiring *at least* part of a name or series.  
- **Filter logic**: Decoupled from `Home.jsx` into pure util `filterUtils.js`. 
- **Object URLs**: Refactored to manage memory lifecycles via `useObjectUrl.js` custom hook, designed to ensure `URL.revokeObjectURL()` fires when components unmount.
- **Compression**: Asynchronous browser-native compression automatically runs via `imageUtils.js` capping max dimensions natively against uploaded files prior to IndexedDB writes.
- **Backup & Restore**: Manual export/import logic is organized in pure helper payload functions (`backupUtils.js`). Import validates the payload, asks for confirmation, rehydrates image Data URLs, and then replaces the local item table.
- **Testing**: Added Vitest coverage for extracted pure JS utilities plus lightweight component smoke tests for Home and Add/Edit flows.

## What Was Intentionally Left Alone
- **Dexie Schema**: Kept identical to prevent migration complexity. 
- **web_crawler/**: Remained entirely outside the scope of this baseline fix, as it is non-core to the offline cataloging experience directly.
- **Sync/Auth**: Still intentionally absent. The system is designed around local-first offline use.

## Next Recommended Steps
- Consider Dexie-level filtering or pagination if collection size makes full-table Home reads expensive.
- Add focused component smoke tests for Item Detail and delete behavior when those areas change.
