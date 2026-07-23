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

## Publishing a release

Only maintainers publish releases. Choose the next semantic version, then:

1. Run `npm version patch --no-git-tag-version`, replacing `patch` with `minor` or
   `major` when appropriate.
2. Move completed entries from `Unreleased` into a dated heading such as
   `## [1.2.3] - 2026-07-23` in `CHANGELOG.md`.
3. Run all required checks, commit, and merge or push the release commit to `main`.
4. Create and push the matching tag:

   ```bash
   git tag -a v1.2.3 -m "Release v1.2.3"
   git push origin v1.2.3
   ```

The tag workflow verifies that the tag, package metadata, lockfile, changelog, tests, and
production build agree before it creates the GitHub Release. Do not reuse or move a
published version tag.

## Pull requests

- Explain the user-visible result and any data migration or privacy impact.
- Link related issues.
- Keep unrelated formatting and refactors out of the same pull request.
- Confirm that no sensitive data is present.
- By participating, follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
