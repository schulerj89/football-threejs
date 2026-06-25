import { expect, test, type Page } from '@playwright/test';

interface WeatherSnapshot {
  condition: 'clear' | 'overcast' | 'rain';
  precipitationObjectCount: number;
  rainFallOffset: number;
  rainStreakCount: number;
}

test('rain weather animates during gameplay rendering', async ({ page }) => {
  await page.goto('/?debug=1&readback=1&experience=performance&camera=tactical&playbook=11v11&weather=rain&audio=0&crowdVisuals=0&cinematics=off');
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();

  const first = await getWeatherSnapshot(page);
  expect(first).toMatchObject({
    condition: 'rain',
    precipitationObjectCount: 1,
  });
  expect(first.rainStreakCount).toBeGreaterThan(100);

  await page.waitForTimeout(180);
  const second = await getWeatherSnapshot(page);
  expect(second.rainFallOffset).not.toBeCloseTo(first.rainFallOffset, 4);
});

async function getWeatherSnapshot(page: Page): Promise<WeatherSnapshot> {
  return page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getWeatherSnapshot: () => WeatherSnapshot;
        };
      }
    ).__footballDebug;
    if (!debugApi) {
      throw new Error('Missing football debug API');
    }
    return debugApi.getWeatherSnapshot();
  });
}
