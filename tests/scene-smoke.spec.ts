import { expect, test, type Page } from '@playwright/test';

interface PlayerSnapshot {
  position: { x: number; z: number };
  velocity: { x: number; z: number };
  facingRadians: number;
}

interface GameplaySnapshot {
  ball: {
    possession: { kind: 'none' } | { kind: 'player'; playerId: string };
    position: { x: number; y: number; z: number };
  };
  lastPlayResult: 'none' | 'touchdown';
  player: PlayerSnapshot;
  playState: 'preSnap' | 'live' | 'dead';
  score: number;
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
  await expect(page.locator('.score-counter')).toHaveText('Score 0');
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
    { key: 'a', axis: 'x', sign: 1 },
    { key: 'ArrowLeft', axis: 'x', sign: 1 },
    { key: 'd', axis: 'x', sign: -1 },
    { key: 'ArrowRight', axis: 'x', sign: -1 },
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
    await page.keyboard.press('Space');
    await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
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

test('keeps D reserved for movement instead of debug toggling', async ({ page }) => {
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.debug-overlay')).toBeVisible();
  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  const before = await getPlayerSnapshot(page);

  await page.keyboard.down('d');
  await page.waitForTimeout(350);
  await page.keyboard.up('d');

  const after = await getPlayerSnapshot(page);
  expect(after.position.x).toBeLessThan(before.position.x);
  await expect(page.locator('.debug-overlay')).toBeVisible();
});

test('runs pre-snap, live, possession, and reset loop', async ({ page }) => {
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  const initial = await getGameplaySnapshot(page);

  expect(initial.playState).toBe('preSnap');
  expect(initial.ball.possession).toEqual({ kind: 'none' });
  expect(initial.player.position).toEqual({ x: 0, z: -15 });

  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  const afterPreSnapMove = await getGameplaySnapshot(page);

  expect(afterPreSnapMove.playState).toBe('preSnap');
  expect(afterPreSnapMove.player.position.x).toBeCloseTo(initial.player.position.x);
  expect(afterPreSnapMove.player.position.z).toBeCloseTo(initial.player.position.z);

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { possession: { kind: 'player' } },
    playState: 'live',
  });

  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  const afterLiveMove = await getGameplaySnapshot(page);

  expect(afterLiveMove.player.position.z).toBeGreaterThan(initial.player.position.z);
  expect(afterLiveMove.ball.possession).toMatchObject({ kind: 'player' });
  expect(afterLiveMove.ball.position.z).toBeGreaterThan(initial.player.position.z);

  await page.keyboard.press('r');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({
    ball: { possession: { kind: 'none' } },
    lastPlayResult: 'none',
    player: { position: { x: 0, z: -15 }, velocity: { x: 0, z: 0 } },
    playState: 'preSnap',
  });
});

test('scores touchdown, disables dead-ball movement, and auto-resets', async ({ page }) => {
  await page.goto('/?debug=1&readback=1');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.score-counter')).toHaveText('Score 0');

  await page.keyboard.press('Space');
  await expect.poll(() => getGameplaySnapshot(page)).toMatchObject({ playState: 'live' });
  await page.keyboard.down('w');
  await expect.poll(async () => (await getGameplaySnapshot(page)).playState, {
    timeout: 7000,
  }).toBe('dead');
  await page.keyboard.up('w');

  const touchdown = await getGameplaySnapshot(page);
  expect(touchdown.lastPlayResult).toBe('touchdown');
  expect(touchdown.score).toBe(6);
  await expect(page.locator('.score-counter')).toHaveText('Score 6');
  await expect(page.locator('.touchdown-message')).toBeVisible();

  await page.keyboard.down('w');
  await page.waitForTimeout(250);
  await page.keyboard.up('w');
  const whileDead = await getGameplaySnapshot(page);
  expect(whileDead.player.position.z).toBeCloseTo(touchdown.player.position.z);
  expect(whileDead.score).toBe(6);

  await expect.poll(() => getGameplaySnapshot(page), { timeout: 3000 }).toMatchObject({
    ball: { possession: { kind: 'none' } },
    lastPlayResult: 'none',
    player: { position: { x: 0, z: -15 }, velocity: { x: 0, z: 0 } },
    playState: 'preSnap',
    score: 6,
  });
  await expect(page.locator('.score-counter')).toHaveText('Score 6');
  await expect(page.locator('.touchdown-message')).toBeHidden();
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

async function getGameplaySnapshot(page: Page): Promise<GameplaySnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getGameplaySnapshot: () => GameplaySnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API');
    }

    return debugApi.getGameplaySnapshot();
  });
}
