const { test, expect } = require('@playwright/test');
const { openUnlocked } = require('./helpers');

/* On-device journal-text backup vault (phm-vault) — entry text currently has
   no other local persistence (Drive is dormant in this phase), so this is
   what stands between a typed entry and losing it on reload. */

async function unlockAfterReload(page, isoDateTime) {
  await page.reload();
  await page.clock.install({ time: new Date(isoDateTime) });
  const pwInput = page.locator('input[type="password"]');
  await pwInput.waitFor({ state: 'visible' });
  await pwInput.fill('1234');
  await page.getByRole('button', { name: /unlock/i }).click();
}

test('journal text survives a full page reload', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260712'));
  const textarea = page.getByTestId('entry-textarea');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill('First half of today entry.');
  await page.waitForTimeout(900); // past the ~650ms debounce, vault write should have fired

  await unlockAfterReload(page, '2026-07-12T09:05:00');
  await page.evaluate(() => openEditor('20260712'));

  const textareaAfter = page.getByTestId('entry-textarea');
  await textareaAfter.waitFor({ state: 'visible' });
  await expect(textareaAfter).toHaveValue('First half of today entry.');
});

test('continuing to type after a reload does not lose the earlier text', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260712'));
  await page.getByTestId('entry-textarea').fill('Morning thoughts.');
  await page.waitForTimeout(900);

  await unlockAfterReload(page, '2026-07-12T18:00:00');
  await page.evaluate(() => openEditor('20260712'));
  const textarea = page.getByTestId('entry-textarea');
  await textarea.waitFor({ state: 'visible' });
  await expect(textarea).toHaveValue('Morning thoughts.'); // reload didn't lose it

  await textarea.fill('Morning thoughts. Evening addition too.');
  await page.waitForTimeout(900);

  // Reload again — proves the FULL combined text (not just the new part) was vaulted.
  await unlockAfterReload(page, '2026-07-12T18:05:00');
  await page.evaluate(() => openEditor('20260712'));
  const finalTextarea = page.getByTestId('entry-textarea');
  await finalTextarea.waitFor({ state: 'visible' });
  await expect(finalTextarea).toHaveValue('Morning thoughts. Evening addition too.');
});

test('a brand-new, never-written day opens blank rather than erroring', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');
  await page.evaluate(() => openEditor('20260101'));
  const textarea = page.getByTestId('entry-textarea');
  await textarea.waitFor({ state: 'visible' });
  await expect(textarea).toHaveValue('');
});
