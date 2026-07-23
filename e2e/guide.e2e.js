import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

test('keeps language text clear of the arrow and localizes the user guide', async ({ page }) => {
  await page.goto('/');

  const languageSelect = page.locator('#language-select');
  const selectLayout = await languageSelect.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      paddingRight: Number.parseFloat(styles.paddingRight),
      width: element.getBoundingClientRect().width,
    };
  });

  expect(selectLayout.paddingRight).toBeGreaterThanOrEqual(32);
  expect(selectLayout.width).toBeGreaterThanOrEqual(112);

  await languageSelect.selectOption('zh-TW');
  await expect(page.getByRole('link', { name: `版本 ${version}` })).toHaveAttribute(
    'href',
    `https://github.com/fuyo1622/acg_app/releases/tag/v${version}`,
  );
  await page.getByRole('link', { name: '使用說明' }).click();
  await expect(page.getByRole('heading', { name: '使用說明', level: 1 })).toBeVisible();
  await expect(page.getByText(/一般 App 更新不需要重新匯出或匯入 JSON/)).toBeVisible();

  await page.getByRole('link', { name: '返回收藏' }).first().click();
  await page.locator('#language-select').selectOption('en');
  await page.getByRole('link', { name: 'User guide' }).click();
  await expect(page.getByRole('heading', { name: 'User guide', level: 1 })).toBeVisible();
  await expect(
    page.getByText(/Normal app updates do not require exporting or importing JSON again/),
  ).toBeVisible();
});
