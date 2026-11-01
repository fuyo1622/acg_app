import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { photoTest, png, readBackupArchive, solidPng } from './fixtures';

async function useEnglish(page) {
  await page.goto('/');
  await page.getByLabel('語言').selectOption('en');
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
}

function seriousViolations(results) {
  return results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact));
}

// The combobox offers an existing value instead of an "add" entry once one is stored.
async function chooseValue(page, label, value) {
  await page.getByRole('combobox', { name: label }).fill(value);

  const addOption = page.getByRole('option', { name: `Add "${value}"` });
  if (await addOption.count()) {
    await addOption.click();
    return;
  }

  await page.getByRole('option', { name: value, exact: true }).first().click();
}

async function addItem(page, {
  series = 'Neon Genesis Evangelion',
  character = 'Asuka Langley',
  type = 'figure',
  notes = 'Mint condition',
} = {}) {
  await page.getByRole('button', { name: 'Add Item' }).click();

  await chooseValue(page, 'Series / Franchise', series);
  await chooseValue(page, 'Character', character);

  await page.getByLabel('Merchandise Type').selectOption(type);
  if (type === '__custom__') {
    await page.getByPlaceholder('Type to search or add...').fill('Nendoroid');
  }
  await page.getByLabel('Notes (Optional)').fill(notes);
  await page.getByRole('button', { name: 'Add Item', exact: true }).click();
  await expect(page.getByRole('heading', { name: character })).toBeVisible();
}

test('adds, edits and deletes a collection item', async ({ page }) => {
  await useEnglish(page);
  await addItem(page);

  await page.getByRole('link', { name: /Asuka Langley/ }).click();
  await expect(page.getByText('Mint condition')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Item' }).click();
  await page.getByLabel('Notes (Optional)').fill('Opened, complete');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Opened, complete')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Item' }).click();
  await page.getByRole('button', { name: 'Are you sure you want to delete this item?' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Delete item?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('No items found')).toBeVisible();
  await expect(page.getByRole('link', { name: /Asuka Langley/ })).toHaveCount(0);
});

test('shows a recoverable page for an unknown address', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to collection' }).click();
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
});

test('returns to the collection from an edit address that is not a number', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/edit/abc');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
});

test('keeps the storage panel hidden until it is shown again', async ({ page }) => {
  await useEnglish(page);
  const reportsStorage = await page.evaluate(() => Boolean(navigator.storage?.estimate));
  test.skip(!reportsStorage, 'This browser does not report storage usage');

  const panel = page.getByRole('region', { name: 'Browser storage' });
  await panel.getByRole('button', { name: 'Hide storage details' }).click();
  await expect(panel).toHaveCount(0);

  await page.reload();
  const showStorage = page.getByRole('button', { name: 'Show storage details' });
  await expect(showStorage).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.getByRole('link', { name: 'Wishlist', exact: true }).click();
  await expect(panel).toHaveCount(0);

  await showStorage.click();
  await expect(panel).toBeVisible();
});

test('leaves a directly opened edit page for the item instead of the browser history', async ({ page }) => {
  await useEnglish(page);
  await addItem(page);

  const itemPath = await page.getByRole('link', { name: /Asuka Langley/ }).getAttribute('href');
  await page.goto(itemPath.replace('/item/', '/edit/'));
  await expect(page.getByRole('heading', { name: 'Edit Item' })).toBeVisible();

  await page.getByLabel('Notes (Optional)').fill('Bought at the convention');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page).toHaveURL(new RegExp(`${itemPath}$`));
  await expect(page.getByText('Bought at the convention')).toBeVisible();
});

test('keeps a custom merchandise type selectable after reopening the edit form', async ({ page }) => {
  await useEnglish(page);
  await addItem(page, { character: 'Rei Ayanami', type: '__custom__' });

  const itemPath = await page.getByRole('link', { name: /Rei Ayanami/ }).getAttribute('href');
  await page.goto(itemPath.replace('/item/', '/edit/'));

  await expect(page.getByLabel('Merchandise Type')).toHaveValue('Nendoroid');
  await expect(page.getByPlaceholder('Type to search or add...')).toHaveCount(0);
});

test('searches by merchandise type and reuses one series across items', async ({ page }) => {
  await useEnglish(page);
  await addItem(page, { series: 'Evangelion', character: 'Asuka Langley', type: 'figure' });
  await addItem(page, { series: 'Evangelion', character: 'Rei Ayanami', type: 'plush' });

  const seriesFilter = page.getByLabel('Filter by series');
  await expect(seriesFilter).toHaveValue('all');
  await expect(seriesFilter.locator('option')).toHaveCount(2); // "All Series" plus Evangelion

  await seriesFilter.selectOption('Evangelion');
  await expect(page.getByRole('link', { name: /Asuka Langley/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Rei Ayanami/ })).toBeVisible();

  await seriesFilter.selectOption('all');
  await page.getByLabel('Search collection').fill('Plush');
  await expect(page.getByRole('link', { name: /Rei Ayanami/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Asuka Langley/ })).toHaveCount(0);
});

test('clears a series filter once its last item is deleted', async ({ page }) => {
  await useEnglish(page);
  await addItem(page, { series: 'Gundam', character: 'Char Aznable', type: 'figure' });
  await addItem(page, { series: 'Evangelion', character: 'Asuka Langley', type: 'figure' });

  await page.getByLabel('Filter by series').selectOption('Gundam');
  await expect(page.getByRole('link', { name: /Asuka Langley/ })).toHaveCount(0);

  await page.getByRole('link', { name: /Char Aznable/ }).click();
  await page.getByRole('button', { name: 'Edit Item' }).click();
  await page.getByRole('button', { name: 'Are you sure you want to delete this item?' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByLabel('Filter by series')).toHaveValue('all');
  await expect(page.getByRole('link', { name: /Asuka Langley/ })).toBeVisible();
});

test('exports, imports and creates a pre-replacement safety backup', async ({ page }) => {
  await useEnglish(page);
  await addItem(page);

  const exported = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Backup' }).click(),
  ]).then(([download]) => download);
  expect(exported.suggestedFilename()).toMatch(/^acg-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const exportedPath = await exported.path();

  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(exportedPath);
  await expect(page.getByRole('alertdialog', { name: 'Import Backup' })).toContainText('safety backup');

  const safetyBackup = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Continue' }).click(),
  ]).then(([download]) => download);
  expect(safetyBackup.suggestedFilename())
    .toMatch(/^acg-auto-backup-before-import-\d{4}-\d{2}-\d{2}\.zip$/);

  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Asuka Langley' })).toBeVisible();
});

photoTest('imports album photos as unfinished items and fills one in later', async ({ page, browserName }) => {
  photoTest.slow(browserName === 'webkit', 'Two photo rounds and three accessibility scans take about 25 s in WebKit');
  await useEnglish(page);

  await page.getByLabel('Album photos').setInputFiles([png('front.png'), png('back.png')]);
  await expect(page.getByRole('heading', { name: 'Import album' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Item \d+:/ })).toHaveCount(2);

  // A second round, as if from another album, joins the same import. Its tile shows a
  // thumbnail, while the item keeps the full photo.
  await expect(page.getByRole('button', { name: 'Add photos' })).toBeVisible();
  await page.getByLabel('Album photos').setInputFiles([solidPng('shelf.png', 640, 480)]);
  const shelfTile = page.getByRole('button', { name: 'Item 3: 1 photo(s)' });
  await expect(shelfTile).toBeVisible();
  await expect.poll(() => shelfTile.locator('img').evaluate(image => image.naturalWidth)).toBe(320);

  await page.getByRole('button', { name: 'Item 1: 1 photo(s)' }).click();
  await page.getByRole('button', { name: 'Item 2: 1 photo(s)' }).click();
  await page.getByRole('button', { name: 'Merge' }).click();
  await expect(page.getByRole('button', { name: 'Item 1: 2 photo(s)' })).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);
  await page.getByRole('button', { name: 'Add all (2)' }).click();

  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('Added 2 item(s)');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Needs details: 2')).toBeVisible();
  await expect(page.getByRole('link', { name: /Unknown Character/ })).toHaveCount(2);
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);

  // The merged item is the first tile, so it is the newest card.
  await page.getByRole('link', { name: /Unknown Character/ }).first().click();
  await expect(page.getByRole('button', { name: 'Show photo 2' })).toBeVisible();
  await expect(page.getByText('Still missing: a series or character and a type.')).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);
  await page.getByRole('button', { name: 'Fill in details' }).click();

  await chooseValue(page, 'Series / Franchise', 'Evangelion');
  await page.getByLabel('Merchandise Type').selectOption('figure');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('img', { name: 'Evangelion' })).toBeVisible();
  await expect(page.getByText('Fill in details')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show photo 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByText('Needs details: 1')).toBeVisible();
  await page.getByRole('button', { name: 'Show only these' }).click();
  await expect(page.getByRole('link', { name: /Unknown Character/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Evangelion/ })).toHaveCount(0);

  await page.getByRole('link', { name: /Unknown Character/ }).click();
  const shelfPhoto = page.getByRole('img', { name: 'Untitled' });
  await expect.poll(() => shelfPhoto.evaluate(image => image.naturalWidth)).toBe(640);
});

// Stored photos larger than any album import makes, so six of them pass the 50 MB that
// backups were once limited to.
async function seedLargePhotos(page, { count, bytes }) {
  await page.evaluate(({ count, bytes }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('acg-merch-db');
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('items', 'readwrite');
      for (let index = 0; index < count; index += 1) {
        const data = new Uint8Array(bytes);
        data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        for (let offset = 8; offset < bytes; offset += 65536) {
          crypto.getRandomValues(data.subarray(offset, Math.min(offset + 65536, bytes)));
        }
        const now = new Date(Date.now() - index);
        transaction.objectStore('items').add({
          series: ['Large'],
          character: [`Large ${index + 1}`],
          merchandise_type: 'figure',
          notes: '',
          photos: [new Blob([data], { type: 'image/png' })],
          created_at: now,
          updated_at: now,
        });
      }
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  }), { count, bytes });
}

function storedPhotoSizes(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('acg-merch-db');
    request.onsuccess = () => {
      const database = request.result;
      database.transaction('items').objectStore('items').getAll().onsuccess = event => {
        resolve(event.target.result.map(item => item.photos.map(photo => photo.size)).flat());
        database.close();
      };
    };
    request.onerror = () => reject(request.error);
  }));
}

photoTest('backs up and restores a collection larger than the old 50 MB limit', async ({ page }) => {
  photoTest.slow(true, 'The test writes, saves, and restores about 54 MB of photos');
  await useEnglish(page);
  const photoBytes = 9 * 1024 * 1024;
  await seedLargePhotos(page, { count: 6, bytes: photoBytes });
  await page.reload();
  await expect(page.getByRole('link', { name: /Large \d/ })).toHaveCount(6);

  const exported = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Backup' }).click(),
  ]).then(([download]) => download);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const exportedPath = await exported.path();
  const { archive, backup } = await readBackupArchive(exportedPath);
  expect(backup.items).toHaveLength(6);
  expect(archive.size('photos/items/0006-1.png')).toBe(photoBytes);

  // As if the browser lost the data: the backup file is all that is left.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('acg-merch-db');
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('items', 'readwrite');
      transaction.objectStore('items').clear();
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  }));
  await page.reload();
  await expect(page.getByText('No items found')).toBeVisible();

  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(exportedPath);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully');
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('link', { name: /Large \d/ })).toHaveCount(6);
  expect(await storedPhotoSizes(page)).toEqual(Array(6).fill(photoBytes));
});

photoTest('keeps every photo of an item through a backup and restore', async ({ page }) => {
  await useEnglish(page);
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByLabel('Add Photo').setInputFiles([png('front.png'), png('back.png')]);
  await expect(page.getByRole('img', { name: 'Photo 2 of 2' })).toBeVisible();
  await chooseValue(page, 'Series / Franchise', 'Evangelion');
  await chooseValue(page, 'Character', 'Asuka Langley');
  await page.getByLabel('Merchandise Type').selectOption('figure');
  await page.getByRole('button', { name: 'Add Item', exact: true }).click();
  await expect(page.getByRole('img', { name: '2 photos' })).toBeVisible();

  const exported = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Backup' }).click(),
  ]).then(([download]) => download);
  const exportedPath = await exported.path();
  const { archive, backup } = await readBackupArchive(exportedPath);
  expect(backup.version).toBe(5);
  expect(backup.items).toEqual([expect.objectContaining({
    character: ['Asuka Langley'],
    photos: ['photos/items/0001-1.png', 'photos/items/0001-2.png'],
  })]);
  expect(backup.items[0]).not.toHaveProperty('photo');
  expect(archive.size('photos/items/0001-2.png')).toBeGreaterThan(0);

  await page.getByRole('link', { name: /Asuka Langley/ }).click();
  await page.getByRole('button', { name: 'Edit Item' }).click();
  await page.getByRole('button', { name: 'Are you sure you want to delete this item?' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('No items found')).toBeVisible();

  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(exportedPath);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully');
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('img', { name: '2 photos' })).toBeVisible();
  await page.getByRole('link', { name: /Asuka Langley/ }).click();
  await expect(page.getByRole('img', { name: 'Asuka Langley' })).toBeVisible();
  await page.getByRole('button', { name: 'Show photo 2' }).click();
  await expect(page.getByRole('button', { name: 'Show photo 2' })).toHaveAttribute('aria-pressed', 'true');
});

test('runs offline from the service worker cache and checks for an update @service-worker', async ({ page, context }) => {
  await useEnglish(page);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();

  await context.setOffline(false);
  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return registration.active?.state;
  });
  expect(workerState).toBe('activated');
});

test('has no serious automated accessibility violations on primary screens', async ({ page }) => {
  await useEnglish(page);

  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);

  await page.getByRole('button', { name: 'Add Item' }).click();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);
});
