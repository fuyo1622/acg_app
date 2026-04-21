# Handoff Document: ACG Merchandise App

## Project Purpose
This is a local-first web application designed for mobile devices. Its main goal is to allow users to catalog their ACG (Anime, Comic, Games) merchandise easily. The app provides a quick way to check your collection when shopping outdoors, preventing duplicate purchases by pairing photos with lightweight searchable metadata.

## Architecture & Stack
- **Framework**: React 19 + Vite
- **Routing**: React Router (`react-router-dom`)
- **Storage**: IndexedDB managed via Dexie.js (`dexie` + `dexie-react-hooks`)
- **PWA**: `vite-plugin-pwa` for offline caching and installation capabilities
- **Design System**: Vanilla CSS with modern standard custom properties

## Core App Flows
- **Home (`/`)**: Displays the collection as a grid, handles multi-dimensional filtering (text search, series dropdown, character dropdown, type dropdown), and provides language switching.
- **Add/Edit Item (`/add`, `/edit/:id`)**: Form capturing item details including photo (via camera/gallery), series, character, type, and optional notes.
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
- **Testing**: Added a `vitest` suite for all extracted pure JS.

## What Was Intentionally Left Alone
- **Dexie Schema**: Kept identical to prevent migration complexity. 
- **web_crawler/**: Remained entirely outside the scope of this baseline fix, as it is non-core to the offline cataloging experience directly.
- **Sync/Auth**: Still intentionally absent. The system is designed to be 100% offline-first.

## Next Recommended Steps
- Consider expanding the `useObjectUrl` capabilities into indexed DB blobs if user storage exceeds generic IndexedDB quotas on iOS devices.
- Start incorporating lightweight component-level integration tests (`@testing-library/react`) beyond just the pure utilities when complexity increases.
