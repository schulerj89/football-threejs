import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  REFERENCE_BENCHMARK_CONFIG,
  REFERENCE_STRUCTURAL_BUDGETS,
  REFERENCE_TIMING_TARGETS,
  classifyRenderer,
  passesReferenceTiming,
  passesSmokeTimingTolerance,
  summarizeFrameSample,
  type FrameSample,
  type FrameTimingSummary,
} from './referenceBenchmark';

interface BenchmarkGameplaySnapshot {
  playState: string;
  playbookId: string;
  players: unknown[];
  selectedPlay: {
    displayName: string;
    id: string;
  };
}

interface BenchmarkRenderMetrics {
  calls: number;
  geometries: number;
  sceneMaterialCount: number;
  shadowCastingObjectCount: number;
  stadiumDrawCallEstimate: number;
  textures: number;
  triangles: number;
  playerBodyMeshCount: number;
}

interface BenchmarkCrowdSnapshot {
  actualSpectatorCount: number;
  crowdDrawCalls: number;
  density: string;
  visualsEnabled: boolean;
}

interface BenchmarkExperienceSnapshot {
  finalSettings: {
    cinematics: string;
    crowdDensity: string;
    crowdReactionsEnabled: boolean;
    crowdVisualsEnabled: boolean;
    gameplayCamera: string;
    playerMotionEnabled: boolean;
    playbookId: string;
    preset: string;
  };
}

interface BenchmarkDebugApi {
  getCrowdPresentationSnapshot: () => BenchmarkCrowdSnapshot | null;
  getGameExperienceSnapshot: () => BenchmarkExperienceSnapshot;
  getGameplaySnapshot: () => BenchmarkGameplaySnapshot;
  getRenderMetrics: () => BenchmarkRenderMetrics;
}

interface BenchmarkReport {
  config: typeof REFERENCE_BENCHMARK_CONFIG;
  debugHelpersVisible: boolean;
  renderer: ReturnType<typeof classifyRenderer>;
  requestedFeatures: {
    lowDensityCrowd: boolean;
    measuredCrowd: boolean;
    proceduralPlayerMotion: boolean;
    referees: boolean;
    stadium: boolean;
  };
  structural: {
    crowd: BenchmarkCrowdSnapshot | null;
    experience: BenchmarkExperienceSnapshot;
    gameplay: {
      playState: string;
      playbookId: string;
      playerCount: number;
      selectedPlay: string;
    };
    renderMetrics: BenchmarkRenderMetrics;
  };
  timing: FrameTimingSummary;
  timingGateEnforced: boolean;
  timingPrimaryTargetPassed: boolean;
  timingSmokeTolerancePassed: boolean;
}

test.describe.configure({ mode: 'serial' });

const STRICT_PERFORMANCE_GATE = process.env.PERF_STRICT === '1';

test('reference production frame pacing and structural budgets', async ({ page }, testInfo) => {
  await page.goto([
    '/?readback=1',
    'experience=broadcast',
    'playbook=11v11',
    'camera=offense',
    'cinematics=brief',
    'crowdVisuals=1',
    'crowdDensity=low',
    'crowdReactions=1',
    'playerMotion=1',
    'routeArt=1',
    'stadium=1',
    'referees=1',
    'quality=locked-broadcast',
  ].join('&'));
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await startGameIfTitleScreenIsVisible(page);
  await expect(page.locator('.debug-overlay')).toBeHidden();
  await expect.poll(() => getDebugApiReady(page)).toBe(true);
  await expect.poll(() => getCrowdSpectatorCount(page)).toBe(REFERENCE_STRUCTURAL_BUDGETS.crowdSpectatorCount);

  const renderer = classifyRenderer(await getWebGlRendererDescription(page));
  const sample = await collectFrameSample(
    page,
    REFERENCE_BENCHMARK_CONFIG.warmupMs,
    REFERENCE_BENCHMARK_CONFIG.sampleDurationMs,
  );
  const timing = summarizeFrameSample(sample);
  const structural = await collectStructuralSnapshot(page);
  const report: BenchmarkReport = {
    config: REFERENCE_BENCHMARK_CONFIG,
    debugHelpersVisible: await page.locator('.debug-overlay').isVisible(),
    renderer,
    requestedFeatures: {
      lowDensityCrowd: true,
      measuredCrowd: true,
      proceduralPlayerMotion: true,
      referees: true,
      stadium: true,
    },
    structural,
    timing,
    timingGateEnforced: STRICT_PERFORMANCE_GATE && !renderer.softwareRendering,
    timingPrimaryTargetPassed: passesReferenceTiming(timing),
    timingSmokeTolerancePassed: passesSmokeTimingTolerance(timing),
  };

  writeBenchmarkReport(report);
  await testInfo.attach('reference-performance-report', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });

  expect(sample.hiddenFrameCount).toBe(0);
  expect(structural.gameplay.playbookId).toBe('11v11');
  expect(structural.gameplay.playerCount).toBe(REFERENCE_STRUCTURAL_BUDGETS.playerCount);
  expect(structural.experience.finalSettings).toMatchObject({
    cinematics: 'brief',
    crowdDensity: 'low',
    crowdReactionsEnabled: true,
    crowdVisualsEnabled: true,
    gameplayCamera: 'offense',
    playerMotionEnabled: true,
    playbookId: '11v11',
    preset: 'broadcast',
  });
  expect(structural.crowd).toMatchObject({
    actualSpectatorCount: REFERENCE_STRUCTURAL_BUDGETS.crowdSpectatorCount,
    density: 'low',
    visualsEnabled: true,
  });
  expect(structural.renderMetrics.calls).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxDrawCalls);
  expect(structural.renderMetrics.triangles).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxTriangles);
  expect(structural.renderMetrics.geometries).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxGeometries);
  expect(structural.renderMetrics.textures).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxTextures);
  expect(structural.renderMetrics.sceneMaterialCount).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxMaterials);
  expect(structural.renderMetrics.playerBodyMeshCount).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxVisiblePlayerMeshes);
  expect(structural.renderMetrics.shadowCastingObjectCount).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxShadowCasters);
  expect(structural.renderMetrics.stadiumDrawCallEstimate).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxStadiumDrawCalls);
  expect(structural.crowd?.crowdDrawCalls ?? 0).toBeLessThanOrEqual(REFERENCE_STRUCTURAL_BUDGETS.maxCrowdDrawCalls);

  if (!renderer.softwareRendering) {
    expect(timing.minRollingFps).toBeGreaterThanOrEqual(REFERENCE_TIMING_TARGETS.minRollingFps);
    expect(timing.belowTargetRollingWindowCount).toBe(0);
    expect(passesSmokeTimingTolerance(timing)).toBe(true);
    if (STRICT_PERFORMANCE_GATE) {
      expect(passesReferenceTiming(timing)).toBe(true);
    }
  }
});

async function getDebugApiReady(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean((window as unknown as { __footballDebug?: unknown }).__footballDebug));
}

async function startGameIfTitleScreenIsVisible(page: Page): Promise<void> {
  const titleScreen = page.locator('.title-screen');

  if (await titleScreen.isVisible()) {
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(titleScreen).toBeHidden();
  }
}

async function getCrowdSpectatorCount(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const debugApi = (window as unknown as { __footballDebug?: BenchmarkDebugApi }).__footballDebug;
    return debugApi?.getCrowdPresentationSnapshot()?.actualSpectatorCount ?? null;
  });
}

async function collectStructuralSnapshot(page: Page): Promise<BenchmarkReport['structural']> {
  return page.evaluate(() => {
    const debugApi = (window as unknown as { __footballDebug?: BenchmarkDebugApi }).__footballDebug;

    if (!debugApi) {
      throw new Error('Missing football debug API.');
    }

    const gameplay = debugApi.getGameplaySnapshot();
    return {
      crowd: debugApi.getCrowdPresentationSnapshot(),
      experience: debugApi.getGameExperienceSnapshot(),
      gameplay: {
        playState: gameplay.playState,
        playbookId: gameplay.playbookId,
        playerCount: gameplay.players.length,
        selectedPlay: gameplay.selectedPlay.displayName,
      },
      renderMetrics: debugApi.getRenderMetrics(),
    };
  });
}

async function getWebGlRendererDescription(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const fallback = 'unknown';

    if (!gl) {
      return fallback;
    }

    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    if (!extension) {
      return fallback;
    }

    return String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) ?? fallback);
  });
}

async function collectFrameSample(
  page: Page,
  warmupMs: number,
  sampleDurationMs: number,
): Promise<FrameSample> {
  return page.evaluate(({ sampleDurationMs: durationMs, warmupMs: warmupDurationMs }) =>
    new Promise<FrameSample>((resolve) => {
      const frameTimesMs: number[] = [];
      const timestampsMs: number[] = [];
      let hiddenFrameCount = 0;
      let lastTimestamp: number | null = null;
      let sampleStartTimestamp: number | null = null;
      let warmupEndTimestamp: number | null = null;

      const tick = (timestamp: number) => {
        if (warmupEndTimestamp === null) {
          warmupEndTimestamp = timestamp + warmupDurationMs;
        }

        if (document.visibilityState !== 'visible') {
          hiddenFrameCount += 1;
          lastTimestamp = null;
          requestAnimationFrame(tick);
          return;
        }

        if (timestamp < warmupEndTimestamp) {
          lastTimestamp = timestamp;
          requestAnimationFrame(tick);
          return;
        }

        if (sampleStartTimestamp === null) {
          sampleStartTimestamp = timestamp;
          lastTimestamp = timestamp;
          timestampsMs.push(0);
          requestAnimationFrame(tick);
          return;
        }

        if (lastTimestamp !== null) {
          frameTimesMs.push(timestamp - lastTimestamp);
          timestampsMs.push(timestamp - sampleStartTimestamp);
        }
        lastTimestamp = timestamp;

        if (timestamp - sampleStartTimestamp >= durationMs) {
          resolve({
            frameTimesMs,
            hiddenFrameCount,
            sampleDurationMs: timestamp - sampleStartTimestamp,
            timestampsMs,
          });
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }), { sampleDurationMs, warmupMs });
}

function writeBenchmarkReport(report: BenchmarkReport): void {
  const outputPath = 'test-results/reference-performance-report.json';
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
