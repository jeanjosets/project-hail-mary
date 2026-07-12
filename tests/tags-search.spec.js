const { test, expect } = require('@playwright/test');
const { openUnlocked } = require('./helpers');

/* Feature 3: Tags + search — short tags on an entry, and the existing
   Calendar & search screen extended to match tags as well as entry text. */

async function openSearch(page) {
  await page.locator('.icbtn').first().click(); // leave editor if open
  await page.locator('.navitem').filter({ hasText: 'Menu' }).click();
  await page.getByTestId('menu-calendar').click();
}

test('a tag saved on an entry is findable via search even when the word is not in the text', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');

  await page.evaluate(() => openEditor('20260712'));
  await page.getByTestId('entry-textarea').fill('Quiet morning, nothing special happened.');
  await page.getByTestId('tag-input').fill('#roadtrip #family');
  await page.getByTestId('tag-input').blur();
  await page.waitForTimeout(900);

  await openSearch(page);
  const searchInput = page.getByTestId('search-input');
  await searchInput.fill('roadtrip');

  const result = page.locator('[data-testid="search-result"][data-date="20260712"]');
  await expect(result).toBeVisible();
});

test('search still matches plain entry text (tags did not break existing search)', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260713'));
  await page.getByTestId('entry-textarea').fill('Went hiking near the lake with the kids.');
  await page.waitForTimeout(900);

  await openSearch(page);
  await page.getByTestId('search-input').fill('hiking');
  await expect(page.locator('[data-testid="search-result"][data-date="20260713"]')).toBeVisible();
});

test('search finds nothing for an unrelated term', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260714'));
  await page.getByTestId('entry-textarea').fill('Ordinary Tuesday.');
  await page.waitForTimeout(900);

  await openSearch(page);
  await page.getByTestId('search-input').fill('xyznonexistent');
  await expect(page.locator('[data-testid="search-result"]')).toHaveCount(0);
});
