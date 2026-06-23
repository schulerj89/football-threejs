import { expect, test } from '@playwright/test';

test('player base harness loads the art-source rigged model and stance controls', async ({ page }) => {
  await page.goto('/player-base-harness.html');

  await expect(page.getByRole('heading', { name: 'Player Base Rig Harness' })).toBeVisible();
  await expect(page.getByText('art-source/meshy/player-base/rigged/player-base-rigged.glb')).toBeVisible();
  await page.waitForFunction(() => {
    return Boolean(window.__PLAYER_BASE_HARNESS__?.getSnapshot().loaded);
  });

  const snapshot = await page.evaluate(() => window.__PLAYER_BASE_HARNESS__?.getSnapshot());
  expect(snapshot?.route).toBe('player-base-harness');
  expect(snapshot?.boneCount).toBeGreaterThanOrEqual(20);
  expect(snapshot?.controlCount).toBeGreaterThanOrEqual(30);
  expect(snapshot?.meshCount).toBeGreaterThan(0);
  expect(snapshot?.triangleCount).toBeGreaterThan(0);

  await page.getByLabel('Stance').selectOption('defensive_lineman');
  const presetSnapshot = await page.evaluate(() => window.__PLAYER_BASE_HARNESS__?.getSnapshot());
  expect(presetSnapshot?.currentPresetId).toBe('defensive_lineman');

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
      if (data[index] !== 8 || data[index + 1] !== 16 || data[index + 2] !== 13) {
        count += 1;
      }
    }
    return count;
  });
  expect(nonBlankPixelCount).toBeGreaterThan(100);
});
