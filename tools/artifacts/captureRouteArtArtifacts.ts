import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { getAvailablePlays, type PlayDefinition } from '../../src/playbook';
import type { PlaybookId } from '../../src/roster';

interface FootballSpot {
  x: number;
  z: number;
}

interface RouteArtSnapshot {
  coverageShellEnabled: boolean;
  coverageZones: Array<{
    anchor: {
      formationPosition: FootballSpot;
      playerId: string;
      position: FootballSpot;
      source: 'formation' | 'player';
    };
    defenderId: string;
    kind: string;
    points: FootballSpot[];
    visible: boolean;
  }>;
  playArtMode: 'offense' | 'defense' | 'both';
  routeCount: number;
  routes: Array<{
    anchor: {
      formationPosition: FootballSpot;
      playerId: string;
      position: FootballSpot;
      source: 'formation' | 'player';
    };
    points: FootballSpot[];
    receiverId: string;
  }>;
  visible: boolean;
}

interface CaptureManifestEntry {
  coverageZoneCount: number;
  fileName: string;
  label: string;
  playbookId: PlaybookId;
  playId: string;
  routeCount: number;
}

interface CaptureManifest {
  baseUrl: string;
  capturedAt: string;
  captures: CaptureManifestEntry[];
  notes: string[];
  passPlayCount: number;
  viewport: {
    deviceScaleFactor: number;
    height: number;
    width: number;
  };
}

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const VIEWPORT = { width: 1600, height: 900 };
const DEVICE_SCALE_FACTOR = 1;
const PLAYBOOK_IDS: PlaybookId[] = ['5v5', '7v7', '11v11'];
const CAPTURE_VERSION = '1.22.66';
const outputDir = join(REPO_ROOT, 'artifacts', `route-art-validation-${CAPTURE_VERSION}`);

const passPlays = PLAYBOOK_IDS.flatMap((playbookId) =>
  getAvailablePlays(playbookId)
    .filter((play) => play.kind === 'pass')
    .map((play) => ({ playbookId, play })),
);

const manifest: CaptureManifest = {
  baseUrl: '',
  capturedAt: new Date().toISOString(),
  captures: [],
  notes: [
    'Captured with Playwright at a 1600x900 viewport.',
    'Each screenshot selects the pass play through the real play-card UI with routeArt=1 and debug/readback enabled.',
    'The route-art snapshot is verified before capture so offensive routes are visible without defensive coverage-zone art.',
    'Defensive coverage art is validated separately with coverageArt=1 so offensive and defensive play art do not conflict.',
  ],
  passPlayCount: passPlays.length,
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

    for (const { playbookId, play } of passPlays) {
      await capturePassPlay(context, server.baseUrl, playbookId, play);
    }

    await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Wrote ${manifest.captures.length} route-art artifacts to ${outputDir}`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

async function capturePassPlay(
  context: BrowserContext,
  baseUrl: string,
  playbookId: PlaybookId,
  play: PlayDefinition,
): Promise<void> {
  const page = await context.newPage();
  const route = [
    '/?debug=1',
    'readback=1',
    'experience=performance',
    'routeArt=1',
    'camera=tactical',
    'audio=0',
    'announcer=0',
    'music=0',
    'crowdVisuals=0',
    'cinematics=off',
    `playbook=${playbookId}`,
  ].join('&');

  try {
    await page.goto(`${baseUrl}${route}`);
    await page.locator('body[data-scene-ready="true"]').waitFor({ state: 'attached', timeout: 60_000 });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }
    await page.locator('.play-call-ui').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator(`.play-card[data-play-id="${play.id}"]`).click();
    await waitForRouteArt(page, play);
    await prepareCaptureChrome(page);
    await addCaptureLabel(page, `${play.displayName} (${playbookId})`);
    await waitForAnimationFrame(page);

    const snapshot = await getRouteArtSnapshot(page);
    const fileName = `${playbookId}-${play.id}.png`;
    await page.screenshot({ path: join(outputDir, fileName), fullPage: false });
    manifest.captures.push({
      coverageZoneCount: snapshot.coverageZones.length,
      fileName,
      label: `${play.displayName} route art`,
      playbookId,
      playId: play.id,
      routeCount: snapshot.routeCount,
    });
    console.log(`Captured ${fileName}`);
  } finally {
    await page.close();
  }
}

async function waitForRouteArt(page: Page, play: PlayDefinition): Promise<void> {
  const eligibleCount = play.pass?.eligibleReceiverIds.length ?? 0;
  await page.waitForFunction(
    ({ routeCount }) => {
      const debugApi = (
        window as unknown as {
          __footballDebug?: {
            getRouteArtSnapshot?: () => RouteArtSnapshot;
          };
        }
      ).__footballDebug;
      const snapshot = debugApi?.getRouteArtSnapshot?.();

      return Boolean(
        snapshot?.visible &&
          snapshot.playArtMode === 'offense' &&
          !snapshot.coverageShellEnabled &&
          snapshot.routeCount === routeCount &&
          snapshot.routes.length === routeCount &&
          snapshot.routes.every((route) =>
            route.points.length >= 2 && route.anchor.source === 'player') &&
          snapshot.coverageZones.length === 0,
      );
    },
    { routeCount: eligibleCount },
    { timeout: 20_000 },
  );
}

async function prepareCaptureChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.dataset.routeArtCapture = 'true';
    if (document.getElementById('route-art-capture-clean-chrome')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'route-art-capture-clean-chrome';
    style.textContent = `
      body[data-route-art-capture="true"] .cadence-status,
      body[data-route-art-capture="true"] .debug-overlay,
      body[data-route-art-capture="true"] .gameplay-hud,
      body[data-route-art-capture="true"] .play-call-ui,
      body[data-route-art-capture="true"] .route-audit-overlay,
      body[data-route-art-capture="true"] .scorebug,
      body[data-route-art-capture="true"] .target-label {
        display: none !important;
      }
    `;
    document.head.append(style);
  });
}

async function getRouteArtSnapshot(page: Page): Promise<RouteArtSnapshot> {
  return await page.evaluate(() => {
    const debugApi = (
      window as unknown as {
        __footballDebug?: {
          getRouteArtSnapshot?: () => RouteArtSnapshot;
        };
      }
    ).__footballDebug;

    if (!debugApi?.getRouteArtSnapshot) {
      throw new Error('Missing route-art debug snapshot');
    }

    return debugApi.getRouteArtSnapshot();
  });
}

async function addCaptureLabel(page: Page, label: string): Promise<void> {
  await page.evaluate((text) => {
    document.querySelectorAll('[data-route-art-capture-label="true"]').forEach((element) => element.remove());
    const labelElement = document.createElement('div');
    labelElement.dataset.routeArtCaptureLabel = 'true';
    labelElement.textContent = text;
    Object.assign(labelElement.style, {
      background: 'rgba(7, 12, 14, 0.82)',
      border: '1px solid rgba(84, 214, 255, 0.55)',
      borderRadius: '6px',
      color: '#f7fbf8',
      font: '700 18px system-ui, sans-serif',
      left: '18px',
      letterSpacing: '0',
      padding: '8px 12px',
      position: 'fixed',
      top: '18px',
      zIndex: '90',
    });
    document.body.append(labelElement);
  }, label);
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

async function waitForAnimationFrame(page: Page): Promise<void> {
  await page.evaluate(() =>
    new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
    }),
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
