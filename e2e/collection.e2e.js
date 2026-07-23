import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function useEnglish(page) {
  await page.goto('/');
  await page.getByLabel('語言').selectOption('en');
  await expect(page.getByRole('heading', { name: 'My Collection' })).toBeVisible();
}

async function addItem(page, {
  series = 'Neon Genesis Evangelion',
  character = 'Asuka Langley',
  type = 'figure',
  notes = 'Mint condition',
} = {}) {
  await page.getByRole('button', { name: 'Add Item' }).click();

  const seriesInput = page.getByRole('combobox', { name: 'Series / Franchise' });
  await seriesInput.fill(series);
  await page.getByRole('option', { name: `Add "${series}"` }).click();

  const characterInput = page.getByRole('combobox', { name: 'Character' });
  await characterInput.fill(character);
  await page.getByRole('option', { name: `Add "${character}"` }).click();

  await page.getByLabel('Merchandise Type').selectOption(type);
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

test('runs offline from the service worker cache and checks for an update', async ({ page, context }) => {
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
