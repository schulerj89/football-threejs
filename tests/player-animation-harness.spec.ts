import { expect, test } from '@playwright/test';

test('low poly player animation harness loads player, helmet, and clips', async ({ page }) => {
  await page.goto('/player-animation-harness.html');

  await expect(page.getByRole('heading', { name: 'Low Poly Player Animation Harness' })).toBeVisible();
  await expect(page.getByText('Loads low_poly_player.glb')).toBeVisible();
  await page.waitForFunction(() => {
    return Boolean(window.__LOW_POLY_PLAYER_ANIMATION_HARNESS__?.getSnapshot().loaded);
  });

  const snapshot = await page.evaluate(() => window.__LOW_POLY_PLAYER_ANIMATION_HARNESS__?.getSnapshot());
  expect(snapshot?.route).toBe('player-animation-harness');
  expect(snapshot?.animationCount).toBeGreaterThanOrEqual(1);
  expect(snapshot?.boneCount).toBeGreaterThanOrEqual(20);
  expect(snapshot?.bodyLabelCount).toBeGreaterThanOrEqual(12);
  expect(snapshot?.colorControlCount).toBeGreaterThanOrEqual(20);
  expect(snapshot?.helmetAttached).toBe(true);
  expect(snapshot?.helmetParentName).toBe('Head');
  expect(snapshot?.meshCount).toBeGreaterThan(0);
  expect(snapshot?.triangleCount).toBeGreaterThan(0);

  const bodyLabels = page.locator('.player-animation-harness__label-layer');
  await expect(bodyLabels.getByText('Head', { exact: true })).toBeVisible();
  await expect(bodyLabels.getByText('L Upper Arm', { exact: true })).toBeVisible();
  await page.getByLabel('L Upper Arm').fill('#d92323');
  await page.getByLabel('R Knee').fill('#1f9a57');
  await page.getByLabel('Helmet shell').fill('#111111');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByLabel('Show skeleton').check();
  await page.getByLabel('Show body labels').uncheck();
  await expect(bodyLabels.getByText('Head', { exact: true })).toBeHidden();

  const nonBlankPixelCount = await page.locator('canvas').evaluate((canvas) => {
    const target = canvas as HTMLCanvasElement;
    const gl = target.getContext('webgl2', { preserveDrawingBuffer: true }) ??
      target.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      return 0;
    }
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] !== 7 || data[index + 1] !== 16 || data[index + 2] !== 14) {
        count += 1;
      }
    }
    return count;
  });
  expect(nonBlankPixelCount).toBeGreaterThan(100);
});
