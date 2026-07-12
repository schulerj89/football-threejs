import { expect, test } from '@playwright/test';

test('voxel player harness loads the production rig and helmet', async ({ page }) => {
  await page.goto('/voxel-player-harness.html');

  await expect(page.getByRole('heading', { name: 'Voxel Player Harness' })).toBeVisible();
  await expect(page.getByText('/models/player/player-base-rigged.glb')).toBeVisible();
  await page.waitForFunction(() => {
    return Boolean(window.__VOXEL_PLAYER_HARNESS__?.getSnapshot().loaded);
  });

  const snapshot = await page.evaluate(() => window.__VOXEL_PLAYER_HARNESS__?.getSnapshot());
  expect(snapshot).toMatchObject({
    headAnchorName: 'placeholder-player-head-anchor',
    helmetAttached: true,
    helmetParentName: 'placeholder-player-head-anchor',
    helmetVisible: true,
    loaded: true,
    pose: 'neutral',
    route: 'voxel-player-harness',
    visualMode: 'meshyRigged',
  });
  expect(snapshot?.boneCount).toBeGreaterThanOrEqual(20);
  expect(snapshot?.meshCount).toBeGreaterThan(0);
  expect(snapshot?.triangleCount).toBeGreaterThan(0);
  expect(snapshot?.geometries).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Ready' }).click();
  await expect.poll(async () => {
    return await page.evaluate(() => window.__VOXEL_PLAYER_HARNESS__?.getSnapshot().pose);
  }).toBe('ready');

  await page.getByRole('button', { name: 'Run' }).click();
  await page.getByLabel('Show skeleton').check();
  await page.getByLabel('Show helmet').uncheck();
  await expect.poll(async () => {
    return await page.evaluate(() => window.__VOXEL_PLAYER_HARNESS__?.getSnapshot());
  }).toMatchObject({
    helmetAttached: true,
    helmetVisible: false,
    pose: 'run',
  });
  await page.getByLabel('Show helmet').check();

  await expect.poll(async () => {
    return await page.locator('canvas').evaluate((canvas) => {
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
        if (data[index] !== 7 || data[index + 1] !== 17 || data[index + 2] !== 14) {
          count += 1;
        }
      }
      return count;
    });
  }).toBeGreaterThan(100);
});
