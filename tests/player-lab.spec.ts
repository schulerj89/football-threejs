import { expect, test } from '@playwright/test';

test('player lab route loads the shared preview player', async ({ page }) => {
  await page.goto('/player-lab.html');

  await expect(page.getByRole('heading', { name: 'Player Pose Lab' })).toBeVisible();
  await expect(page.getByText('Development-only procedural mannequin pose and animation tool.')).toBeVisible();
  await page.waitForFunction(() => {
    return Boolean(window.__PLAYER_LAB__ && window.__PLAYER_LAB__.getSnapshot().meshCount > 0);
  });

  const snapshot = await page.evaluate(() => window.__PLAYER_LAB__?.getSnapshot());
  expect(snapshot?.route).toBe('player-lab');
  expect(snapshot?.visualProfileId).toBe('football-player-v1');
  expect(snapshot?.meshCount).toBeGreaterThan(0);
  expect(snapshot?.triangleCount).toBeGreaterThan(0);
  expect(snapshot?.currentPoseId).toBe('neutral');

  await page.getByLabel('show skeleton/pivots').check();
  const helperSnapshot = await page.evaluate(() => window.__PLAYER_LAB__?.getSnapshot());
  expect(helperSnapshot?.helperCount).toBeGreaterThan(0);
});
