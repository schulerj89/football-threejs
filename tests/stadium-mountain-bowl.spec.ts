import { expect, test, type Page } from '@playwright/test';

interface MountainBowlSnapshot {
  baseBermCount: number;
  bounds: {
    maxY: number;
    minZ: number;
  };
  edgeFeathered: boolean;
  peakCount: number;
  retainingWallPanelCount: number;
  rockFacetCount: number;
  ridgeCount: number;
  scenicBounds: {
    minZ: number;
  };
  servicePathCount: number;
  snowCapCount: number;
  terraceShelfCount: number;
  treeLineCount: number;
  triangleCount: number;
  valleySkirtSegmentCount: number;
}

interface StadiumSnapshot {
  enabled: boolean;
  mountainBowl: MountainBowlSnapshot | null;
  themeId: 'classicBowl' | 'mountainBowl';
  triangles: number;
}

interface StageVisualMatrixSnapshot {
  activePrimaryGroups?: string[];
  appPhase?: string;
  coinToss: { visibleCount: number };
  gameplay: { visibleCount: number };
  kickoff: { visibleCount: number };
  normalOfficialsVisibleCount: number;
  warmup: {
    enabled?: boolean;
    helmetReady?: boolean;
    quarterbackReady?: boolean;
    visibleFullProfileCount: number;
  };
}

interface PregamePresentationSnapshot {
  currentShot: string | null;
  phase: string;
  skipState: string;
  weatherCondition: string;
}

test('mountain bowl preview shows procedural mountains without on-field player actors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?readback=1&audio=0&stadiumTheme=mountainBowl&stadiumPreview=1&userTeam=summit-forge&opponentTeam=metro-meteors');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const stadium = await getStadiumSnapshot(page);
  expect(stadium.enabled).toBe(true);
  expect(stadium.themeId).toBe('mountainBowl');
  expect(stadium.mountainBowl).toMatchObject({
    baseBermCount: 3,
    edgeFeathered: true,
    retainingWallPanelCount: 7,
    ridgeCount: 3,
    servicePathCount: 10,
    terraceShelfCount: 5,
    treeLineCount: 24,
    valleySkirtSegmentCount: 4,
  });
  expect(stadium.mountainBowl?.peakCount).toBeGreaterThanOrEqual(30);
  expect(stadium.mountainBowl?.rockFacetCount).toBeGreaterThanOrEqual(15);
  expect(stadium.mountainBowl?.snowCapCount).toBeGreaterThan(0);
  expect(stadium.mountainBowl?.bounds.maxY).toBeGreaterThan(55);
  expect(stadium.mountainBowl?.scenicBounds.minZ).toBeGreaterThan(70);
  expect(stadium.mountainBowl?.bounds.minZ).toBeLessThan(70);
  expect(stadium.mountainBowl?.triangleCount).toBeGreaterThan(15_000);
  expect(stadium.mountainBowl?.triangleCount).toBeLessThan(25_000);
  expect(stadium.triangles).toBeGreaterThan(stadium.mountainBowl?.triangleCount ?? 0);

  const stage = await getStageVisualMatrixSnapshot(page);
  expect(stage.gameplay.visibleCount).toBe(0);
  expect(stage.kickoff.visibleCount).toBe(0);
  expect(stage.coinToss.visibleCount).toBe(0);
  expect(stage.warmup.visibleFullProfileCount).toBe(0);
  expect(stage.normalOfficialsVisibleCount).toBe(0);
});

test('mountain bowl launches through play now game settings with warmup players', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await expect(page.locator('.title-screen')).toBeVisible();

  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('.football-hub-screen')).toBeVisible();
  await page.locator('.football-hub-playnow-matchup').getByRole('button', { name: 'Game Settings' }).click();
  await expect(page.locator('.football-hub-game-settings')).toBeVisible();
  await page.getByLabel('Add mountains').check();
  await page.locator('.football-hub-game-settings').getByRole('button', { name: 'Play Game' }).click();

  await expect(page.locator('body[data-app-phase="pregamePresentation"]')).toBeAttached();
  await expect(page.locator('.play-call-ui')).toBeHidden();

  const stadium = await getStadiumSnapshot(page);
  expect(stadium.enabled).toBe(true);
  expect(stadium.themeId).toBe('mountainBowl');
  expect(stadium.mountainBowl).toMatchObject({
    retainingWallPanelCount: 7,
    servicePathCount: 10,
    terraceShelfCount: 5,
  });

  await expect.poll(() => getPregamePresentationSnapshot(page)).toMatchObject({
    currentShot: 'stadiumCenterOrbit',
    phase: 'running',
    skipState: 'available',
  });
  await expect.poll(() => getStageVisualMatrixSnapshot(page), { timeout: 10_000 }).toMatchObject({
    activePrimaryGroups: ['warmupPlayers'],
    appPhase: 'pregamePresentation',
    coinToss: {
      visibleCount: 0,
    },
    gameplay: {
      visibleCount: 0,
    },
    kickoff: {
      visibleCount: 0,
    },
    normalOfficialsVisibleCount: 0,
    warmup: {
      enabled: true,
      helmetReady: true,
      quarterbackReady: true,
      visibleFullProfileCount: 1,
    },
  });
});

async function getStadiumSnapshot(page: Page): Promise<StadiumSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getStadiumSnapshot: () => StadiumSnapshot;
        };
      }
    ).__footballDebug;
    if (!debugApi) {
      throw new Error('Missing football debug API');
    }
    return debugApi.getStadiumSnapshot();
  });
}

async function getStageVisualMatrixSnapshot(page: Page): Promise<StageVisualMatrixSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getStageVisualMatrixSnapshot: () => StageVisualMatrixSnapshot;
        };
      }
    ).__footballDebug;
    if (!debugApi) {
      throw new Error('Missing football debug API');
    }
    return debugApi.getStageVisualMatrixSnapshot();
  });
}

async function getPregamePresentationSnapshot(page: Page): Promise<PregamePresentationSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getPregamePresentationSnapshot: () => PregamePresentationSnapshot;
        };
      }
    ).__footballDebug;
    if (!debugApi) {
      throw new Error('Missing football debug API');
    }
    return debugApi.getPregamePresentationSnapshot();
  });
}
