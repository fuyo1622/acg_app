# ACG App Progress Summary

For the canonical current project spec, see `docs/project-spec.md`. This file remains a historical progress summary.
For current Android/iOS installation steps and manual PWA checks, see `docs/install-guide.md`.

## Recent Additions (Backup & Restore Pipelines)
- **JSON Payload Generation**: Separated pure logic boundaries (`backupUtils.js`) for generating single-file offline backup structures.
- **Micro-transaction Replacements**: Structured validation and confirmation before `fetch(dataURL)` Blob rehydration and replace-style DB writes.
- **Asynchronous Compression**: Re-encoded larger image files through Promise-based `compressImage` utilities dynamically resizing beneath `1600px`.
- **Canvas Decoding**: Used `createImageBitmap` to preserve image orientation while reducing canvas decode risk.
- **Double-submit Block**: Overhauled `<AddEditItem />` to disable redundant commits while canvas processing loads.
- **Component Smoke Coverage**: Added Vitest/Testing Library checks for Home rendering, backup import controls, malformed import rejection, add-item submit behavior, and restored Blob-backed edit saves.
- **PWA Install Documentation**: Added installability metadata cleanup and Android/iOS installation guidance with manual verification checks.

## Previous State
- App had inconsistent validation behavior mixing HTML `required` attributes and JavaScript error alerts.
- Linter baseline had missing dev-dependencies.
- Unmanaged `URL.createObjectURL` generation existed during list-view renders without destructors.
- Merchandise categories were duplicated inside `Home.jsx` and `AddEditItem.jsx`.
- Filtering logic resided entirely within main UI payload hooks.
- No automated unit tests existed.
- Lacked core documentation on operation or constraints.

## Task Completion Results
- **Configuration**: ESLint environment restored correctly via updating `globals` config arrays and `reactHooks` plugin configurations.
- **Validation**: Handled consistently via pure functional `validationUtils.js` using localization keys.
- **Filtration Engine**: Uncoupled via testable methods.
- **Memory Relief**: Extracted `ItemCard.jsx` executing the newly formed `useObjectUrl.js` designed to clean up object URLs when the component unmounts.
- **Test coverage**: Verified pure utilities using Vitest, with 9 passing test cases.
- **Constants**: Merged application categories correctly into `constants.js`.
- **Documentation**: Formatted handoff, architecture logs, and tech debt specifications.
- **README Updates**: Complete.

## Remaining Items & Unfinished Elements
- Vitest Component-level integration coverage now covers the highest-risk add/edit and backup smoke paths, but still avoids full browser/E2E workflows.
- `web_crawler/` logic usage wasn't formally integrated.

## Latest Verification
- `npm run lint`: 0 errors.
- `npm test`: Covers pure utilities plus page-level smoke flows for Home and Add/Edit.
- `npm run build`: Bundled correctly (approx 4.5s).

## Overall Confidence
**Stable**. The application's core functionality works during manual checking. The object URL refactor helps manage memory lifecycles. Image compression reduces storage growth for native captures without external cloud or authentication overheads. ESLint, build, and tests pass.
