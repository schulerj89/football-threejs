import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  PERFORMANCE_FRAME_THRESHOLDS_MS,
  PERFORMANCE_REFERENCE_PROFILE,
  PERFORMANCE_SCENARIOS,
  PERFORMANCE_STRUCTURAL_BUDGETS,
  type PerformanceScenarioName,
} from '../../src/performance/PerformanceBudget';
import type {
  PerformanceReport,
  PerformanceReportEnvironment,
} from '../../src/performance/PerformanceReport';

interface PerformanceDebugApi {
  clearPerformanceSamples: () => void;
  getPerformanceProfileReport: (
    environment?: Partial<PerformanceReportEnvironment>,
  ) => PerformanceReport;
  setPerformanceScenario: (scenario: PerformanceScenarioName) => unknown;
}

interface ScenarioRun {
  profileId: string;
  report: PerformanceReport;
  sampleDurationMs: number;
  scenario: PerformanceScenarioName | 'seven-presnap-baseline';
}

interface ElevenPerformanceMatrixReport {
  comparisonRuns: ScenarioRun[];
  fullBroadcastRuns: ScenarioRun[];
  generatedAt: string;
  profileDescriptions: Record<string, string>;
  runMode: PerformanceRunMode;
  sevenOnSevenBaseline: ScenarioRun | null;
  summaryText: string;
}

type PerformanceRunMode = 'full' | 'smoke';

const PERFORMANCE_RUN_MODE: PerformanceRunMode =
  process.env.FOOTBALL_PERF_MODE === 'full' ? 'full' : 'smoke';
const PERFORMANCE_SMOKE_SCENARIOS: readonly PerformanceScenarioName[] = [
  'eleven-presnap',
  'eleven-run-interior',
  'eleven-pass-flight',
  'eleven-touchdown-presentation',
] as const;
const COMPARISON_SMOKE_SCENARIOS: readonly PerformanceScenarioName[] = [
  'eleven-presnap',
] as const;

const FULL_SAMPLE_DURATION_MS = Number(
  process.env.FOOTBALL_PERF_SAMPLE_MS ??
    (PERFORMANCE_RUN_MODE === 'full' ? PERFORMANCE_REFERENCE_PROFILE.sampleDurationMs : 2_500),
);
const COMPARISON_SAMPLE_DURATION_MS = Number(
  process.env.FOOTBALL_PERF_COMPARISON_SAMPLE_MS ??
    (PERFORMANCE_RUN_MODE === 'full' ? 3_000 : 1_500),
);
const WARMUP_MS = Number(
  process.env.FOOTBALL_PERF_WARMUP_MS ??
    (PERFORMANCE_RUN_MODE === 'full' ? PERFORMANCE_REFERENCE_PROFILE.warmupMs : 750),
);
const STRICT_PERFORMANCE_GATE = process.env.PERF_STRICT === '1';

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  'crowd-off': '11v11 with visual crowd disabled.',
  'full-broadcast': '11v11 broadcast profile with full crowd fullness, brief cinematics, audio permitted.',
  'motion-off': '11v11 with procedural player motion disabled.',
  'officials-off': '11v11 with presentation-only officials disabled.',
  'players-only': '11v11 players and field with presentation, crowd, route art, and audio disabled.',
  'presentation-off': '11v11 with cinematics, announcer, captions, crowd reactions, and audio disabled.',
  'stadium-off': '11v11 with stadium/crowd seating presentation disabled.',
};

const FULL_BROADCAST_QUERY = {
  announcer: '1',
  audio: '1',
  camera: 'offense',
  cinematics: 'brief',
  crowdFullness: 'full',
  crowdReactions: '1',
  crowdVisuals: '1',
  experience: 'broadcast',
  officials: '1',
  perfProfile: '1',
  playbook: '11v11',
  playerMotion: '1',
  quality: 'locked-broadcast',
  readback: '1',
  routeArt: '1',
  stadium: '1',
};

const COMPARISON_PROFILES: Array<{
  id: string;
  query: Record<string, string>;
}> = [
  {
    id: 'players-only',
    query: {
      announcer: '0',
      audio: '0',
      camera: 'offense',
      cinematics: 'off',
      crowdReactions: '0',
      crowdVisuals: '0',
      experience: 'performance',
      officials: '0',
      perfProfile: '1',
      playbook: '11v11',
      playerMotion: '0',
      quality: 'locked-performance',
      readback: '1',
      routeArt: '0',
      stadium: '0',
    },
  },
  {
    id: 'stadium-off',
    query: {
      ...FULL_BROADCAST_QUERY,
      crowdVisuals: '0',
      stadium: '0',
    },
  },
  {
    id: 'crowd-off',
    query: {
      ...FULL_BROADCAST_QUERY,
      crowdReactions: '0',
      crowdVisuals: '0',
    },
  },
  {
    id: 'officials-off',
    query: {
      ...FULL_BROADCAST_QUERY,
      officials: '0',
    },
  },
  {
    id: 'motion-off',
    query: {
      ...FULL_BROADCAST_QUERY,
      playerMotion: '0',
    },
  },
  {
    id: 'presentation-off',
    query: {
      ...FULL_BROADCAST_QUERY,
      announcer: '0',
      audio: '0',
      captions: '0',
      cinematics: 'off',
      crowdReactions: '0',
    },
  },
];

test.describe.configure({ mode: 'serial' });

test('profiles deterministic 11v11 production scenarios', async ({ browser }, testInfo) => {
  const fullBroadcastRuns: ScenarioRun[] = [];
  const comparisonRuns: ScenarioRun[] = [];
  let sevenOnSevenBaseline: ScenarioRun | null = null;
  const fullBroadcastScenarios = PERFORMANCE_RUN_MODE === 'full'
    ? PERFORMANCE_SCENARIOS
    : PERFORMANCE_SMOKE_SCENARIOS;
  const comparisonScenarios = PERFORMANCE_RUN_MODE === 'full'
    ? PERFORMANCE_SCENARIOS
    : COMPARISON_SMOKE_SCENARIOS;

  const fullPage = await browser.newPage({
    deviceScaleFactor: PERFORMANCE_REFERENCE_PROFILE.deviceScaleFactor,
    viewport: {
      height: PERFORMANCE_REFERENCE_PROFILE.height,
      width: PERFORMANCE_REFERENCE_PROFILE.width,
    },
  });
  await preparePerformancePage(fullPage, FULL_BROADCAST_QUERY);
  const environment = await createEnvironmentSnapshot(fullPage);

  for (const scenario of fullBroadcastScenarios) {
    fullBroadcastRuns.push(await runScenario(
      fullPage,
      'full-broadcast',
      scenario,
      FULL_SAMPLE_DURATION_MS,
      environment,
    ));
  }
  await fullPage.close();

  const sevenPage = await browser.newPage({
    deviceScaleFactor: PERFORMANCE_REFERENCE_PROFILE.deviceScaleFactor,
    viewport: {
      height: PERFORMANCE_REFERENCE_PROFILE.height,
      width: PERFORMANCE_REFERENCE_PROFILE.width,
    },
  });
  await preparePerformancePage(sevenPage, {
    ...FULL_BROADCAST_QUERY,
    playbook: '7v7',
  });
  sevenOnSevenBaseline = await runCurrentStateProfile(
    sevenPage,
    '7v7-baseline',
    'seven-presnap-baseline',
    COMPARISON_SAMPLE_DURATION_MS,
    await createEnvironmentSnapshot(sevenPage),
  );
  await sevenPage.close();

  for (const profile of COMPARISON_PROFILES) {
    const page = await browser.newPage({
      deviceScaleFactor: PERFORMANCE_REFERENCE_PROFILE.deviceScaleFactor,
      viewport: {
        height: PERFORMANCE_REFERENCE_PROFILE.height,
        width: PERFORMANCE_REFERENCE_PROFILE.width,
      },
    });
    await preparePerformancePage(page, profile.query);
    const profileEnvironment = await createEnvironmentSnapshot(page);

    for (const scenario of comparisonScenarios) {
      comparisonRuns.push(await runScenario(
        page,
        profile.id,
        scenario,
        COMPARISON_SAMPLE_DURATION_MS,
        profileEnvironment,
      ));
    }
    await page.close();
  }

  const matrixReport = createMatrixReport(fullBroadcastRuns, comparisonRuns, sevenOnSevenBaseline);
  writeMatrixReport(matrixReport);
  await testInfo.attach('eleven-performance-report', {
    body: JSON.stringify(matrixReport, null, 2),
    contentType: 'application/json',
  });

  expect(fullBroadcastRuns).toHaveLength(fullBroadcastScenarios.length);
  for (const run of fullBroadcastRuns) {
    expect(run.report.frame.sampleCount).toBeGreaterThan(0);
    expect(run.report.scene.playerMeshCount).toBeGreaterThan(0);
    expect(run.report.scene.crowdInstanceCount).toBeGreaterThanOrEqual(500);
    expect(run.report.renderer.calls).toBeGreaterThan(0);
    expect(run.report.bottlenecks).toHaveLength(5);
    enforcePerformanceRunBudgets(run);
  }
});

function enforcePerformanceRunBudgets(run: ScenarioRun): void {
  expect(run.report.renderer.calls).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxDrawCalls);
  expect(run.report.renderer.triangles).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxTriangles);
  expect(run.report.renderer.geometries).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxGeometries);
  expect(run.report.renderer.textures).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxTextures);
  expect(run.report.scene.materialCount).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxMaterials);
  expect(run.report.scene.playerMeshCount).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxVisiblePlayerMeshes);
  expect(run.report.scene.shadowCastingObjectCount).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxShadowCasters);
  expect(run.report.scene.stadiumMeshCount).toBeLessThanOrEqual(PERFORMANCE_STRUCTURAL_BUDGETS.maxStadiumDrawCalls);

  if (run.report.environment.softwareRendering) {
    return;
  }

  if (run.sampleDurationMs >= 1_000) {
    expect(run.report.frame.minimumRollingOneSecondFps).toBeGreaterThanOrEqual(55);
  }
  if (STRICT_PERFORMANCE_GATE) {
    expect(run.report.frame.median).toBeLessThanOrEqual(PERFORMANCE_FRAME_THRESHOLDS_MS.target60Fps);
    expect(run.report.frame.p95).toBeLessThanOrEqual(PERFORMANCE_FRAME_THRESHOLDS_MS.target55Fps);
    expect(run.report.frame.p99).toBeLessThanOrEqual(PERFORMANCE_FRAME_THRESHOLDS_MS.longFrame);
  }
}

async function preparePerformancePage(
  page: Page,
  query: Record<string, string>,
): Promise<void> {
  await page.goto(`/?${new URLSearchParams(query).toString()}`);
  await expect(page.locator('body[data-scene-ready="true"]')).toBeAttached();
  await startGameIfTitleScreenIsVisible(page);
  await expect.poll(() => getPerformanceDebugApiReady(page)).toBe(true);
  await expect(page.locator('.debug-overlay')).toBeHidden();
}

async function runScenario(
  page: Page,
  profileId: string,
  scenario: PerformanceScenarioName,
  sampleDurationMs: number,
  environment: PerformanceReportEnvironment,
): Promise<ScenarioRun> {
  await page.evaluate((scenarioName) => {
    const debugApi = (window as unknown as { __footballDebug?: PerformanceDebugApi }).__footballDebug;
    debugApi?.setPerformanceScenario(scenarioName);
  }, scenario);
  await page.waitForTimeout(WARMUP_MS);
  await page.evaluate(() => {
    const debugApi = (window as unknown as { __footballDebug?: PerformanceDebugApi }).__footballDebug;
    debugApi?.clearPerformanceSamples();
  });
  await page.waitForTimeout(sampleDurationMs);
  const report = await page.evaluate((environmentSnapshot) => {
    const debugApi = (window as unknown as { __footballDebug?: PerformanceDebugApi }).__footballDebug;
    if (!debugApi) {
      throw new Error('Missing football debug API.');
    }
    return debugApi.getPerformanceProfileReport(environmentSnapshot);
  }, environment);

  return {
    profileId,
    report,
    sampleDurationMs,
    scenario,
  };
}

async function runCurrentStateProfile(
  page: Page,
  profileId: string,
  scenario: ScenarioRun['scenario'],
  sampleDurationMs: number,
  environment: PerformanceReportEnvironment,
): Promise<ScenarioRun> {
  await page.waitForTimeout(WARMUP_MS);
  await page.evaluate(() => {
    const debugApi = (window as unknown as { __footballDebug?: PerformanceDebugApi }).__footballDebug;
    debugApi?.clearPerformanceSamples();
  });
  await page.waitForTimeout(sampleDurationMs);
  const report = await page.evaluate((environmentSnapshot) => {
    const debugApi = (window as unknown as { __footballDebug?: PerformanceDebugApi }).__footballDebug;
    if (!debugApi) {
      throw new Error('Missing football debug API.');
    }
    return debugApi.getPerformanceProfileReport(environmentSnapshot);
  }, environment);

  return {
    profileId,
    report,
    sampleDurationMs,
    scenario,
  };
}

async function startGameIfTitleScreenIsVisible(page: Page): Promise<void> {
  const titleScreen = page.locator('.title-screen');

  if (await titleScreen.isVisible()) {
    await page.getByRole('button', { name: 'Start Game' }).click();
    const matchSetup = page.locator('.match-setup-screen');
    if (await matchSetup.isVisible()) {
      await page.getByRole('button', { name: 'Play Game' }).click();
      await expect(matchSetup).toBeHidden();
    }
    await expect(titleScreen).toBeHidden();
  }
}

async function getPerformanceDebugApiReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debugApi = (window as unknown as { __footballDebug?: PerformanceDebugApi }).__footballDebug;
    return Boolean(debugApi?.setPerformanceScenario && debugApi?.getPerformanceProfileReport);
  });
}

async function createEnvironmentSnapshot(page: Page): Promise<PerformanceReportEnvironment> {
  const renderer = await getWebGlRendererDescription(page);
  return page.evaluate(({ rendererDescription, softwareRendering }) => ({
    deviceScaleFactor: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    hiddenFrameCount: 0,
    rendererDescription,
    softwareRendering,
    userAgent: navigator.userAgent,
    viewport: {
      height: window.innerHeight,
      width: window.innerWidth,
    },
  }), {
    rendererDescription: renderer,
    softwareRendering: isSoftwareRenderer(renderer),
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

function createMatrixReport(
  fullBroadcastRuns: ScenarioRun[],
  comparisonRuns: ScenarioRun[],
  sevenOnSevenBaseline: ScenarioRun | null,
): ElevenPerformanceMatrixReport {
  const slowestRun = [...fullBroadcastRuns]
    .sort((a, b) => b.report.frame.p95 - a.report.frame.p95)[0];
  const topBottlenecks = slowestRun?.report.bottlenecks
    .map((entry, index) =>
      `${index + 1}. ${entry.phase} avg ${entry.averageMs.toFixed(2)} ms ` +
      `p95 ${entry.p95Ms.toFixed(2)} ms`)
    .join('\n') ?? 'No bottlenecks recorded.';
  const summaryText = [
    `11v11 ${PERFORMANCE_RUN_MODE} performance profile generated for ${fullBroadcastRuns.length} full scenarios ` +
      `and ${comparisonRuns.length} isolation comparisons.`,
    slowestRun
      ? `Slowest full-broadcast scenario by p95 frame time: ${slowestRun.scenario} ` +
        `at ${slowestRun.report.frame.p95.toFixed(2)} ms.`
      : 'No full-broadcast scenario was recorded.',
    `Top bottlenecks in the slowest scenario:\n${topBottlenecks}`,
  ].join('\n');

  return {
    comparisonRuns,
    fullBroadcastRuns,
    generatedAt: new Date().toISOString(),
    profileDescriptions: PROFILE_DESCRIPTIONS,
    runMode: PERFORMANCE_RUN_MODE,
    sevenOnSevenBaseline,
    summaryText,
  };
}

function writeMatrixReport(report: ElevenPerformanceMatrixReport): void {
  const jsonPath = 'test-results/eleven-performance-report.json';
  const textPath = 'test-results/eleven-performance-summary.txt';
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(textPath, `${report.summaryText}\n`, 'utf8');
}

function isSoftwareRenderer(rendererDescription: string): boolean {
  return /swiftshader|software|llvmpipe|microsoft basic render|warp|mesa offscreen/i
    .test(rendererDescription);
}
