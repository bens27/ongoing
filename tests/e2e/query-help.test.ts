import { expect, test } from '@playwright/test';

test('query help supports discovery, keyboard isolation, fields, and trying a query', async ({
  page
}) => {
  await page.goto('/?entry=project%2Falpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const trigger = page.getByRole('button', { name: 'Query language help' });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Query the catalog' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/entry=project%2Falpha/);
  await page.keyboard.press('?');
  await page.getByRole('button', { name: 'Available fields', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search query fields' }).fill('intent');
  await expect(dialog.locator('.field')).toHaveCount(1);
  await expect(dialog).toContainText('invest');
  await page.getByRole('button', { name: 'Syntax & examples' }).click();
  await page.getByRole('button', { name: 'Try github.stars>=100', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Filter inventory' })).toHaveValue(
    /github.stars>=100/
  );
  await expect(page.locator('[data-entry-row]')).toHaveCount(1);
  await expect(page.locator('[data-entry-row]')).toHaveAttribute('data-entry-row', 'alpha');
});

test('query help fits a phone and keeps the close control reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: 'Query language help' }).click();
  const dialog = page.getByRole('dialog', { name: 'Query the catalog' });
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close query help' }).click();
  await expect(dialog).not.toBeVisible();
});
