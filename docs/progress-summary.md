# ACG App Progress Summary

## Recent Additions (Backup & Restore Pipelines)
- **JSON Payload Generation**: Separated explicitly decoupled pure logic boundaries (`backupUtils.js`) safely generating single-file offline structures.
- **Micro-transaction Replacements**: Structured validation limits executing user confirm dialogs fully *before* forcing memory-intensive `fetch(dataURL)` Blob rehydrations synchronously overwriting (`replace`) DB columns securely.
- **Asynchronous Compression**: Safely re-encoded RAW files through explicit Promise-based `compressImage` utilities dynamically resizing beneath `1600px`.
- **Canvas Decoding**: Utilized `createImageBitmap` natively bypassing EXIF memory voids.
- **Double-submit Block**: Overhauled `<AddEditItem />` to disable redundant commits while canvas processing loads.

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
- **Filtration Engine**: Safely uncoupled via testable methods.
- **Memory Relief**: Extracted `ItemCard.jsx` executing the newly formed `useObjectUrl.js` designed to clean up object URLs when the component unmounts.
- **Test coverage**: Verified pure utilities using Vitest, with 9 passing test cases.
- **Constants**: Merged application categories correctly into `constants.js`.
- **Documentation**: Formatted handoff, architecture logs, and tech debt specifications.
- **README Updates**: Complete.

## Remaining Items & Unfinished Elements
- Vitest Component-level integration coverage is still sparse, targeting pure business logic right now.
- `web_crawler/` logic usage wasn’t formally integrated.

## Latest Verification
- `npm run lint`: 0 errors.
- `npm test`: 3 test suites, 13 specs covering fallback mock environments.
- `npm run build`: Bundled correctly (approx 4.5s).

## Overall Confidence
**Stable**. The application's core functionality works correctly during manual checking. The object URL refactor helps manage memory lifecycles adequately. Image compression restricts storage growth for native captures without external cloud or authentication overheads. ESLint, build and tests pass.
