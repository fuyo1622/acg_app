import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from '@playwright/test';

// A valid 1×1 PNG: small enough to skip compression, real enough for backup validation.
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64');
export const png = name => ({ name, mimeType: 'image/png', buffer: PNG_BYTES });

// Playwright gives every WebKit test a temporary, private-browsing-like profile, and WebKit
// does not store Blobs in IndexedDB there, on any platform. Safari's normal profiles do, so
// tests that save photos run WebKit with a profile on disk. It lives in a short temporary
// folder: WebKit nests its IndexedDB files deeply, and below the test output folder they
// would pass the Windows path limit and fail to open.
export const photoTest = test.extend({
  page: async ({ page, browserName, playwright, baseURL, viewport, userAgent, deviceScaleFactor }, use) => {
    if (browserName !== 'webkit') {
      await use(page);
      return;
    }

    const profileDir = await mkdtemp(join(tmpdir(), 'acg-webkit-'));
    const context = await playwright.webkit.launchPersistentContext(profileDir, {
      baseURL,
      viewport,
      userAgent,
      deviceScaleFactor,
    });
    await use(context.pages()[0] ?? await context.newPage());
    await context.close();
    // On Windows, WebKit can hold its database files for a moment after closing. A
    // leftover folder in the system temp directory is harmless, so cleanup never fails a test.
    await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
  },
});
