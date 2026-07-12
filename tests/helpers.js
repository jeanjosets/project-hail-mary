/* Shared setup helpers for the Project Hail Mary Playwright specs.
   Each spec still runs standalone against a fresh page — these just
   remove boilerplate common to every test (loading the app, unlocking
   it with the default PIN, and freezing the clock so multi-day
   scenarios like streaks don't require real waiting). */

const DEFAULT_PIN = '1234';

/** Load the app with the clock frozen at a known date/time, then unlock
 *  the PIN screen exactly the way a real user would (typed PIN + tap). */
async function openUnlocked(page, isoDateTime) {
  await page.clock.install({ time: new Date(isoDateTime) });
  await page.goto('/index.html');
  const pwInput = page.locator('input[type="password"]');
  await pwInput.waitFor({ state: 'visible' });
  await pwInput.fill(DEFAULT_PIN);
  await page.getByRole('button', { name: /unlock/i }).click();
  await page.getByText('Project Hail Mary', { exact: false }).first().waitFor({ state: 'visible' });
}

/** Advance the frozen clock forward by N whole days (keeps time-of-day). */
async function advanceDays(page, days) {
  const now = await page.evaluate(() => Date.now());
  const next = now + days * 86400000;
  await page.clock.setFixedTime(new Date(next));
}

module.exports = { openUnlocked, advanceDays, DEFAULT_PIN };
