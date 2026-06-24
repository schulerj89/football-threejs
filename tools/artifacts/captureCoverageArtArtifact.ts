import { chromium, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

interface FootballSpot {
  x: number;
  z: number;
}

interface CoverageZoneSnapshot {
  anchor: {
    formationPosition: FootballSpot;
    playerId: string;
    position: FootballSpot;
    source: 'formation' | 'player';
  };
  defenderId: string;
  kind: string;
  label: string;
  landmark: FootballSpot;
  points: FootballSpot[];
  visible: boolean;
}

interface RouteArtSnapshot {
  coverageShellEnabled: boolean;
  coverageZones: CoverageZoneSnapshot[];
  playArtMode: 'offense' | 'defense' | 'both';
  routeCount: number;
  routes: unknown[];
  visible: boolean;
}

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const CAPTURE_VERSION = '1.22.69';
const outputDir = join(REPO_ROOT, 'artifacts', `cover2-zone-art-${CAPTURE_VERSION}`);
const screenshotFileName = 'cover2-zone-art-spread-quick-11.png';

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const server = await resolveServer();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { width: 1600, height: 900 },
    });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.addInitScript('globalThis.__name = (target) => target;');
    await page.goto(`${server.baseUrl}/?debug=1&readback=1&experience=performance&coverageArt=1&playbook=11v11&camera=tactical&audio=0&announcer=0&music=0&crowdVisuals=0&cinematics=off`);
    await page.locator('body[data-scene-ready="true"]').waitFor({ state: 'attached', timeout: 60_000 });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }
    await page.locator('.play-call-ui').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.play-card[data-play-id="spread-quick-11"]').click();
    const snapshot = await waitForCoverageArt(page);
    await prepareCaptureChrome(page);
    await addCaptureLabel(page);
    await waitForAnimationFrame(page);
    await page.screenshot({ path: join(outputDir, screenshotFileName), fullPage: false });
    await writeFile(
      join(outputDir, 'manifest.json'),
      `${JSON.stringify({
        baseUrl: server.baseUrl,
        capturedAt: new Date().toISOString(),
        captures: [
          {
            fileName: screenshotFileName,
            label: 'Spread Quick 11 Cover 2 defensive zone art',
            playId: 'spread-quick-11',
            playbookId: '11v11',
          },
        ],
        notes: [
          'Captured with coverageArt=1 from the real 11v11 play-card selection path.',
          'Validation requires FS and SS to be visible deepHalf zones at matching deep depth.',
          'Validation requires the safety zone anchors to remain player-sourced and split left/right of the snap.',
          'Validation requires the 4-3 linebackers to resolve as left, middle, and right hook/curl zones.',
          'Coverage art renders a same-color assignment line from each defender anchor to its zone landmark dot.',
        ],
        linebackerZones: snapshot.coverageZones
          .filter((zone) => zone.defenderId.startsWith('defense-linebacker'))
          .map((zone) => ({
            defenderId: zone.defenderId,
            kind: zone.kind,
            landmark: zone.landmark,
            label: zone.label,
            playerAnchor: zone.anchor,
            visible: zone.visible,
          })),
        safetyZones: snapshot.coverageZones
          .filter((zone) => zone.defenderId === 'defense-safety' || zone.defenderId === 'defense-safety-strong')
          .map((zone) => ({
            defenderId: zone.defenderId,
            kind: zone.kind,
            landmark: zone.landmark,
            playerAnchor: zone.anchor,
            visible: zone.visible,
          })),
      }, null, 2)}\n`,
    );
    console.log(`Wrote Cover 2 coverage-art artifact to ${outputDir}`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

async function waitForCoverageArt(page: Page): Promise<RouteArtSnapshot> {
  await page.waitForFunction(() => {
    const snapshot = (
      window as unknown as {
        __footballDebug?: {
          getRouteArtSnapshot?: () => RouteArtSnapshot;
        };
      }
    ).__footballDebug?.getRouteArtSnapshot?.();
    if (!snapshot?.visible || snapshot.playArtMode !== 'defense' || !snapshot.coverageShellEnabled) {
      return false;
    }
    if (snapshot.routeCount !== 0 || snapshot.routes.length !== 0) {
      return false;
    }
    const freeSafety = snapshot.coverageZones.find((zone) => zone.defenderId === 'defense-safety');
    const strongSafety = snapshot.coverageZones.find((zone) => zone.defenderId === 'defense-safety-strong');
    const leftLinebacker = snapshot.coverageZones.find((zone) => zone.defenderId === 'defense-linebacker-left');
    const middleLinebacker = snapshot.coverageZones.find((zone) => zone.defenderId === 'defense-linebacker');
    const rightLinebacker = snapshot.coverageZones.find((zone) => zone.defenderId === 'defense-linebacker-right');

    return Boolean(
      freeSafety &&
        strongSafety &&
        leftLinebacker &&
        middleLinebacker &&
        rightLinebacker &&
        freeSafety.visible &&
        strongSafety.visible &&
        leftLinebacker.visible &&
        middleLinebacker.visible &&
        rightLinebacker.visible &&
        freeSafety.kind === 'deepHalf' &&
        strongSafety.kind === 'deepHalf' &&
        leftLinebacker.kind === 'hookCurl' &&
        middleLinebacker.kind === 'hookCurl' &&
        rightLinebacker.kind === 'hookCurl' &&
        Math.abs(freeSafety.landmark.z - strongSafety.landmark.z) < 0.05 &&
        Math.abs(freeSafety.anchor.position.z - strongSafety.anchor.position.z) < 0.05 &&
        freeSafety.anchor.position.x < strongSafety.anchor.position.x &&
        freeSafety.anchor.source === 'player' &&
        strongSafety.anchor.source === 'player' &&
        leftLinebacker.landmark.x < middleLinebacker.landmark.x &&
        middleLinebacker.landmark.x < rightLinebacker.landmark.x &&
        Math.abs(middleLinebacker.anchor.position.x) < 0.05,
    );
  }, undefined, { timeout: 20_000 });

  return page.evaluate(() => {
    const snapshot = (
      window as unknown as {
        __footballDebug?: {
          getRouteArtSnapshot?: () => RouteArtSnapshot;
        };
      }
    ).__footballDebug?.getRouteArtSnapshot?.();

    if (!snapshot) {
      throw new Error('Missing route art snapshot');
    }

    return snapshot;
  });
}

async function prepareCaptureChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.dataset.coverageArtCapture = 'true';
    if (document.getElementById('coverage-art-capture-clean-chrome')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'coverage-art-capture-clean-chrome';
    style.textContent = `
      body[data-coverage-art-capture="true"] .cadence-status,
      body[data-coverage-art-capture="true"] .debug-overlay,
      body[data-coverage-art-capture="true"] .gameplay-hud,
      body[data-coverage-art-capture="true"] .play-call-ui,
      body[data-coverage-art-capture="true"] .route-audit-overlay,
      body[data-coverage-art-capture="true"] .scorebug,
      body[data-coverage-art-capture="true"] .target-label {
        display: none !important;
      }
    `;
    document.head.append(style);
  });
}

async function addCaptureLabel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const existing = document.querySelector('[data-coverage-art-capture-label="true"]');
    existing?.remove();
    const labelElement = document.createElement('div');
    labelElement.dataset.coverageArtCaptureLabel = 'true';
    labelElement.textContent = 'Cover 2 Zone Art - FS/SS Deep Halves';
    Object.assign(labelElement.style, {
      background: 'rgba(1, 19, 30, 0.82)',
      border: '1px solid rgba(84, 214, 255, 0.72)',
      borderRadius: '6px',
      color: '#f8fbff',
      font: '700 18px Arial, sans-serif',
      left: '18px',
      padding: '9px 12px',
      position: 'fixed',
      top: '18px',
      zIndex: '2000',
    });
    document.body.append(labelElement);
  });
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
