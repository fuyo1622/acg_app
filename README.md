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

Open the app online once before testing offline mode. Collection data belongs to the browser and domain where it was created; export a backup before clearing site data, changing devices, or switching production domains.

## Updates, browser storage, and backups

- Collection data and photos remain in IndexedDB across normal app, cache, and service-worker
  updates when the same domain, device, browser, and browser profile are used.
- A normal app release does not require exporting or re-importing JSON. Tested database
  migrations preserve data when the schema changes.
- JSON is a recovery backup, not an update mechanism. Export periodically and before
  clearing site data, changing device, browser, or production domain, or installing a
  major release.
- **Protect local data** requests persistent browser storage and can reduce automatic
  eviction, but it cannot protect against manual deletion, device damage, or loss.
- Backup files may contain collection data, notes, and photos. Store them privately
  outside the browser.

## Development

Requirements: Node.js 20.19–24 and npm.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run check
npm run test:e2e
npm run verify:release
npm run audit
```

`npm run check` runs ESLint, the Vitest suite, and the production build.
`npm run test:e2e` builds the app and runs the Chromium end-to-end suite. On the first run,
install its browser with `npx playwright install chromium`.

## Architecture and limitations

- React 19, Vite, React Router, Dexie, and `vite-plugin-pwa`.
- IndexedDB database `acg-merch-db` currently uses schema version 2. The canonical value
  is `DB_SCHEMA_VERSION` in `src/services/db.js`; every schema change must add a tested
  Dexie migration and increment that value.
- No account, backend, cloud sync, or server-side copy of collection data.
- Backup import replaces the current local collection after confirmation and downloads a
  safety backup first when the current collection is not empty.
- Browser storage policies can remove local data; keep exported backups.

## Browser support

- Core features: the current and previous major releases of Chrome, Edge, Firefox, and
  Safari.
- Install and offline PWA flows are continuously tested in Chromium. iPhone and iPad
  installation depends on Safari's **Add to Home Screen** behavior.
- Persistent-storage permission and quota estimates are browser decisions; denial does
  not prevent normal use, but regular exports remain necessary.
- Private browsing and embedded in-app browsers are not supported for long-term storage.

## Support and feedback

Use the bilingual [feedback form](https://tally.so/r/KYNy7M) for usage questions,
bug reports, or feature suggestions. No GitHub account is required. GitHub users may
also open a [GitHub issue](https://github.com/fuyo1622/acg_app/issues).

Do not upload JSON backups, private collection photos, passwords, or other sensitive
data. Report security vulnerabilities through the process in [SECURITY.md](SECURITY.md),
not through the public form or a public issue.

## Project information

See [support](SUPPORT.md), [changelog](CHANGELOG.md), [contributing](CONTRIBUTING.md),
[code of conduct](CODE_OF_CONDUCT.md), [privacy](PRIVACY.md), [security](SECURITY.md),
[asset provenance](ASSETS.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

## License

Released under the [MIT License](LICENSE).
