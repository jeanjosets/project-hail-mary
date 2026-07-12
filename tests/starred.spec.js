const { test, expect } = require('@playwright/test');
const { openUnlocked } = require('./helpers');

/* Feature 2: Starred entries — a star toggle on the entry, stored locally
   (IndexedDB, not Drive), plus a "Starred entries" list reachable from Menu. */

test('starring an entry persists across a full page reload and shows in the Starred list', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');

  await page.evaluate(() => openEditor('20260712'));
  const textarea = page.getByTestId('entry-textarea');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill('A day worth remembering.');

  const star = page.getByTestId('star-toggle');
  await expect(star).not.toHaveClass(/\bon\b/);
  await star.click();
  await expect(star).toHaveClass(/\bon\b/);

  // Give the debounced save + IndexedDB write a moment, then simulate the
  // user fully closing and reopening the app.
  await page.waitForTimeout(900);
  await page.reload();
  // clock survives reload only if re-installed; re-open unlocked manually here
  await page.clock.install({ time: new Date('2026-07-12T09:05:00') });
  const pwInput = page.locator('input[type="password"]');
  await pwInput.waitFor({ state: 'visible' });
  await pwInput.fill('1234');
  await page.getByRole('button', { name: /unlock/i }).click();

  await page.evaluate(() => openEditor('20260712'));
  const starAfterReload = page.getByTestId('star-toggle');
  await starAfterReload.waitFor({ state: 'visible' });
  await expect(starAfterReload).toHaveClass(/\bon\b/);

  // Now check the dedicated Starred entries view finds it.
  await page.locator('.icbtn').first().click(); // back out of editor
  await page.locator('.navitem').filter({ hasText: 'Menu' }).click();
  await page.getByTestId('menu-starred').click();
  const item = page.locator('[data-testid="starred-item"][data-date="20260712"]');
  await expect(item).toBeVisible();
});

test('unstarring removes the entry from the Starred list', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260712'));
  await page.getByTestId('entry-textarea').fill('Temporary star test.');
  await page.getByTestId('star-toggle').click();
  await page.waitForTimeout(300);
  await page.getByTestId('star-toggle').click(); // unstar
  await page.waitForTimeout(900);

  await page.locator('.icbtn').first().click();
  await page.locator('.navitem').filter({ hasText: 'Menu' }).click();
  await page.getByTestId('menu-starred').click();
  await expect(page.locator('[data-testid="starred-item"][data-date="20260712"]')).toHaveCount(0);
});
