import { expect, test } from '@playwright/test';

test('the public checkout starts without the private logo overlay', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('link', { name: 'ongoing home' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Filter inventory' })).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
