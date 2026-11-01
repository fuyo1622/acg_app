import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { test } from '@playwright/test';
import { readZip } from '../src/utils/zipUtils.js';

// Opens a downloaded backup archive: its records from backup.json, and the archive to
// check the photo files in it.
export async function readBackupArchive(path) {
  const archive = await readZip(new Blob([await readFile(path)]));
  return { archive, backup: JSON.parse(await archive.text('backup.json')) };
}

// A valid 1×1 PNG: small enough to skip compression, real enough for backup validation.
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64');
export const png = name => ({ name, mimeType: 'image/png', buffer: PNG_BYTES });

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

// A one-colour PNG of any size, for tests that need a photo larger than a thumbnail. It
// compresses to a few kilobytes, so the app keeps it as it is instead of re-encoding it.
export function solidPng(name, width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 2; // RGB
  const row = Buffer.alloc(1 + width * 3); // a filter byte, then the pixels
  for (let x = 0; x < width; x += 1) row.set([200, 80, 120], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return { name, mimeType: 'image/png', buffer };
}

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
