# Contributing

Thanks for helping improve ACG Merchandise Collector.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue before a large feature or data-schema change so the approach can be
   discussed.
3. Do not include real collection backups, private photos, credentials, or generated
   build output.

## Local setup

Requirements: Node.js 20.19–24 and npm.

```bash
npm install
npm run dev
```

Create a focused branch, keep user-facing copy available in both English and Traditional
Chinese, and add tests for behavioral changes.

## Required checks

```bash
npm run check
npm run test:e2e
npm run verify:release
npm run audit
```

The first E2E run may require:

```bash
npx playwright install chromium
```

If a change adds or upgrades a dependency, run `npm run notices` and commit both generated
notice files. If it changes the IndexedDB shape, increment `DB_SCHEMA_VERSION`, add a Dexie
migration, and test legacy data conversion.

## Pull requests

- Explain the user-visible result and any data migration or privacy impact.
- Link related issues.
- Keep unrelated formatting and refactors out of the same pull request.
- Confirm that no sensitive data is present.
- By participating, follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
