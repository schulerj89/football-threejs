import { expect, test, type Page } from '@playwright/test';

interface PlayerSnapshot {
  position: { x: number; z: number };
  velocity: { x: number; z: number };
  facingRadians: number;
}

test('starts the Three.js graybox field scene', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.debug-overlay')).toContainText('FPS');
  await expectNonBlankCanvas(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const canvasElement = document.querySelector('canvas');
    return canvasElement?.clientWidth === window.innerWidth && canvasElement.clientHeight === window.innerHeight;
  });
  await expectNonBlankCanvas(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('moves the placeholder player with WASD and arrow keys', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const movementCases = [
    { key: 'w', axis: 'z', sign: 1 },
    { key: 'ArrowUp', axis: 'z', sign: 1 },
    { key: 's', axis: 'z', sign: -1 },
    { key: 'ArrowDown', axis: 'z', sign: -1 },
    { key: 'a', axis: 'x', sign: -1 },
    { key: 'ArrowLeft', axis: 'x', sign: -1 },
    { key: 'd', axis: 'x', sign: 1 },
    { key: 'ArrowRight', axis: 'x', sign: 1 },
  ] as const;

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  for (const movementCase of movementCases) {
    await page.goto('/?debug=1&readback=1');
    await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
    const before = await getPlayerSnapshot(page);

    await page.keyboard.down(movementCase.key);
    await page.waitForTimeout(350);
    await page.keyboard.up(movementCase.key);

    const after = await getPlayerSnapshot(page);
    const delta = after.position[movementCase.axis] - before.position[movementCase.axis];
    expect(Math.sign(delta), movementCase.key).toBe(movementCase.sign);
  }

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

async function expectNonBlankCanvas(page: Page): Promise<void> {
  let renderState = await readCanvasState(page);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (renderState.nonBlankPixels > 100 && renderState.uniqueColors > 3) {
      break;
    }

    await page.waitForTimeout(50);
    renderState = await readCanvasState(page);
  }

  expect(renderState.hasCanvas).toBe(true);
  expect(renderState.width).toBeGreaterThan(0);
  expect(renderState.height).toBeGreaterThan(0);
  expect(renderState.nonBlankPixels).toBeGreaterThan(100);
  expect(renderState.uniqueColors).toBeGreaterThan(3);
}

async function readCanvasState(page: Page): Promise<{
  hasCanvas: boolean;
  height: number;
  nonBlankPixels: number;
  uniqueColors: number;
  width: number;
}> {
  return page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) {
      return { hasCanvas: false, nonBlankPixels: 0, uniqueColors: 0, width: 0, height: 0 };
    }

    const context = canvasElement.getContext('webgl2') ?? canvasElement.getContext('webgl');
    const width = canvasElement.width;
    const height = canvasElement.height;
    const sampleWidth = Math.min(96, width);
    const sampleHeight = Math.min(96, height);
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);

    context?.readPixels(
      Math.floor((width - sampleWidth) / 2),
      Math.floor((height - sampleHeight) / 2),
      sampleWidth,
      sampleHeight,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );

    let nonBlankPixels = 0;
    const uniqueColors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 0 || pixels[index + 1] !== 0 || pixels[index + 2] !== 0) {
        nonBlankPixels += 1;
      }
      uniqueColors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
    }

    return { hasCanvas: true, nonBlankPixels, uniqueColors: uniqueColors.size, width, height };
  });
}

async function getPlayerSnapshot(page: Page): Promise<PlayerSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPlayerSnapshot: () => PlayerSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getPlayerSnapshot();
  });
}
