const { test, expect } = require('@playwright/test');

/* Service worker: proactive update checks, and offline behavior for the
   app shell + locally-stored (IndexedDB) audio, which must keep working
   regardless of anything done to sw.js. */

test('registers the service worker and actively checks for updates on load and on returning to foreground', async ({ page }) => {
  const updateCalls = [];
  await page.addInitScript(() => {
    window.__updateCalls = [];
    const origRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async (...args) => {
      const reg = await origRegister(...args);
      const origUpdate = reg.update.bind(reg);
      reg.update = (...uargs) => { window.__updateCalls.push(Date.now()); return origUpdate(...uargs); };
      return reg;
    };
  });

  await page.goto('/index.html');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== undefined && window.__updateCalls && window.__updateCalls.length >= 1, { timeout: 10000 });

  let calls = await page.evaluate(() => window.__updateCalls.length);
  expect(calls).toBeGreaterThanOrEqual(1);

  // Simulate the app being backgrounded and brought back to the foreground —
  // this must trigger another update check without a full page reload.
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { value: true, configurable: true }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { value: false, configurable: true }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await page.waitForFunction((prev) => window.__updateCalls.length > prev, calls, { timeout: 5000 });
});

test('app shell still loads while offline', async ({ page, context }) => {
  await page.goto('/index.html');
  await page.locator('input[type="password"]').waitFor({ state: 'visible' });
  // let the service worker finish installing + caching the shell
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 });

  await context.setOffline(true);
  await page.reload();
  await page.locator('input[type="password"]').waitFor({ state: 'visible' });
  await context.setOffline(false);
});

test('a locally-stored (IndexedDB) audio track is still detected as available while offline', async ({ page, context }) => {
  await page.goto('/index.html');
  await page.locator('input[type="password"]').fill('1234');
  await page.getByRole('button', { name: /unlock/i }).click();
  await page.locator('.navitem').first().waitFor({ state: 'visible' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10000 });

  // Seed a fake local audio blob for the first known track, the same way a
  // real "load audio from this device" import would — this storage layer
  // (phm-audio IndexedDB) is entirely separate from the service worker
  // cache, so it must be unaffected by anything done to sw.js.
  const trackId = await page.evaluate(() => Object.keys(S.tracks)[0]);
  expect(trackId).toBeTruthy();
  await page.evaluate((id) => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' });
    return _saveLocalAudio(id, blob);
  }, trackId);

  await context.setOffline(true);
  const hasLocal = await page.evaluate((id) => _loadLocalAudio(id).then((b) => !!b), trackId);
  expect(hasLocal).toBe(true);
  await context.setOffline(false);
});
