import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function useEnglish(page) {
  await page.goto('/');
  await page.getByLabel('語言').selectOption('en');
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
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
  expect(exported.suggestedFilename()).toMatch(/^acg-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const exportedPath = await exported.path();

  await page.getByRole('button', { name: 'Import Backup', exact: true }).click();
  await page.getByLabel('Import backup file').setInputFiles(exportedPath);
  await expect(page.getByRole('alertdialog', { name: 'Import Backup' })).toContainText('safety backup');

  const safetyBackup = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Continue' }).click(),
  ]).then(([download]) => download);
  expect(safetyBackup.suggestedFilename())
    .toMatch(/^acg-auto-backup-before-import-\d{4}-\d{2}-\d{2}\.json$/);

  await expect(page.getByRole('dialog', { name: 'Completed' })).toContainText('imported successfully');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Asuka Langley' })).toBeVisible();
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

  const homeResults = await new AxeBuilder({ page }).analyze();
  expect(
    homeResults.violations.filter(violation => ['serious', 'critical'].includes(violation.impact)),
  ).toEqual([]);

  await page.getByRole('button', { name: 'Add Item' }).click();
  const formResults = await new AxeBuilder({ page }).analyze();
  expect(
    formResults.violations.filter(violation => ['serious', 'critical'].includes(violation.impact)),
  ).toEqual([]);
});
