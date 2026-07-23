# ACG Merchandise Collector

[English](README.md) | [繁體中文](README.zh-TW.md)

A local-first Progressive Web App (PWA) for cataloging Anime, Comic, and Gaming merchandise.

Live app: [https://acg-app-steel.vercel.app/](https://acg-app-steel.vercel.app/)

## Features

- Store collection data and photos locally with IndexedDB.
- Add, edit, delete, search, and filter merchandise records.
- Capture or select photos and compress large images before storage.
- Export the collection to one JSON backup and restore it later.
- Install from Android Chrome or iOS Safari and reopen the cached app shell offline.
- Switch between Traditional Chinese and English.

## Install

### Android Chrome

1. Open the [production app](https://acg-app-steel.vercel.app/) in Chrome.
2. Open the Chrome menu.
3. Choose **Install app** or **Add to Home screen**.
4. Launch **ACG** from the home screen or app drawer.

### iPhone / iPad Safari

1. Open the [production app](https://acg-app-steel.vercel.app/) in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**, then **Add**.
4. Launch **ACG** from the home screen.

Open the app online once before testing offline mode. Collection data belongs to the browser and domain where it was created; export a backup before clearing site data, changing devices, or switching production domains. See the [detailed install and troubleshooting guide](docs/install-guide.md).

## Development

Requirements: Node.js 20.19–24 and npm.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run check
npm run verify:release
npm run audit
```

`npm run check` runs ESLint, 28 Vitest tests, and the production build.

## Architecture and limitations

- React 19, Vite, React Router, Dexie, and `vite-plugin-pwa`.
- No account, backend, cloud sync, or server-side copy of collection data.
- Backup import replaces the current local collection after confirmation.
- Browser storage policies can remove local data; keep exported backups.

## Documentation

See the [documentation index](docs/README.md), [privacy policy](PRIVACY.md), [security policy](SECURITY.md), [asset provenance](ASSETS.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

## License

Released under the [MIT License](LICENSE).
