const { test, expect } = require('@playwright/test');
const { openUnlocked } = require('./helpers');

/* Feature 5: Project percentage bars — a completion bar driven by checked
   sub-steps, only shown when a project actually has sub-steps. */

test('a project with sub-steps shows a percentage bar that updates when a step is checked', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');

  await page.evaluate(() => {
    saveProject({
      id: 'test-p1', title: 'Test Project', category: 'Learning', note: '',
      start: todayKey(), target: null, end: null, progress: null,
      subtasks: [
        { id: 's1', title: 'Step 1', done: false, files: [] },
        { id: 's2', title: 'Step 2', done: false, files: [] },
        { id: 's3', title: 'Step 3', done: false, files: [] },
        { id: 's4', title: 'Step 4', done: true, files: [] },
      ],
      updates: [], files: [], createdAt: Date.now(),
    });
    renderShell();
  });

  const bar = page.locator('[data-testid="subtask-bar"][data-project-id="test-p1"]');
  await expect(bar).toBeVisible();
  await expect(page.locator('[data-testid="subtask-bar-label"][data-project-id="test-p1"]')).toContainText('25%');

  await page.evaluate(() => openProjectDetail('test-p1'));
  const modalScope = page.locator('.modal');
  await modalScope.locator('[data-testid="subtask-toggle"][data-subtask-id="s1"]').click();

  await expect(modalScope.locator('[data-testid="subtask-bar-label"][data-project-id="test-p1"]')).toContainText('50%');
});

test('a project with no sub-steps shows no percentage bar', async ({ page }) => {
  await openUnlocked(page, '2026-07-12T09:00:00');

  await page.evaluate(() => {
    saveProject({
      id: 'test-p2', title: 'No Steps Project', category: 'Learning', note: '',
      start: todayKey(), target: null, end: null, progress: null,
      subtasks: [], updates: [], files: [], createdAt: Date.now(),
    });
    renderShell();
  });

  await expect(page.locator('[data-testid="subtask-bar"][data-project-id="test-p2"]')).toHaveCount(0);
});
