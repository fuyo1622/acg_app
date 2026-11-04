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

photoTest('shows a small copy of each photo on the list and the full photo on its page', async ({ page }) => {
  await useEnglish(page);
  await page.getByLabel('Album photos').setInputFiles([solidPng('tall.png', 1200, 1600)]);
  await page.getByRole('button', { name: 'Add all (1)' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  const card = page.getByRole('link', { name: /Unknown Character/ });
  const photoHeight = photo => photo.evaluate(image => image.naturalHeight);
  const cardPhoto = card.getByRole('img', { name: 'Untitled' });
  await expect.poll(() => photoHeight(cardPhoto)).toBe(480);

  // The copy is kept, so reopening the app does not have to decode the photo again.
  const storedCopies = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('acg-thumbnails');
    request.onsuccess = () => {
      const database = request.result;
      database.transaction('thumbnails').objectStore('thumbnails').getAll().onsuccess = event => {
        resolve(event.target.result.map(entry => entry.blob.type));
        database.close();
      };
    };
    request.onerror = () => reject(request.error);
  }));
  await expect.poll(storedCopies).toEqual(['image/jpeg']);
  await page.reload();
  await expect.poll(() => photoHeight(cardPhoto)).toBe(480);

  await card.click();
  await expect.poll(() => photoHeight(page.getByRole('img', { name: 'Untitled' }))).toBe(1600);
});

test('manages the lists of types, series and characters', async ({ page, browserName }) => {
  test.slow(browserName === 'webkit', 'Two new items, an accessibility scan and many list changes take about 20 s in WebKit');
  await useEnglish(page);
  await addItem(page, { series: 'Evangelion', character: 'Asuka Langley', type: 'figure' });
  await addItem(page, { series: 'Gundam', character: 'Char Aznable', type: 'plush' });

  await page.getByRole('link', { name: 'Manage lists' }).click();
  await expect(page.getByRole('heading', { name: 'Manage lists' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plush 1 items use it' })).toBeVisible();
  expect(seriousViolations(await new AxeBuilder({ page }).analyze())).toEqual([]);

  await page.getByRole('button', { name: 'Series', exact: true }).click();
  await page.getByRole('textbox', { name: 'New series' }).fill('Macross');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const seriesNames = () => page.locator('.term-label').allTextContents();
  await expect.poll(seriesNames).toEqual(['Evangelion', 'Gundam', 'Macross']);

  // Drag Macross by its handle above Evangelion.
  const handle = page.getByRole('button', { name: 'Drag Macross to change the order' });
  const target = await page.getByRole('button', { name: 'Drag Evangelion to change the order' }).boundingBox();
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 4, { steps: 12 });
  await page.mouse.move(target.x + target.width / 2, target.y + 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(seriesNames).toEqual(['Macross', 'Evangelion', 'Gundam']);

  await page.getByRole('button', { name: 'Sort by name' }).click();
  await expect.poll(seriesNames).toEqual(['Evangelion', 'Gundam', 'Macross']);

  await page.getByRole('button', { name: /^Evangelion 1 items use it$/ }).click();
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'New name for Evangelion' }).fill('Neon Genesis Evangelion');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(seriesNames).toEqual(['Neon Genesis Evangelion', 'Gundam', 'Macross']);

  // Deleting a type that an item uses takes it off the item, which then needs details.
  await page.getByRole('button', { name: 'Types', exact: true }).click();
  await page.getByRole('button', { name: 'Plush 1 items use it' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete Plush?' });
  await expect(confirm).toContainText('1 collection items and 0 wishlist entries use Plush');
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: /^Plush / })).toHaveCount(0);

  await page.getByRole('button', { name: 'Back to collection' }).click();
  await expect(page.getByText('Needs details: 1')).toBeVisible();
  await expect(page.getByRole('link', { name: /Neon Genesis Evangelion/ })).toBeVisible();
  await expect(page.getByLabel('Filter by series').locator('option'))
    .toHaveText(['All Series', 'Neon Genesis Evangelion', 'Gundam']);
});

photoTest('moves between items with the arrows, the keyboard and a swipe', async ({ page, browserName }) => {
  await useEnglish(page);
  await page.getByLabel('Album photos').setInputFiles([png('a.png'), png('b.png'), png('c.png')]);
  await page.getByRole('button', { name: 'Add all (3)' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  const cards = page.getByRole('link', { name: /Unknown Character/ });
  await expect(cards).toHaveCount(3);
  const paths = await cards.evaluateAll(links => links.map(link => link.getAttribute('href')));
  const atItem = index => expect(page).toHaveURL(new RegExp(`${paths[index]}$`));
  await cards.nth(1).click();
  const position = page.getByRole('group', { name: 'Browse items' });
  await expect(position).toContainText('2 of 3');
  await atItem(1);

  await page.getByRole('button', { name: 'Next item' }).click();
  await atItem(2);
  await expect(position).toContainText('3 of 3');
  await expect(page.getByRole('button', { name: 'Next item' })).toBeDisabled();

  await page.keyboard.press('ArrowLeft');
  await atItem(1);

  // Desktop WebKit has no touch input; in Chromium, a real swipe goes through the browser.
  if (browserName === 'chromium') {
    // The page itself takes the swipe and stays in place while one item replaces another,
    // so it can be measured at any moment.
    const panel = await page.locator('.item-detail-page').boundingBox();
    const y = panel.y + 200;
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: panel.x + panel.width - 60, y }] });
    for (const step of [1, 2, 3]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: panel.x + panel.width - 60 - step * 70, y }],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await atItem(2);
  }

  // Moving replaces the history entry, so Back returns to the list.
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
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
  // Writing 54 MB of photos takes WebKit several seconds; the header says it is working.
  await expect(page.getByRole('status').filter({ hasText: 'Working on the backup' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Completed' }))
    .toContainText('imported successfully', { timeout: 60_000 });
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
  expect(backup.version).toBe(6);
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

// Photos as a phone stores them when it keeps them at full size: large, and real images,
// so a backup can make them smaller. Random pixels keep each PNG about 9 MB.
async function seedFullSizePhotos(page, count) {
  return page.evaluate(async (photoCount) => {
    const photos = [];
    for (let index = 0; index < photoCount; index += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = 2000;
      canvas.height = 1500;
      const context = canvas.getContext('2d');
      const pixels = context.createImageData(2000, 1500);
      for (let offset = 0; offset < pixels.data.length; offset += 65536) {
        crypto.getRandomValues(pixels.data.subarray(offset, Math.min(offset + 65536, pixels.data.length)));
      }
      for (let alpha = 3; alpha < pixels.data.length; alpha += 4) pixels.data[alpha] = 255;
      context.putImageData(pixels, 0, 0);
      photos.push(await new Promise(resolve => canvas.toBlob(resolve, 'image/png')));
    }

    await new Promise((resolve, reject) => {
      const request = indexedDB.open('acg-merch-db');
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('items', 'readwrite');
        photos.forEach((photo, index) => {
          const now = new Date(Date.now() - index);
          transaction.objectStore('items').add({
            series: ['Full size'],
            character: [`Full size ${index + 1}`],
            merchandise_type: 'figure',
            notes: '',
            photos: [photo],
            created_at: now,
            updated_at: now,
          });
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    return Math.min(...photos.map(photo => photo.size));
  }, count);
}

async function clearCollection(page) {
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
}

async function saveWithDialog(page, buttonName) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  return download;
}

photoTest('saves a large backup in several files with smaller photos, and restores it from all of them', async ({ page }) => {
  photoTest.slow(true, 'Three 9 MB photos are made smaller, saved in three files, and restored twice');
  await useEnglish(page);
  // A file holds at most one item here, so three items make three files.
  await page.evaluate(() => sessionStorage.setItem('acgBackupPartBytes', '1'));
  const storedBytes = await seedFullSizePhotos(page, 3);
  expect(storedBytes).toBeGreaterThan(5 * 1024 * 1024);
  await page.reload();
  await expect(page.getByRole('link', { name: /Full size \d/ })).toHaveCount(3);

  const parts = [];
  await page.getByRole('button', { name: 'Export Backup' }).click();
  for (const number of [1, 2, 3]) {
    await expect(page.getByRole('dialog', { name: `Backup file ${number} is ready` })).toBeVisible({ timeout: 30_000 });
    const download = await saveWithDialog(page, 'Save');
    expect(download.suggestedFilename()).toMatch(new RegExp(`^acg-backup-\\d{4}-\\d{2}-\\d{2}-part0${number}\\.zip$`));
    parts.push(await download.path());
  }
  await expect(page.getByRole('dialog', { name: 'Backup saved in 3 files' })).toContainText('choose all 3 files at once');
  await page.getByRole('button', { name: 'Close' }).click();

  // Each photo in the backup is a much smaller copy of the stored one.
  for (const path of parts) {
    const { archive, backup } = await readBackupArchive(path);
    expect(backup.items).toHaveLength(1);
    expect(archive.size(backup.items[0].photos[0])).toBeLessThan(storedBytes / 3);
  }

  // As if the browser lost the data: the three files are all that is left.
  await clearCollection(page);
  await expect(page.getByText('No items found')).toBeVisible();
  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles([parts[2], parts[0], parts[1]]);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('link', { name: /Full size \d/ })).toHaveCount(3);

  // Choosing only some of the files names the missing one and changes nothing.
  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles([parts[0], parts[2]]);
  await expect(page.getByRole('dialog', { name: 'Something went wrong' })).toContainText('Missing file numbers: 2.');
  await page.getByRole('button', { name: 'Close' }).click();

  // Restoring over the current data first saves a safety backup, here in three files too.
  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(parts);
  const firstSafetyFile = await saveWithDialog(page, 'Continue');
  expect(firstSafetyFile.suggestedFilename()).toMatch(/^acg-auto-backup-before-import-\d{4}-\d{2}-\d{2}-part01\.zip$/);
  for (const number of [2, 3]) {
    await expect(page.getByRole('dialog', { name: `Safety backup file ${number} is ready` })).toBeVisible({ timeout: 30_000 });
    await saveWithDialog(page, 'Save');
  }
  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('link', { name: /Full size \d/ })).toHaveCount(3);
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
