import { expect, test, type Page } from '@playwright/test';

interface MountainBowlSnapshot {
  bounds: {
    maxY: number;
    minZ: number;
  };
  peakCount: number;
  ridgeCount: number;
  snowCapCount: number;
  treeLineCount: number;
  triangleCount: number;
}

interface StadiumSnapshot {
  enabled: boolean;
  mountainBowl: MountainBowlSnapshot | null;
  themeId: 'classicBowl' | 'mountainBowl';
  triangles: number;
}

interface StageVisualMatrixSnapshot {
  coinToss: { visibleCount: number };
  gameplay: { visibleCount: number };
  kickoff: { visibleCount: number };
  normalOfficialsVisibleCount: number;
  warmup: { visibleFullProfileCount: number };
}

test('mountain bowl preview shows procedural mountains without on-field player actors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?readback=1&audio=0&stadiumTheme=mountainBowl&stadiumPreview=1&userTeam=summit-forge&opponentTeam=metro-meteors');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const stadium = await getStadiumSnapshot(page);
  expect(stadium.enabled).toBe(true);
  expect(stadium.themeId).toBe('mountainBowl');
  expect(stadium.mountainBowl).toMatchObject({
    peakCount: 24,
    ridgeCount: 3,
    treeLineCount: 24,
  });
  expect(stadium.mountainBowl?.snowCapCount).toBeGreaterThan(0);
  expect(stadium.mountainBowl?.bounds.maxY).toBeGreaterThan(55);
  expect(stadium.mountainBowl?.bounds.minZ).toBeGreaterThan(70);
  expect(stadium.triangles).toBeGreaterThan(stadium.mountainBowl?.triangleCount ?? 0);

  const stage = await getStageVisualMatrixSnapshot(page);
  expect(stage.gameplay.visibleCount).toBe(0);
  expect(stage.kickoff.visibleCount).toBe(0);
  expect(stage.coinToss.visibleCount).toBe(0);
  expect(stage.warmup.visibleFullProfileCount).toBe(0);
  expect(stage.normalOfficialsVisibleCount).toBe(0);
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
