import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// A valid 1×1 PNG: small enough to skip compression, real enough for backup validation.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const png = name => ({ name, mimeType: 'image/png', buffer: PNG_BYTES });

// Playwright gives every WebKit test a temporary, private-browsing-like profile, and WebKit
// does not store Blobs in IndexedDB there, on any platform. Safari's normal profiles do, so
// tests that save photos run WebKit with a profile on disk. It lives in a short temporary
// folder: WebKit nests its IndexedDB files deeply, and below the test output folder they
// would pass the Windows path limit and fail to open.
const photoTest = test.extend({
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

async function useEnglish(page) {
  await page.goto('/');
  await page.getByLabel('語言').selectOption('en');
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
}

async function openWishlist(page) {
  await page.getByRole('link', { name: 'Wishlist', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Wishlist', level: 1 })).toBeVisible();
}

async function addWishlistEntry(page, name) {
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

function seriousViolations(results) {
  return results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact));
}

photoTest('keeps a wishlist entry with a photo and links out of the collection', async ({ page }) => {
  await useEnglish(page);
  await openWishlist(page);
  await expect(page.getByText('Your wishlist is empty')).toBeVisible();

  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'New Wishlist Entry' })).toBeVisible();
  await page.getByLabel('Add Photo').setInputFiles(png('screenshot.png'));
  await page.getByLabel('Name', { exact: true }).fill('Asuka 1/7 scale figure');
  await page.getByLabel('Link 1 address').fill('Pre-orders open! https://www.amiami.com/eng/detail?gcode=FIGURE-1');
  await page.getByLabel('Link 1 label').fill('AmiAmi');
  await page.getByLabel('Price', { exact: true }).fill('12,800');
  await page.getByLabel('Currency').selectOption('JPY');
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();

  await expect(page.getByRole('heading', { name: 'Asuka 1/7 scale figure' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Asuka 1/7 scale figure' })).toBeVisible();
  await expect(page.getByText('¥12,800')).toBeVisible();

  await page.getByRole('link', { name: /Asuka 1\/7 scale figure/ }).click();
  const shopLink = page.getByRole('link', { name: /AmiAmi/ });
  await expect(shopLink).toHaveAttribute('href', 'https://www.amiami.com/eng/detail?gcode=FIGURE-1');
  await expect(shopLink).toHaveAttribute('target', '_blank');
  await expect(shopLink).toHaveAttribute('rel', 'noopener noreferrer');

  await page.getByRole('button', { name: 'Back to wishlist' }).click();
  await page.getByRole('link', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
  await expect(page.getByText('No items found')).toBeVisible();
  await page.getByLabel('Search collection').fill('Asuka');
  await expect(page.getByRole('link', { name: /Asuka 1\/7 scale figure/ })).toHaveCount(0);
});

photoTest('adds one wishlist entry per chosen screenshot', async ({ page }) => {
  await useEnglish(page);
  await openWishlist(page);

  await page.getByLabel('Choose screenshots').setInputFiles([png('first.png'), png('second.png')]);
  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('Added 2 entries');
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('heading', { name: 'Untitled' })).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'Untitled' })).toHaveCount(2);
});

photoTest('moves an arrived entry into the collection with its wishlist photo', async ({ page }) => {
  await useEnglish(page);
  await openWishlist(page);

  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await page.getByLabel('Add Photo').setInputFiles(png('screenshot.png'));
  await page.getByLabel('Name', { exact: true }).fill('Asuka 1/7 scale figure');
  await page.getByLabel('Price', { exact: true }).fill('12800');
  await page.getByLabel('Currency').selectOption('JPY');
  await page.getByLabel('Shop', { exact: true }).fill('AmiAmi');
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();

  await page.getByRole('link', { name: /Asuka 1\/7 scale figure/ }).click();
  await page.getByRole('button', { name: 'Move to collection' }).click();
  await expect(page.getByRole('img', { name: 'Wishlist photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip and use the wishlist photo' }).click();

  // The collection needs a series or character and a type, which this entry lacks.
  await page.getByRole('combobox', { name: 'Series / Franchise' }).fill('Evangelion');
  await page.getByRole('option', { name: 'Add "Evangelion"' }).click();
  await page.getByLabel('Merchandise Type').selectOption('figure');
  await expect(page.getByLabel('Notes (Optional)')).toHaveValue('Asuka 1/7 scale figure\n12,800 JPY · AmiAmi');
  await page.getByRole('button', { name: 'Move to collection' }).click();

  await expect(page).toHaveURL(/\/item\/\d+$/);
  await expect(page.getByRole('img', { name: 'Evangelion' })).toBeVisible();
  await expect(page.getByText(/12,800 JPY · AmiAmi/)).toBeVisible();

  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByRole('link', { name: /Evangelion/ })).toBeVisible();
  await openWishlist(page);
  await expect(page.getByText('Your wishlist is empty')).toBeVisible();
});

test('restores the wishlist from the shared backup file', async ({ page }) => {
  await useEnglish(page);
  await openWishlist(page);
  await addWishlistEntry(page, 'Rei plush');

  const exported = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Backup' }).click(),
  ]).then(([download]) => download);
  const exportedPath = await exported.path();
  const backup = JSON.parse(await readFile(exportedPath, 'utf8'));
  expect(backup.version).toBe(3);
  expect(backup.wishlist).toEqual([expect.objectContaining({ name: 'Rei plush', status: 'want' })]);

  await page.getByRole('link', { name: /Rei plush/ }).click();
  await page.getByRole('button', { name: 'Edit Wishlist Entry' }).click();
  await page.getByRole('button', { name: 'Are you sure you want to delete this wishlist entry?' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Your wishlist is empty')).toBeVisible();

  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(exportedPath);
  await expect(page.getByRole('alertdialog', { name: 'Import Backup' }))
    .toContainText('REPLACE your current collection and wishlist');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Rei plush' })).toBeVisible();
});

test('keeps the wishlist when a backup from before the wishlist is imported', async ({ page }, testInfo) => {
  await useEnglish(page);
  await openWishlist(page);
  await addWishlistEntry(page, 'Rei plush');

  const oldBackupPath = testInfo.outputPath('acg-backup-version-2.json');
  await writeFile(oldBackupPath, JSON.stringify({
    version: 2,
    timestamp: '2026-08-01T00:00:00.000Z',
    items: [{
      series: ['Evangelion'],
      character: ['Asuka Langley'],
      merchandise_type: 'figure',
      notes: 'Restored from an old backup',
      photo: null,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    }],
  }));

  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(oldBackupPath);
  await expect(page.getByRole('alertdialog', { name: 'Import Backup' }))
    .toContainText('keep your current wishlist');

  const safetyBackup = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Continue' }).click(),
  ]).then(([download]) => download);
  const safetyContents = JSON.parse(await readFile(await safetyBackup.path(), 'utf8'));
  expect(safetyContents.wishlist).toEqual([expect.objectContaining({ name: 'Rei plush' })]);

  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Rei plush' })).toBeVisible();

  await page.getByRole('link', { name: 'Collection', exact: true }).click();
  await page.getByRole('link', { name: /Asuka Langley/ }).click();
  await expect(page.getByText('Restored from an old backup')).toBeVisible();
});

test('returns to the wishlist from an edit address that is not a number', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/wishlist/edit/abc');

  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(page.getByRole('heading', { name: 'Wishlist', level: 1 })).toBeVisible();
});

test('opens the wishlist offline once the app is cached @service-worker', async ({ page, context }) => {
  await useEnglish(page);
  await openWishlist(page);
  await addWishlistEntry(page, 'Asuka figure');

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Asuka figure' })).toBeVisible();

  // Deep links are served from the cached app shell, so a shop without signal still works.
  await context.setOffline(true);
  await page.goto('/wishlist/add', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'New Wishlist Entry' })).toBeVisible();
  await page.goto('/wishlist', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Asuka figure' })).toBeVisible();
  await context.setOffline(false);
});

test('upgrades an existing version 2 database and keeps its collection', async ({ page }) => {
  // A blank page on the app's origin, so the old database exists before the app opens it.
  await page.route('**/seed-version-2', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Seed</title>',
  }));
  await page.goto('/seed-version-2');
  await page.evaluate(() => new Promise((resolve, reject) => {
    // Dexie stores schema version 2 as IndexedDB version 20.
    const request = indexedDB.open('acg-merch-db', 20);
    request.onupgradeneeded = () => {
      const items = request.result.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
      items.createIndex('series', 'series', { multiEntry: true });
      items.createIndex('character', 'character', { multiEntry: true });
      items.createIndex('merchandise_type', 'merchandise_type');
      items.createIndex('created_at', 'created_at');
      items.createIndex('updated_at', 'updated_at');
      items.add({
        series: ['Evangelion'],
        character: ['Asuka Langley'],
        merchandise_type: 'figure',
        notes: 'Saved before the wishlist existed',
        photo: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  }));

  await useEnglish(page);
  await expect(page.getByRole('heading', { name: 'Asuka Langley' })).toBeVisible();

  const schema = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('acg-merch-db');
    request.onsuccess = () => {
      const database = request.result;
      resolve({ version: database.version, stores: [...database.objectStoreNames].sort() });
      database.close();
    };
    request.onerror = () => reject(request.error);
  }));
  expect(schema).toEqual({ version: 30, stores: ['items', 'wishlist'] });

  await openWishlist(page);
  await addWishlistEntry(page, 'Shinji badge');
  await page.getByRole('link', { name: 'Collection', exact: true }).click();
  await page.getByRole('link', { name: /Asuka Langley/ }).click();
  await expect(page.getByText('Saved before the wishlist existed')).toBeVisible();
});

test('has no serious automated accessibility violations on wishlist screens', async ({ page }) => {
  await useEnglish(page);
  await openWishlist(page);
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);

  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'New Wishlist Entry' })).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);

  await page.getByLabel('Name', { exact: true }).fill('Asuka figure');
  await page.getByLabel('Link 1 address').fill('https://www.amiami.com/item');
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await page.getByRole('link', { name: /Asuka figure/ }).click();
  await expect(page.getByRole('heading', { name: 'Asuka figure', level: 1 })).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);

  await page.getByRole('button', { name: 'Move to collection' }).click();
  await expect(page.getByRole('button', { name: 'Take or choose a photo' })).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);
});
