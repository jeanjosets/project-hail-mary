---
name: run
description: "Launch and visually drive Project Hail Mary (index.html) in a real, headed Chromium tab to confirm a change works, complementing the Playwright test suite. Use when asked to run, start, screenshot, or manually verify the app in a browser."
---

# Running Project Hail Mary in a real browser tab

This is a single-file vanilla-JS PWA (`index.html`, no build step, no
framework). There is already a Playwright test suite (`npm test`) for
behavior assertions — this skill is for the complementary step: actually
looking at rendered pixels in a real browser, which the headless test
suite cannot do (e.g. it caught a CSS bug — a toggle whose "on" class was
applied correctly but had no matching style rule — that the automated
tests missed entirely because they only asserted the class name, not the
rendered appearance).

## 1. Start the static file server

Reuse the server already written for the test suite — don't invent a new
one.

```bash
lsof -ti:4173 || (node tests/static-server.js > /tmp/phm-static-server.log 2>&1 &)
sleep 1
curl -sf http://127.0.0.1:4173/index.html >/dev/null && echo "server up"
```

Stop it when done: `lsof -ti:4173 | xargs -r kill`.

`file://` is deliberately avoided — IndexedDB/localStorage behave
differently on `file://` origins than on the `https://` GitHub Pages
deployment; `http://127.0.0.1:4173` is a much closer match.

## 2. Drive it with Playwright, headed (not the test runner)

`chromium-cli` is not installed in this environment. Use `playwright-core`
directly (already present in `node_modules` from the test suite) in a
throwaway Node script — do not add it as a new dependency:

```js
const { chromium } = require('/Users/tommie/Desktop/phm/node_modules/playwright-core');
const browser = await chromium.launch({ headless: false, slowMo: 120 });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
await page.goto('http://127.0.0.1:4173/index.html');
```

Because this runs on the user's actual Mac (not a remote headless
container), `headless: false` pops open a real, visible Chrome window —
this is the literal "browser tab" a non-technical user means when they ask
to see it working, not just a screenshot.

Write the script to a scratch path (not into the repo), screenshot at each
step with `page.screenshot({ path })`, and `console`/`pageerror` listeners
to catch anything that throws:

```js
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
```

## 3. One representative walkthrough

Unlock (default PIN is `1234`) → open today's journal entry → type →
star it → tag it → **reload the tab for real** (`page.reload()`, not just
a fresh `goto`) and unlock again to prove local persistence survived →
search for it → check the Media tab → check a project's sub-step.

```js
await page.locator('input[type="password"]').fill('1234');
await page.getByRole('button', { name: /unlock/i }).click();
// wait on `.navitem` here, NOT on visible "Project Hail Mary" text —
// see gotcha below.
await page.locator('.navitem').first().waitFor({ state: 'visible' });
```

Calling the app's own top-level functions via `page.evaluate()` (e.g.
`page.evaluate((d) => openEditor(d), dateKey)`) is a legitimate shortcut
for setup/navigation steps that aren't themselves under test — every
top-level `function`/`var` in `index.html` is a plain global (no modules),
so this works for any of them. Reserve real `click()`/`fill()` for the
interaction actually being verified.

## Gotchas hit while building this

- **The `.brand` "Project Hail Mary" text is intentionally hidden below
  820px width** (`@media (max-width:820px){.brand{display:none}}`) — the
  nav goes icon-only on phone-sized viewports, which is the normal/correct
  case for this app. Don't wait on that text as a "the app loaded" signal;
  wait on `.navitem` instead, which is always present.
- **After a real `page.reload()`, all JS state resets** — the frozen
  `page.clock` and the unlocked session are both gone. Re-install the
  clock and re-type the PIN after every reload.
- **Modals overlay rather than replace.** `openProjectDetail()`,
  `openCalendar()`, `openStarred()` etc. append on top of whatever tab
  content was already there instead of clearing it first. If a feature
  renders the same `data-testid` in both a list view and a modal (e.g. the
  project percentage bar in both the project card and its detail modal),
  both can be in the DOM at once — scope the locator to `.modal` rather
  than asserting on the bare testid.
- **`refresh()` overwrites `S.projects`/`S.entries` from `mem`, and
  `mem` lags behind by up to ~800ms** after `saveProject()` (the Drive
  sync debounce). Don't call `refresh()` right after seeding data via
  `saveProject()` in a driver script — it wipes out what you just added.
  `saveProject()` already updates the live `S.projects` synchronously;
  just call `renderShell()`.
- **The `.ed` editor panel fades in over 0.3s** (`.fade{animation:fade
  .3s ease both}`). A screenshot taken immediately after the panel
  appears in the DOM can catch it mid-transition, showing the previous
  screen bleeding through underneath — not a real bug, just a timing
  artifact. Add a ~400ms wait after opening the editor before
  screenshotting it.
- A stray `Failed to load resource: 404` for `/favicon.ico` in the
  console is the browser auto-probing for a favicon the app doesn't
  declare — harmless, ignore it.
