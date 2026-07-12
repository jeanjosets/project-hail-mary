const { test, expect } = require('@playwright/test');
const { openUnlocked } = require('./helpers');

/* Feature 1: On This Day — opening the journal for a date should surface
   an entry written on the same month/day in a previous year, if one exists. */

test('shows an On This Day card when a prior-year entry exists for the same month/day', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');

  // Seed a prior-year entry directly in the app's own in-memory store —
  // this is the exact same data source openEditor() reads from.
  await page.evaluate(() => {
    S.entries['20250712'] = { text: 'Last year I started learning to swim.', updatedAt: Date.now() };
  });

  await page.evaluate(() => openEditor('20260712'));

  const card = page.getByTestId('on-this-day-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 year ago');
  await expect(card).toContainText('learning to swim');

  await page.getByTestId('on-this-day-dismiss').click();
  await expect(card).toHaveCount(0);
});

test('does not show a card when there is no prior-year entry for that day', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260712'));
  await expect(page.getByTestId('on-this-day-card')).toHaveCount(0);
});
