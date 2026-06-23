import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

interface CaptureManifestEntry {
  fileName: string;
  label: string;
  notes: string;
}

interface CaptureRun {
  baseUrl: string;
  capturedAt: string;
  captures: CaptureManifestEntry[];
  notes: string[];
  viewport: {
    deviceScaleFactor: number;
    height: number;
    width: number;
  };
}

interface GameplaySnapshot {
  lastPlayResult: null | { type: string };
  playState: string;
}

interface MatchSnapshot {
  phase: string;
  previousDriveSummary: null | { result: string };
}

interface KickoffSnapshot {
  phase: string;
  resultMessage: string | null;
}

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const VIEWPORT = { width: 1600, height: 900 };
const DEVICE_SCALE_FACTOR = 1;
const DEFAULT_CAPTURE_SEED = 20260622;

const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const outputDir = join(REPO_ROOT, 'artifacts', `game-screenshots-${timestamp}`);
const manifest: CaptureRun = {
  baseUrl: '',
  capturedAt: new Date().toISOString(),
  captures: [],
  notes: [
    'Captured with Playwright at a 1600x900 viewport.',
    'Menu, pregame, coin toss, touchback, touchdown, and opponent field-goal summary artifacts are driven through the running app.',
    'The touchback artifact adds a small artifact-only label sourced from the live kickoff snapshot because kickoff chrome is hidden outside gameplay.',
    'Halftime and end-of-game artifacts are rendered from the actual UI components with representative MatchSnapshot data because the runtime does not expose a safe direct phase setter.',
  ],
  viewport: {
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    height: VIEWPORT.height,
    width: VIEWPORT.width,
  },
};

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const server = await resolveServer();
  manifest.baseUrl = server.baseUrl;
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      viewport: VIEWPORT,
    });
    await context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await context.addInitScript('globalThis.__name = (target) => target;');

    await captureMenuAndPregameFlow(context, server.baseUrl);
    await captureTouchdown(context, server.baseUrl);
    await captureOpponentFieldGoal(context, server.baseUrl);
    await captureRepresentativeTransitions(context, server.baseUrl);

    await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Wrote ${manifest.captures.length} game artifacts to ${outputDir}`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

async function resolveServer(): Promise<{ baseUrl: string; stop: () => void }> {
  const providedBaseUrl = process.env.FOOTBALL_ARTIFACT_BASE_URL;
  if (providedBaseUrl) {
    await waitForServer(providedBaseUrl);
    return {
      baseUrl: providedBaseUrl.replace(/\/$/, ''),
      stop: () => undefined,
    };
  }

  const port = await findOpenPort(5174);
  const baseUrl = `http://127.0.0.1:${port}`;
  const viteBin = join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  mirrorServerOutput(child);

  try {
    await waitForServer(baseUrl);
  } catch (error) {
    child.kill();
    throw error;
  }

  return {
    baseUrl,
    stop: () => {
      if (!child.killed) {
        child.kill();
      }
    },
  };
}

function mirrorServerOutput(child: ChildProcessByStdio<null, Readable, Readable>): void {
  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    if (text.includes('Local:') || text.includes('ready in')) {
      process.stdout.write(text);
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
}

async function findOpenPort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${startPort} to ${startPort + 49}`);
}

async function canListen(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.once('listening', () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${baseUrl}: ${String(lastError)}`);
}

async function captureMenuAndPregameFlow(context: BrowserContext, baseUrl: string): Promise<void> {
  const page = await context.newPage();
  await gotoApp(page, baseUrl, `/?matchSeed=${DEFAULT_CAPTURE_SEED}`);

  await page.locator('.title-screen').waitFor({ state: 'visible' });
  await capture(page, '01-title.png', 'Football JS title screen', '');

  await openFootballHub(page);
  await clickHubSection(page, 'Dynasty');
  await capture(page, '02-dynasty-shell.png', 'Dynasty shell', 'Current non-playable dynasty planning shell.');

  await clickHubSection(page, 'Settings');
  await capture(page, '03-settings.png', 'Football Hub settings', 'Settings opened from the current hub shell.');

  await clickHubSection(page, 'Play Now');
  await capture(page, '04-play-now-team-choose.png', 'Play Now team choose screen', 'Current Play Now matchup and uniform selection screen.');

  await page.locator('.football-hub-screen').getByRole('button', { name: 'Play Game' }).click();
  await page.locator('body[data-app-phase="pregamePresentation"]').waitFor({ state: 'attached', timeout: 30_000 });
  await waitForDebugSnapshot(
    page,
    'getPregamePresentationSnapshot',
    (snapshot: { currentShot: string | null; phase: string }) =>
      snapshot.phase === 'running' && snapshot.currentShot !== null,
    15_000,
  );
  await capture(page, '05-pregame.png', 'Pregame broadcast presentation', 'Captured from the live pregame presentation flow.');

  await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.locator('body[data-app-phase="coinToss"]').waitFor({ state: 'attached', timeout: 15_000 });
  await page.locator('.coin-toss-ui').waitFor({ state: 'visible', timeout: 15_000 });
  await waitForDebugSnapshot(
    page,
    'getCoinTossSnapshot',
    (snapshot: { coinVisible: boolean; captainsVisible: number }) =>
      snapshot.coinVisible && snapshot.captainsVisible === 4,
    15_000,
  );
  await capture(page, '06-coin-toss.png', 'Opening coin toss', 'Captured before the user call is resolved.');

  await page.keyboard.press('T');
  await page.keyboard.press('Enter');
  await page.locator('body[data-app-phase="kickoff"]').waitFor({ state: 'attached', timeout: 20_000 });
  await waitForDebugSnapshot(
    page,
    'getKickoffSnapshot',
    (snapshot: KickoffSnapshot) =>
      (snapshot.phase === 'touchback' || snapshot.phase === 'result') &&
      snapshot.resultMessage === 'TOUCHBACK',
    45_000,
  );
  await showArtifactCallout(page, 'TOUCHBACK');
  await capture(page, '07-touchback.png', 'Kickoff touchback', 'Seed 20260622 produces a live opening-kickoff touchback.');

  await page.close();
}

async function captureTouchdown(context: BrowserContext, baseUrl: string): Promise<void> {
  const page = await context.newPage();
  await gotoApp(
    page,
    baseUrl,
    '/?readback=1&experience=performance&playbook=5v5&routeArt=0&playerMotion=0&audio=0&announcer=0&music=0',
  );

  await page.locator('.gameplay-hud').waitFor({ state: 'visible', timeout: 15_000 });
  await pressSpaceWhenSnapReady(page);
  await waitForDebugSnapshot(
    page,
    'getGameplaySnapshot',
    (snapshot: GameplaySnapshot) => snapshot.playState === 'live',
    10_000,
  );

  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(850);
  await page.keyboard.up('d');
  try {
    await waitForDebugSnapshot(
      page,
      'getGameplaySnapshot',
      (snapshot: GameplaySnapshot) =>
        snapshot.playState === 'dead' && snapshot.lastPlayResult?.type === 'touchdown',
      12_000,
    );
    await page.locator('.touchdown-message').waitFor({ state: 'visible', timeout: 5_000 });
    await capture(page, '08-touchdown.png', 'Touchdown presentation', 'Captured from the maintained 5v5 scoring flow.');
  } finally {
    await page.keyboard.up('w').catch(() => undefined);
  }

  await page.close();
}

async function captureOpponentFieldGoal(context: BrowserContext, baseUrl: string): Promise<void> {
  const page = await context.newPage();
  await gotoApp(page, baseUrl, '/?matchSeed=20260620');
  await openFootballHub(page);
  await page.locator('.football-hub-screen').getByRole('button', { name: 'Play Game' }).click();
  await page.locator('body[data-app-phase="pregamePresentation"]').waitFor({ state: 'attached', timeout: 30_000 });
  await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.locator('body[data-app-phase="coinToss"]').waitFor({ state: 'attached', timeout: 15_000 });
  await page.keyboard.press('H');
  await page.keyboard.press('Enter');
  await waitForDebugSnapshot(
    page,
    'getMatchSnapshot',
    (snapshot: MatchSnapshot | null) =>
      snapshot?.phase === 'opponentDriveSimulation' &&
      snapshot.previousDriveSummary?.result === 'fieldGoal',
    60_000,
  );
  await page.locator('.opponent-drive-summary').waitFor({ state: 'visible', timeout: 10_000 });
  await capture(page, '09-field-goal.png', 'Opponent field-goal summary', 'Seed 20260620 resolves the opponent opening drive as a made field goal.');
  await page.close();
}

async function captureRepresentativeTransitions(context: BrowserContext, baseUrl: string): Promise<void> {
  const page = await context.newPage();
  await gotoApp(
    page,
    baseUrl,
    '/?readback=1&experience=performance&playbook=5v5&routeArt=0&playerMotion=0&audio=0&announcer=0&music=0',
  );

  await renderHalftimeArtifact(page);
  await capture(page, '10-halftime.png', 'Halftime report', 'Rendered from the actual HalftimeStatsOverlay component with representative halftime MatchSnapshot data.');

  await renderFinalArtifact(page);
  await capture(page, '11-end-of-game.png', 'End-of-game final screen', 'Rendered from the actual QuarterTransitionPanel component with representative final MatchSnapshot data.');

  await page.close();
}

async function gotoApp(page: Page, baseUrl: string, route: string): Promise<void> {
  await page.goto(`${baseUrl}${route}`);
  await page.locator('body[data-scene-ready="true"]').waitFor({ state: 'attached', timeout: 60_000 });
  await waitForAnimationFrame(page);
}

async function openFootballHub(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.locator('.football-hub-screen').waitFor({ state: 'visible', timeout: 15_000 });
}

async function clickHubSection(page: Page, name: 'Dynasty' | 'Play Now' | 'Settings'): Promise<void> {
  const button = page.locator('.football-hub-nav').getByRole('button', { name });
  await button.waitFor({ state: 'visible', timeout: 10_000 });
  await button.click();
}

async function pressSpaceWhenSnapReady(page: Page): Promise<void> {
  const cadenceStatus = page.locator('.cadence-status');
  await cadenceStatus.waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => {
    const text = document.querySelector('.cadence-status')?.textContent ?? '';
    return text.includes('CHOOSE A PLAY') || text.includes('PRESS SPACE TO SNAP');
  });
  const text = await cadenceStatus.textContent();
  if (text?.includes('CHOOSE A PLAY')) {
    await page.keyboard.press('1');
  }
  await page.waitForFunction(() =>
    (document.querySelector('.cadence-status')?.textContent ?? '').includes('PRESS SPACE TO SNAP'),
  );
  await page.keyboard.press('Space');
}

async function capture(page: Page, fileName: string, label: string, notes: string): Promise<void> {
  await waitForAnimationFrame(page);
  await page.screenshot({ path: join(outputDir, fileName), fullPage: false });
  manifest.captures.push({ fileName, label, notes });
  console.log(`Captured ${fileName}`);
}

async function showArtifactCallout(page: Page, text: string): Promise<void> {
  await page.evaluate((message) => {
    document.querySelectorAll('[data-artifact-callout="true"]').forEach((element) => element.remove());
    const callout = document.createElement('div');
    callout.dataset.artifactCallout = 'true';
    callout.textContent = message;
    Object.assign(callout.style, {
      background: 'rgba(8, 12, 14, 0.82)',
      border: '1px solid rgba(242, 184, 75, 0.58)',
      borderRadius: '6px',
      color: '#f2b84b',
      fontSize: '26px',
      fontWeight: '900',
      left: '50%',
      letterSpacing: '0',
      padding: '10px 18px',
      position: 'fixed',
      textAlign: 'center',
      textShadow: '0 1px 0 rgba(0, 0, 0, 0.42)',
      top: '18%',
      transform: 'translateX(-50%)',
      zIndex: '82',
    });
    document.body.append(callout);
  }, text);
}

async function waitForAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() =>
    new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
    }),
  );
}

async function waitForDebugSnapshot<T>(
  page: Page,
  methodName: string,
  predicate: (snapshot: T) => boolean,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot: T | null = null;

  while (Date.now() < deadline) {
    const snapshot = await page.evaluate((name) => {
      const debugApi = (
        window as unknown as {
          __footballDebug?: Record<string, () => unknown>;
        }
      ).__footballDebug;
      if (!debugApi?.[name]) {
        throw new Error(`Missing football debug API method ${name}`);
      }
      return debugApi[name]();
    }, methodName) as T;
    lastSnapshot = snapshot;
    if (predicate(snapshot)) {
      return snapshot;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for ${methodName}; last snapshot ${JSON.stringify(lastSnapshot)}`);
}

async function renderHalftimeArtifact(page: Page): Promise<void> {
  await page.evaluate(async () => {
    cleanupArtifactOverlays();
    const importModule = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [
      matchModule,
      statsModule,
      halftimeModule,
      storyModule,
    ] = await Promise.all([
      importModule('/src/match/MatchFlowController.ts'),
      importModule('/src/stats/GameStatsTypes.ts'),
      importModule('/src/presentation/halftime/HalftimeStatsOverlay.ts'),
      importModule('/src/presentation/halftime/HalftimeStoryResolver.ts'),
    ]);
    const controller = new matchModule.MatchFlowController({
      opponentTeamId: 'lakefront-lights',
      userTeamId: 'metro-meteors',
    });
    const base = controller.getSnapshot();
    const stats = createRepresentativeStats(statsModule, {
      opponentPassingYards: 116,
      opponentPoints: 10,
      opponentRushingYards: 52,
      userFirstDowns: 8,
      userPassingYards: 138,
      userPoints: 14,
      userRushingYards: 74,
      userThirdDownAttempts: 5,
      userThirdDownConversions: 3,
    });
    const match = {
      ...base,
      clock: { ...base.clock, remainingSeconds: 0 },
      opponentScore: 10,
      phase: 'halftime',
      quarter: 2,
      secondHalfPossession: 'opponent',
      stats,
      userScore: 14,
    };
    const overlay = new halftimeModule.HalftimeStatsOverlay({ onContinue: () => undefined });
    overlay.root.dataset.artifactGenerated = 'true';
    overlay.sync({
      canContinue: true,
      matchSnapshot: match,
      story: storyModule.resolveHalftimeStory(match),
      visible: true,
    });
    hideGameplayChromeForArtifact();
    (window as unknown as { __footballArtifactOverlay?: { dispose: () => void } }).__footballArtifactOverlay = overlay;

    function cleanupArtifactOverlays(): void {
      const artifactWindow = window as unknown as {
        __footballArtifactOverlay?: { dispose?: () => void };
      };
      artifactWindow.__footballArtifactOverlay?.dispose?.();
      artifactWindow.__footballArtifactOverlay = undefined;
      document.querySelectorAll('[data-artifact-generated="true"]').forEach((element) => element.remove());
      document.querySelectorAll('.opponent-drive-summary, .quarter-transition-panel, .halftime-stats-overlay')
        .forEach((element) => {
          if ((element as HTMLElement).dataset.artifactGenerated === 'true') {
            element.remove();
          }
        });
    }

    function hideGameplayChromeForArtifact(): void {
      document.body.dataset.artifactCleanChrome = 'true';
      if (!document.getElementById('football-artifact-clean-chrome')) {
        const style = document.createElement('style');
        style.id = 'football-artifact-clean-chrome';
        style.textContent = `
          body[data-artifact-clean-chrome="true"] .gameplay-hud,
          body[data-artifact-clean-chrome="true"] .play-call-ui,
          body[data-artifact-clean-chrome="true"] .scorebug {
            display: none !important;
          }
        `;
        document.head.append(style);
      }
      for (const selector of ['.gameplay-hud', '.play-call-ui', '.score-counter']) {
        document.querySelector<HTMLElement>(selector)?.setAttribute('hidden', '');
      }
    }

    function createRepresentativeStats(
      statsModule: any,
      patch: Record<string, number | undefined>,
    ): any {
      const userPassingYards = patch.userPassingYards ?? 0;
      const userRushingYards = patch.userRushingYards ?? 0;
      const opponentPassingYards = patch.opponentPassingYards ?? 0;
      const opponentRushingYards = patch.opponentRushingYards ?? 0;
      return {
        duplicateSuppressionCount: 0,
        invariantFailures: [],
        lastEvent: null,
        players: {
          'lakefront-lights-qb-8': {
            ...statsModule.createZeroPlayerGameStats('lakefront-lights-qb-8', 'opponent'),
            passingYards: opponentPassingYards,
          },
          'lakefront-lights-wr-10': {
            ...statsModule.createZeroPlayerGameStats('lakefront-lights-wr-10', 'opponent'),
            receivingYards: Math.max(0, opponentPassingYards - 32),
          },
          'metro-meteors-qb-12': {
            ...statsModule.createZeroPlayerGameStats('metro-meteors-qb-12', 'user'),
            passingTouchdowns: patch.userPassingTouchdowns ?? 1,
            passingYards: userPassingYards,
          },
          'metro-meteors-rb-24': {
            ...statsModule.createZeroPlayerGameStats('metro-meteors-rb-24', 'user'),
            rushingYards: userRushingYards,
          },
        },
        possessionSeconds: {
          opponent: 94,
          user: 86,
        },
        processedEventCount: 18,
        teams: {
          opponent: {
            ...statsModule.createZeroTeamGameStats(),
            fieldGoalsAttempted: patch.opponentPoints === 10 ? 1 : 0,
            fieldGoalsMade: patch.opponentPoints === 10 ? 1 : 0,
            passingYards: opponentPassingYards,
            points: patch.opponentPoints ?? 0,
            rushingYards: opponentRushingYards,
            totalYards: opponentPassingYards + opponentRushingYards,
            turnovers: patch.opponentTurnovers ?? 0,
          },
          user: {
            ...statsModule.createZeroTeamGameStats(),
            firstDowns: patch.userFirstDowns ?? 0,
            passingTouchdowns: patch.userPassingTouchdowns ?? 1,
            passingYards: userPassingYards,
            points: patch.userPoints ?? 0,
            rushingYards: userRushingYards,
            thirdDownAttempts: patch.userThirdDownAttempts ?? 0,
            thirdDownConversions: patch.userThirdDownConversions ?? 0,
            totalYards: userPassingYards + userRushingYards,
            turnovers: patch.userTurnovers ?? 0,
          },
        },
      };
    }
  });
}

async function renderFinalArtifact(page: Page): Promise<void> {
  await page.evaluate(async () => {
    cleanupArtifactOverlays();
    const importModule = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [
      matchModule,
      statsModule,
      transitionModule,
    ] = await Promise.all([
      importModule('/src/match/MatchFlowController.ts'),
      importModule('/src/stats/GameStatsTypes.ts'),
      importModule('/src/ui/QuarterTransition.ts'),
    ]);
    const controller = new matchModule.MatchFlowController({
      opponentTeamId: 'lakefront-lights',
      userTeamId: 'metro-meteors',
    });
    const base = controller.getSnapshot();
    const stats = createRepresentativeStats(statsModule, {
      opponentPassingYards: 204,
      opponentPoints: 17,
      opponentRushingYards: 93,
      opponentTurnovers: 1,
      userPassingTouchdowns: 2,
      userPassingYards: 276,
      userPoints: 28,
      userRushingYards: 118,
    });
    const match = {
      ...base,
      clock: { ...base.clock, remainingSeconds: 0 },
      driveSummaries: [
        createDriveSummary('artifact-drive-1', 'user', 'touchdown', 75, 7, 1),
        createDriveSummary('artifact-drive-2', 'opponent', 'fieldGoal', 43, 3, 1),
        createDriveSummary('artifact-drive-3', 'user', 'punt', 31, 0, 2),
        createDriveSummary('artifact-drive-4', 'opponent', 'touchdown', 68, 7, 2),
        createDriveSummary('artifact-drive-5', 'user', 'touchdown', 61, 7, 3),
        createDriveSummary('artifact-drive-6', 'user', 'touchdown', 54, 7, 4),
      ],
      gameOverReason: 'clockExpired',
      opponentScore: 17,
      phase: 'gameOver',
      quarter: 4,
      stats,
      userScore: 28,
      winner: 'user',
    };
    const panel = new transitionModule.QuarterTransitionPanel({
      onContinue: () => undefined,
      onRematch: () => undefined,
      onReturnToTitle: () => undefined,
    });
    panel.root.dataset.artifactGenerated = 'true';
    panel.sync(match, true);
    hideGameplayChromeForArtifact();
    (window as unknown as { __footballArtifactOverlay?: { dispose: () => void } }).__footballArtifactOverlay = panel;

    function cleanupArtifactOverlays(): void {
      const artifactWindow = window as unknown as {
        __footballArtifactOverlay?: { dispose?: () => void };
      };
      artifactWindow.__footballArtifactOverlay?.dispose?.();
      artifactWindow.__footballArtifactOverlay = undefined;
      document.querySelectorAll('[data-artifact-generated="true"]').forEach((element) => element.remove());
      document.querySelectorAll('.opponent-drive-summary, .quarter-transition-panel, .halftime-stats-overlay')
        .forEach((element) => {
          if ((element as HTMLElement).dataset.artifactGenerated === 'true') {
            element.remove();
          }
        });
    }

    function hideGameplayChromeForArtifact(): void {
      document.body.dataset.artifactCleanChrome = 'true';
      if (!document.getElementById('football-artifact-clean-chrome')) {
        const style = document.createElement('style');
        style.id = 'football-artifact-clean-chrome';
        style.textContent = `
          body[data-artifact-clean-chrome="true"] .gameplay-hud,
          body[data-artifact-clean-chrome="true"] .play-call-ui,
          body[data-artifact-clean-chrome="true"] .scorebug {
            display: none !important;
          }
        `;
        document.head.append(style);
      }
      for (const selector of ['.gameplay-hud', '.play-call-ui', '.score-counter']) {
        document.querySelector<HTMLElement>(selector)?.setAttribute('hidden', '');
      }
    }

    function createRepresentativeStats(
      statsModule: any,
      patch: Record<string, number | undefined>,
    ): any {
      const userPassingYards = patch.userPassingYards ?? 0;
      const userRushingYards = patch.userRushingYards ?? 0;
      const opponentPassingYards = patch.opponentPassingYards ?? 0;
      const opponentRushingYards = patch.opponentRushingYards ?? 0;
      return {
        duplicateSuppressionCount: 0,
        invariantFailures: [],
        lastEvent: null,
        players: {
          'lakefront-lights-qb-8': {
            ...statsModule.createZeroPlayerGameStats('lakefront-lights-qb-8', 'opponent'),
            passingYards: opponentPassingYards,
          },
          'lakefront-lights-wr-10': {
            ...statsModule.createZeroPlayerGameStats('lakefront-lights-wr-10', 'opponent'),
            receivingYards: Math.max(0, opponentPassingYards - 46),
          },
          'metro-meteors-qb-12': {
            ...statsModule.createZeroPlayerGameStats('metro-meteors-qb-12', 'user'),
            passingTouchdowns: patch.userPassingTouchdowns ?? 2,
            passingYards: userPassingYards,
          },
          'metro-meteors-rb-24': {
            ...statsModule.createZeroPlayerGameStats('metro-meteors-rb-24', 'user'),
            rushingYards: userRushingYards,
          },
        },
        possessionSeconds: {
          opponent: 360,
          user: 360,
        },
        processedEventCount: 24,
        teams: {
          opponent: {
            ...statsModule.createZeroTeamGameStats(),
            passingYards: opponentPassingYards,
            points: patch.opponentPoints ?? 0,
            rushingYards: opponentRushingYards,
            totalYards: opponentPassingYards + opponentRushingYards,
            turnovers: patch.opponentTurnovers ?? 0,
          },
          user: {
            ...statsModule.createZeroTeamGameStats(),
            passingTouchdowns: patch.userPassingTouchdowns ?? 2,
            passingYards: userPassingYards,
            points: patch.userPoints ?? 0,
            rushingYards: userRushingYards,
            totalYards: userPassingYards + userRushingYards,
            turnovers: patch.userTurnovers ?? 0,
          },
        },
      };
    }

    function createDriveSummary(
      id: string,
      possession: 'opponent' | 'user',
      result: string,
      yards: number,
      points: number,
      quarter: number,
    ): any {
      return {
        description: `${possession} ${result}`,
        driveNumber: Number(id.replace(/\D/g, '')) || quarter,
        elapsedSeconds: 72,
        endingFieldPosition: { lateralX: 0, yardsFromOwnGoalLine: 25 + Math.min(60, yards) },
        id,
        plays: Math.max(1, Math.round(yards / 12)),
        points,
        possession,
        possessionTransition: null,
        quarter,
        result,
        scoringEvents: points > 0
          ? [{ points, team: possession, type: result === 'fieldGoal' ? 'fieldGoal' : 'touchdown' }]
          : [],
        startedAtSeconds: 180,
        startingFieldPosition: { lateralX: 0, yardsFromOwnGoalLine: 25 },
        yards,
      };
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
