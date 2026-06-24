import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { getAvailablePlays, type PlayDefinition } from '../../src/playbook';
import type { PlaybookId } from '../../src/roster';

interface PlayCardMetrics {
  cardHeight: number;
  cardWidth: number;
  diagramHeight: number;
  fieldPanelHeight: number;
  fieldPanelOverflow: string;
  footerHeight: number;
  hasLegacyHeader: boolean;
  kindBadgeText: string;
  passProtectionVisibleCount: number;
  receiverRouteStrokeWidths: number[];
  runDirectionStrokeWidths: number[];
  titleText: string;
}

interface CaptureManifestEntry {
  fileName: string;
  label: string;
  metrics: PlayCardMetrics;
  playbookId: PlaybookId;
  playId: string;
}

interface CaptureManifest {
  baseUrl: string;
  capturedAt: string;
  captures: CaptureManifestEntry[];
  notes: string[];
  playCount: number;
  viewport: {
    deviceScaleFactor: number;
    height: number;
    width: number;
  };
}

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const VIEWPORT = { width: 1600, height: 1000 };
const DEVICE_SCALE_FACTOR = 1;
const PLAYBOOK_IDS: PlaybookId[] = ['5v5', '7v7', '11v11'];
const CAPTURE_VERSION = '1.22.64';
const outputDir = join(REPO_ROOT, 'artifacts', `play-card-validation-${CAPTURE_VERSION}`);

const playsByPlaybook = PLAYBOOK_IDS.map((playbookId) => ({
  playbookId,
  plays: getAvailablePlays(playbookId),
}));

const manifest: CaptureManifest = {
  baseUrl: '',
  capturedAt: new Date().toISOString(),
  captures: [],
  notes: [
    'Captured with Playwright from actual .play-card components at a 1600x1000 viewport.',
    'The capture validates card structure and computed styles before writing each screenshot.',
    'Validation requires the reference-style field panel, bottom title band, kind chip, thick route/run strokes, and no legacy header.',
    'Pass-protection helper SVG remains in DOM for tests but is hidden visually to keep pass cards clean.',
  ],
  playCount: playsByPlaybook.reduce((sum, entry) => sum + entry.plays.length, 0),
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

    for (const entry of playsByPlaybook) {
      await capturePlaybookCards(context, server.baseUrl, entry.playbookId, entry.plays);
    }

    await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Wrote ${manifest.captures.length} play-card artifacts to ${outputDir}`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

async function capturePlaybookCards(
  context: BrowserContext,
  baseUrl: string,
  playbookId: PlaybookId,
  plays: readonly PlayDefinition[],
): Promise<void> {
  const page = await context.newPage();
  const route = [
    '/?debug=1',
    'readback=1',
    'experience=performance',
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
    await prepareCaptureChrome(page);

    for (const play of plays) {
      const card = page.locator(`.play-card[data-play-id="${play.id}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.waitFor({ state: 'visible', timeout: 10_000 });
      const metrics = await collectPlayCardMetrics(page, play.id);
      assertPlayCardMetrics(play, metrics);
      const fileName = `${playbookId}-${play.id}.png`;
      await card.screenshot({ path: join(outputDir, fileName) });
      manifest.captures.push({
        fileName,
        label: `${play.displayName} play card`,
        metrics,
        playbookId,
        playId: play.id,
      });
      console.log(`Captured ${fileName}`);
    }
  } finally {
    await page.close();
  }
}

async function collectPlayCardMetrics(page: Page, playId: string): Promise<PlayCardMetrics> {
  return await page.evaluate((targetPlayId) => {
    const card = document.querySelector<HTMLElement>(`.play-card[data-play-id="${targetPlayId}"]`);
    if (!card) {
      throw new Error(`Missing play card ${targetPlayId}`);
    }

    const cardBounds = card.getBoundingClientRect();
    const fieldPanel = card.querySelector<HTMLElement>('.play-card-field-panel');
    const footer = card.querySelector<HTMLElement>('.play-card-footer');
    const diagram = card.querySelector<SVGSVGElement>('.play-card-diagram');
    const kindBadge = card.querySelector<HTMLElement>('.play-card-kind-badge');
    const title = card.querySelector<HTMLElement>('.play-card-footer .play-card-title');
    if (!fieldPanel || !footer || !diagram || !kindBadge || !title) {
      throw new Error(`Incomplete play card structure for ${targetPlayId}`);
    }

    const isVisible = (element: Element): boolean => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
    };
    const strokeWidths = (selector: string): number[] =>
      [...card.querySelectorAll<SVGElement>(selector)]
        .map((element) => Number.parseFloat(getComputedStyle(element).strokeWidth || '0'))
        .filter((value) => Number.isFinite(value));

    return {
      cardHeight: Math.round(cardBounds.height),
      cardWidth: Math.round(cardBounds.width),
      diagramHeight: Math.round(diagram.getBoundingClientRect().height),
      fieldPanelHeight: Math.round(fieldPanel.getBoundingClientRect().height),
      fieldPanelOverflow: getComputedStyle(fieldPanel).overflow,
      footerHeight: Math.round(footer.getBoundingClientRect().height),
      hasLegacyHeader: Boolean(card.querySelector('.play-card-header')),
      kindBadgeText: kindBadge.textContent?.trim() ?? '',
      passProtectionVisibleCount: [...card.querySelectorAll('.play-card-pass-protection-line, .play-card-pass-protection-bar')]
        .filter(isVisible).length,
      receiverRouteStrokeWidths: strokeWidths('.play-card-receiver-route'),
      runDirectionStrokeWidths: strokeWidths('.play-card-run-direction'),
      titleText: title.textContent?.trim() ?? '',
    };
  }, playId);
}

function assertPlayCardMetrics(play: PlayDefinition, metrics: PlayCardMetrics): void {
  const issues: string[] = [];
  if (metrics.cardWidth < 250 || metrics.cardHeight < 190) {
    issues.push(`card too small ${metrics.cardWidth}x${metrics.cardHeight}`);
  }
  if (metrics.fieldPanelHeight < 128) {
    issues.push(`field panel too short ${metrics.fieldPanelHeight}`);
  }
  if (metrics.fieldPanelOverflow !== 'hidden') {
    issues.push(`field panel does not clip SVG overflow: ${metrics.fieldPanelOverflow}`);
  }
  if (metrics.diagramHeight > metrics.fieldPanelHeight + 1) {
    issues.push(`diagram overflows field panel ${metrics.diagramHeight} > ${metrics.fieldPanelHeight}`);
  }
  if (metrics.footerHeight < 52) {
    issues.push(`footer too short ${metrics.footerHeight}`);
  }
  if (metrics.hasLegacyHeader) {
    issues.push('legacy top header still rendered');
  }
  if (metrics.titleText !== play.displayName) {
    issues.push(`title mismatch ${metrics.titleText}`);
  }
  if (metrics.kindBadgeText.toLowerCase() !== play.kind) {
    issues.push(`kind badge mismatch ${metrics.kindBadgeText}`);
  }
  if (play.kind === 'pass') {
    if (metrics.receiverRouteStrokeWidths.length !== (play.pass?.eligibleReceiverIds.length ?? 0)) {
      issues.push(`route count mismatch ${metrics.receiverRouteStrokeWidths.length}`);
    }
    if (metrics.receiverRouteStrokeWidths.some((width) => width < 4)) {
      issues.push(`route stroke too thin ${metrics.receiverRouteStrokeWidths.join(',')}`);
    }
    if (metrics.passProtectionVisibleCount > 0) {
      issues.push(`visible pass-protection clutter ${metrics.passProtectionVisibleCount}`);
    }
  }
  if (play.kind === 'run') {
    if (metrics.runDirectionStrokeWidths.length !== 1) {
      issues.push(`run arrow count mismatch ${metrics.runDirectionStrokeWidths.length}`);
    }
    if (metrics.runDirectionStrokeWidths.some((width) => width < 4)) {
      issues.push(`run arrow stroke too thin ${metrics.runDirectionStrokeWidths.join(',')}`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`${play.id} failed play-card validation: ${issues.join('; ')}`);
  }
}

async function prepareCaptureChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.body.dataset.playCardCapture = 'true';
    if (document.getElementById('play-card-capture-clean-chrome')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'play-card-capture-clean-chrome';
    style.textContent = `
      body[data-play-card-capture="true"] .cadence-status,
      body[data-play-card-capture="true"] .debug-overlay,
      body[data-play-card-capture="true"] .gameplay-hud,
      body[data-play-card-capture="true"] .scorebug,
      body[data-play-card-capture="true"] .target-label {
        display: none !important;
      }

      body[data-play-card-capture="true"] .play-call-ui {
        left: 18px !important;
        right: 18px !important;
        top: 18px !important;
        bottom: auto !important;
        z-index: 90 !important;
        width: auto !important;
        max-height: calc(100vh - 36px);
        transform: none !important;
        justify-items: stretch !important;
      }

      body[data-play-card-capture="true"] .play-call-tray-header,
      body[data-play-card-capture="true"] .play-call-grid,
      body[data-play-card-capture="true"] .play-call-actions {
        width: 100% !important;
      }
    `;
    document.head.append(style);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
