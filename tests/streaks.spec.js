const { test, expect } = require('@playwright/test');
const { openUnlocked, advanceDays } = require('./helpers');

/* Feature 4: Streak protection — one missed day is forgiven (streak keeps
   climbing), two consecutive missed days resets it to 1. Covers both the
   manual "prayer" counter (real UI taps) and the audio play counter
   (calling the real production increment function directly, since driving
   an actual <audio> element to 90% playback in headless Chromium against a
   placeholder demo track is unreliably flaky and tests nothing extra). */

async function rosaryCounter(page) {
  return page.locator('.counter').filter({ hasText: 'Rosary' });
}

test('manual counter: 3 days played, 1 missed, 1 played — streak is forgiven, not reset', async ({ page }) => {
  await openUnlocked(page, '2026-07-10T09:00:00'); // Day 1
  await page.locator('.navitem').filter({ hasText: 'Media' }).click();

  const counter = await rosaryCounter(page);
  const streakEl = counter.getByTestId('counter-streak');
  const tapBtn = counter.getByText('Count one');

  await tapBtn.click(); // Day 1 play
  await expect(streakEl).toHaveText('1');

  await advanceDays(page, 1); // Day 2
  await tapBtn.click();
  await expect(streakEl).toHaveText('2');

  await advanceDays(page, 1); // Day 3
  await tapBtn.click();
  await expect(streakEl).toHaveText('3');

  await advanceDays(page, 2); // Day 4 missed entirely, now Day 5
  await tapBtn.click();
  await expect(streakEl).toHaveText('4'); // forgiven, continued climbing
});

test('manual counter: two consecutive missed days resets the streak to 1', async ({ page }) => {
  await openUnlocked(page, '2026-07-10T09:00:00'); // Day 1
  await page.locator('.navitem').filter({ hasText: 'Media' }).click();

  const counter = await rosaryCounter(page);
  const streakEl = counter.getByTestId('counter-streak');
  const tapBtn = counter.getByText('Count one');

  await tapBtn.click(); // Day 1
  await expect(streakEl).toHaveText('1');

  await advanceDays(page, 3); // Day 2 and Day 3 both missed, now Day 4
  await tapBtn.click();
  await expect(streakEl).toHaveText('1'); // reset, not 2
});

test('audio play counter: same forgive-one-miss rule applies', async ({ page }) => {
  await openUnlocked(page, '2026-07-10T09:00:00');
  await page.locator('.navitem').filter({ hasText: 'Media' }).click();
  const trackId = await page.evaluate(() => PL.trackId || Object.keys(S.tracks)[0]);
  expect(trackId).toBeTruthy();

  async function readStreak() {
    return page.evaluate((id) => {
      const rec = window._streakCache && window._streakCache['track:' + id];
      return rec ? rec.streak : 0;
    }, trackId);
  }

  await page.evaluate((id) => window._incrementPlayCount(id), trackId);
  await expect.poll(readStreak).toBe(1);

  await advanceDays(page, 1);
  await page.evaluate((id) => window._incrementPlayCount(id), trackId);
  await expect.poll(readStreak).toBe(2);

  await advanceDays(page, 2); // one full missed day, forgiven
  await page.evaluate((id) => window._incrementPlayCount(id), trackId);
  await expect.poll(readStreak).toBe(3);

  await advanceDays(page, 3); // two missed days, resets
  await page.evaluate((id) => window._incrementPlayCount(id), trackId);
  await expect.poll(readStreak).toBe(1);
});
