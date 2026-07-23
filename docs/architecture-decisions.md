# Architecture Decisions

## Local-first storage

**Decision:** Store merchandise metadata and photos in IndexedDB through Dexie.

**Reason:** The app should remain useful at stores and events with unreliable connectivity and should not require an account or hosted database.

**Tradeoff:** Data does not automatically sync between devices. Users must export and import backups when moving data.

## Database schema versioning

**Decision:** Keep the Dexie version 1 declaration and migrate `series` and `character` strings to arrays in schema version 2.

**Reason:** Existing browser installations may contain valuable local data, so schema changes must migrate in place.

**Tradeoff:** Future schema work must preserve and test the existing migration path.

## Application-level validation

**Decision:** Keep conditional form rules in the pure `validateItem()` utility instead of relying only on HTML `required`.

**Reason:** The product requires at least one series or character, which cannot be represented clearly by independent `required` attributes.

**Tradeoff:** The UI must display validation messages itself, but the rules remain easy to unit test.

## Search and filtering

**Decision:** Keep search and filter behavior in `filterUtils.js` rather than inside the Home component.

**Reason:** Pure utilities reduce component complexity and make multi-value matching testable.

**Tradeoff:** Home currently loads the collection before filtering; large collections may eventually need Dexie-level queries or pagination.

## Object URL lifecycle

**Decision:** Create photo object URLs through `useObjectUrl` and revoke them during cleanup.

**Reason:** Creating object URLs during render without revocation can retain browser memory.

**Tradeoff:** Photo rendering uses an additional hook and component boundary.

## Image compression

**Decision:** Resize large selected images within 1600×1600 and prefer WebP when the result is smaller.

**Reason:** Raw phone photos can quickly consume browser storage and memory.

**Tradeoff:** Compression uses device CPU and may vary across browser image decoders. If processing fails, the app keeps the original file.

## Backup format

**Decision:** Export one JSON file with photos encoded as Data URLs; import validates the file and then replaces the current collection inside a Dexie transaction.

**Reason:** A single file is easy to save and move without a server, and replacement avoids ambiguous merge behavior.

**Tradeoff:** Base64 increases file size and memory usage. Import is destructive after confirmation, so users should protect existing data with a backup.

## Public distribution boundary

**Decision:** Distribute only the local collection PWA, not the historical third-party crawler or downloaded fixtures.

**Reason:** Crawling and redistributed media introduce unrelated security, licensing, and content-rights risks.

**Tradeoff:** Item data must be entered manually or restored from a user-created backup.
