import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
  validateFootballJsScorebugAssetPlan,
  type ScorebugCandidateId,
  type ScorebugImageAssetPlan,
} from './scorebugAssetPlan';
import {
  createContentHash,
  getFileContentHash,
  getFileSizeBytes,
  isDirectCli,
  normalizePathForManifest,
  resolveRepoPath,
  writeJsonFile,
} from './schemas';

export type ScorebugSafeZoneId =
  | 'ballLocation'
  | 'downDistance'
  | 'gameClock'
  | 'opponentAbbreviation'
  | 'opponentLogo'
  | 'opponentScore'
  | 'possession'
  | 'quarter'
  | 'userAbbreviation'
  | 'userLogo'
  | 'userScore';

export interface ScorebugSafeZone {
  readonly id: ScorebugSafeZoneId;
  readonly normalized: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
}

export interface ScorebugLayout {
  readonly imageHeight: 512;
  readonly imageWidth: 1536;
  readonly notes: string;
  readonly safeZones: readonly ScorebugSafeZone[];
}

export interface ScorebugGenerationMetadata {
  readonly apiEndpoint: 'images/generations';
  readonly revisedPrompt?: string | null;
}

export interface ScorebugImageProvenance {
  readonly assetId: string;
  readonly background: ScorebugImageAssetPlan['background'];
  readonly candidateId: ScorebugCandidateId;
  readonly compressedBytes: number;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly generationMetadata: ScorebugGenerationMetadata;
  readonly model: ScorebugImageAssetPlan['model'];
  readonly outputFormat: ScorebugImageAssetPlan['outputFormat'];
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: ScorebugImageAssetPlan['quality'];
  readonly requestedSize: ScorebugImageAssetPlan['requestedSize'];
}

export interface ScorebugBrightnessReport {
  readonly averageBrightness: number | null;
  readonly reason?: string;
  readonly safeZoneId: ScorebugSafeZoneId;
}

export interface ScorebugContrastReport {
  readonly blackContrastRatio: number | null;
  readonly safeZoneId: ScorebugSafeZoneId;
  readonly sourceBrightness: number | null;
  readonly status: 'measured' | 'notMeasured';
  readonly whiteContrastRatio: number | null;
}

export interface ScorebugAssetReportEntry {
  readonly assetId: string;
  readonly averageBrightnessBySafeZone: readonly ScorebugBrightnessReport[];
  readonly candidateId: ScorebugCandidateId;
  readonly compressedBytes: number;
  readonly contentHash: string | null;
  readonly dimensions: {
    readonly height: number;
    readonly width: number;
  };
  readonly exists: boolean;
  readonly model: string;
  readonly outputFormat: string;
  readonly outputPath: string;
  readonly prompt: string;
  readonly provenance: ScorebugImageProvenance | null;
  readonly provenancePath: string;
  readonly quality: string;
  readonly requestedSize: string;
  readonly textContrastBySafeZone: readonly ScorebugContrastReport[];
}

export interface ScorebugAssetReport {
  readonly assetCount: number;
  readonly assets: readonly ScorebugAssetReportEntry[];
  readonly galleryPath: string;
  readonly generatedCount: number;
  readonly generatedTotalBytes: number;
  readonly layout: ScorebugLayout;
  readonly layoutPath: string;
  readonly reportPath: string;
  readonly selection: ScorebugSelection | null;
  readonly selectionPath: string;
  readonly validationErrors: readonly string[];
}

export interface ScorebugSelection {
  readonly selected: ScorebugSelectionEntry;
  readonly selectedAt: string;
  readonly selectedCandidateId: ScorebugCandidateId;
}

export interface ScorebugSelectionEntry {
  readonly assetId: string;
  readonly contentHash: string | null;
  readonly outputPath: string;
  readonly runtimeImageUrl: string;
  readonly runtimePath: string;
}

export interface ScorebugSelectionOptions {
  readonly force: boolean;
  readonly selectedAt?: string;
  readonly selectedCandidateId: ScorebugCandidateId;
}

export const SCOREBUG_REPORT_PATH = 'public/branding/scorebug/scorebug-asset-report.json';
export const SCOREBUG_SELECTION_PATH = 'public/branding/scorebug/scorebug-selection.json';
export const SCOREBUG_GALLERY_PATH = 'public/branding/scorebug/scorebug-gallery.html';
export const SCOREBUG_LAYOUT_PATH = 'public/branding/scorebug/scorebug-layout.json';
export const FOOTBALL_JS_SCOREBUG_RUNTIME_PATH = 'public/branding/scorebug/football-js-scorebug-shell.webp';

export const FOOTBALL_JS_SCOREBUG_LAYOUT: ScorebugLayout = {
  imageHeight: 512,
  imageWidth: 1536,
  notes: 'Normalized safe zones for HTML-rendered scorebug content. The generated shell must not contain labels.',
  safeZones: [
    safeZone('userLogo', 0.035, 0.18, 0.075, 0.30),
    safeZone('userAbbreviation', 0.12, 0.23, 0.11, 0.22),
    safeZone('userScore', 0.24, 0.17, 0.10, 0.35),
    safeZone('opponentScore', 0.60, 0.17, 0.10, 0.35),
    safeZone('opponentLogo', 0.70, 0.18, 0.075, 0.30),
    safeZone('opponentAbbreviation', 0.785, 0.23, 0.12, 0.22),
    safeZone('quarter', 0.435, 0.18, 0.06, 0.18),
    safeZone('gameClock', 0.505, 0.18, 0.08, 0.18),
    safeZone('possession', 0.045, 0.67, 0.08, 0.18),
    safeZone('downDistance', 0.15, 0.65, 0.20, 0.20),
    safeZone('ballLocation', 0.37, 0.65, 0.18, 0.20),
  ],
};

export function createScorebugAssetReport(
  plan: readonly ScorebugImageAssetPlan[] = FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
): ScorebugAssetReport {
  const validationErrors = [
    ...validateFootballJsScorebugAssetPlan(plan),
    ...validateScorebugLayout(FOOTBALL_JS_SCOREBUG_LAYOUT),
  ];
  const assets = plan.map((asset): ScorebugAssetReportEntry => {
    const exists = existsSync(resolveRepoPath(asset.outputPath));
    const dimensions = parseRequestedSize(asset.requestedSize);
    const brightness = createBrightnessReports(asset.outputPath, exists);
    return {
      assetId: asset.assetId,
      averageBrightnessBySafeZone: brightness,
      candidateId: asset.candidateId,
      compressedBytes: exists ? getFileSizeBytes(asset.outputPath) : 0,
      contentHash: exists ? getFileContentHash(asset.outputPath) : null,
      dimensions,
      exists,
      model: asset.model,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provenance: readScorebugImageProvenance(asset),
      provenancePath: `${asset.outputPath}.json`,
      quality: asset.quality,
      requestedSize: asset.requestedSize,
      textContrastBySafeZone: createContrastReports(brightness),
    };
  });

  return {
    assetCount: assets.length,
    assets,
    galleryPath: SCOREBUG_GALLERY_PATH,
    generatedCount: assets.filter((asset) => asset.exists).length,
    generatedTotalBytes: assets.reduce((total, asset) => total + asset.compressedBytes, 0),
    layout: FOOTBALL_JS_SCOREBUG_LAYOUT,
    layoutPath: SCOREBUG_LAYOUT_PATH,
    reportPath: SCOREBUG_REPORT_PATH,
    selection: readScorebugSelection(),
    selectionPath: SCOREBUG_SELECTION_PATH,
    validationErrors,
  };
}

export function writeScorebugAssetReportFiles(report: ScorebugAssetReport): void {
  writeJsonFile(resolveRepoPath(SCOREBUG_REPORT_PATH), report);
  writeJsonFile(resolveRepoPath(SCOREBUG_LAYOUT_PATH), FOOTBALL_JS_SCOREBUG_LAYOUT);
  writeScorebugGalleryHtml(report);
}

export function selectScorebugAsset(
  plan: readonly ScorebugImageAssetPlan[],
  options: ScorebugSelectionOptions,
): ScorebugSelection {
  const asset = plan.find((candidate) => candidate.candidateId === options.selectedCandidateId);

  if (!asset) {
    throw new Error(`Unknown scorebug shell candidate: ${options.selectedCandidateId}`);
  }

  copyScorebugRuntimeAsset(asset.outputPath, FOOTBALL_JS_SCOREBUG_RUNTIME_PATH, options.force);

  const selection: ScorebugSelection = {
    selected: {
      assetId: asset.assetId,
      contentHash: getFileContentHash(asset.outputPath),
      outputPath: asset.outputPath,
      runtimeImageUrl: '/branding/scorebug/football-js-scorebug-shell.webp',
      runtimePath: FOOTBALL_JS_SCOREBUG_RUNTIME_PATH,
    },
    selectedAt: options.selectedAt ?? new Date().toISOString(),
    selectedCandidateId: options.selectedCandidateId,
  };
  writeJsonFile(resolveRepoPath(SCOREBUG_SELECTION_PATH), selection);
  writeJsonFile(resolveRepoPath(SCOREBUG_LAYOUT_PATH), FOOTBALL_JS_SCOREBUG_LAYOUT);
  return selection;
}

export function writeScorebugImageProvenanceSidecar(
  asset: ScorebugImageAssetPlan,
  content: Uint8Array,
  metadata: ScorebugGenerationMetadata,
  generatedAt = new Date().toISOString(),
): void {
  const provenance: ScorebugImageProvenance = {
    assetId: asset.assetId,
    background: asset.background,
    candidateId: asset.candidateId,
    compressedBytes: content.byteLength,
    contentHash: createContentHash(content),
    generatedAt,
    generationMetadata: metadata,
    model: asset.model,
    outputFormat: asset.outputFormat,
    outputPath: asset.outputPath,
    prompt: asset.prompt,
    quality: asset.quality,
    requestedSize: asset.requestedSize,
  };
  writeJsonFile(resolveRepoPath(`${asset.outputPath}.json`), provenance);
}

export function readScorebugImageProvenance(asset: ScorebugImageAssetPlan): ScorebugImageProvenance | null {
  const sidecarPath = resolveRepoPath(`${asset.outputPath}.json`);

  if (!existsSync(sidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sidecarPath, 'utf8')) as ScorebugImageProvenance;
  } catch {
    return null;
  }
}

export function validateScorebugLayout(layout: ScorebugLayout): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (layout.imageWidth !== 1536 || layout.imageHeight !== 512) {
    errors.push('scorebug layout dimensions must be 1536x512');
  }

  for (const zone of layout.safeZones) {
    if (ids.has(zone.id)) {
      errors.push(`${zone.id}: duplicate scorebug safe zone`);
    }
    ids.add(zone.id);
    const { height, width, x, y } = zone.normalized;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      errors.push(`${zone.id}: safe zone must stay inside normalized image bounds`);
    }
  }

  for (const expected of EXPECTED_SAFE_ZONE_IDS) {
    if (!ids.has(expected)) {
      errors.push(`${expected}: missing scorebug safe zone`);
    }
  }

  return errors;
}

function writeScorebugGalleryHtml(report: ScorebugAssetReport): void {
  const cards = report.assets.map((asset) => {
    const selected = report.selection?.selected.assetId === asset.assetId;
    const imageUrl = asset.exists ? `/${normalizePathForManifest(asset.outputPath).replace(/^public\//, '')}` : '';
    const preview = asset.exists
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(asset.assetId)}">`
      : '<div class="missing">Missing</div>';

    return `<article class="card">
      ${preview}
      <h2>${escapeHtml(asset.candidateId)}</h2>
      ${selected ? '<strong class="selected">Selected runtime shell</strong>' : ''}
      <p>${escapeHtml(asset.provenance?.generationMetadata.revisedPrompt ?? asset.prompt)}</p>
      <dl>
        <dt>Asset</dt><dd>${escapeHtml(asset.assetId)}</dd>
        <dt>Model</dt><dd>${escapeHtml(asset.model)}</dd>
        <dt>Size</dt><dd>${asset.dimensions.width} x ${asset.dimensions.height}</dd>
        <dt>Quality</dt><dd>${escapeHtml(asset.quality)}</dd>
        <dt>Format</dt><dd>${escapeHtml(asset.outputFormat)}</dd>
        <dt>Bytes</dt><dd>${asset.compressedBytes}</dd>
        <dt>Hash</dt><dd>${escapeHtml(asset.contentHash ?? 'missing')}</dd>
        <dt>Generated</dt><dd>${escapeHtml(asset.provenance?.generatedAt ?? 'missing')}</dd>
      </dl>
    </article>`;
  }).join('\n');

  const safeZones = report.layout.safeZones.map((zone) => {
    const { height, width, x, y } = zone.normalized;
    return `<tr>
      <td>${escapeHtml(zone.id)}</td>
      <td>${x.toFixed(3)}</td>
      <td>${y.toFixed(3)}</td>
      <td>${width.toFixed(3)}</td>
      <td>${height.toFixed(3)}</td>
    </tr>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Football JS Scorebug Gallery</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0d1115; color: #f2f5f7; }
      body { margin: 0; padding: 32px; }
      h1 { margin: 0 0 8px; }
      .summary { color: #bac5cd; margin-bottom: 24px; }
      .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
      .card { background: #171e25; border: 1px solid #303b45; border-radius: 8px; padding: 16px; }
      img, .missing { width: 100%; aspect-ratio: 3 / 1; object-fit: contain; border-radius: 6px; background: #070a0d; display: grid; place-items: center; color: #82909b; }
      h2 { font-size: 17px; margin: 14px 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #9ec7db; }
      p { color: #aab6bf; font-size: 13px; line-height: 1.45; }
      .selected { display: inline-block; color: #ffd35a; margin-bottom: 10px; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; font-size: 13px; }
      dt { color: #94a3ad; }
      dd { margin: 0; overflow-wrap: anywhere; }
      table { border-collapse: collapse; margin-top: 28px; width: min(900px, 100%); font-size: 13px; }
      th, td { border: 1px solid #303b45; padding: 8px 10px; text-align: left; }
      th { background: #1d2730; color: #d7e0e6; }
    </style>
  </head>
  <body>
    <h1>Football JS Scorebug Gallery</h1>
    <p class="summary">${report.generatedCount} / ${report.assetCount} generated. Selected shell: ${escapeHtml(report.selection?.selectedCandidateId ?? 'none')}.</p>
    <div class="grid">${cards}</div>
    <h2>Safe Zones</h2>
    <table>
      <thead><tr><th>Zone</th><th>X</th><th>Y</th><th>Width</th><th>Height</th></tr></thead>
      <tbody>${safeZones}</tbody>
    </table>
  </body>
</html>
`;
  writeTextFile(resolveRepoPath(SCOREBUG_GALLERY_PATH), html);
}

function createBrightnessReports(relativeImagePath: string, imageExists: boolean): ScorebugBrightnessReport[] {
  if (imageExists) {
    const measured = measureSafeZoneBrightness(relativeImagePath);
    if (measured) {
      return FOOTBALL_JS_SCOREBUG_LAYOUT.safeZones.map((zone) => ({
        averageBrightness: measured[zone.id] ?? null,
        reason: measured[zone.id] === undefined ? 'Safe-zone brightness was not returned by the decoder.' : undefined,
        safeZoneId: zone.id,
      }));
    }
  }

  return FOOTBALL_JS_SCOREBUG_LAYOUT.safeZones.map((zone) => ({
    averageBrightness: null,
    reason: imageExists
      ? 'Safe-zone brightness could not be measured because no local WebP decoder was available or decoding failed.'
      : 'Image is missing; safe-zone brightness is unavailable.',
    safeZoneId: zone.id,
  }));
}

function createContrastReports(
  brightnessReports: readonly ScorebugBrightnessReport[],
): ScorebugContrastReport[] {
  return brightnessReports.map((brightness) => {
    if (brightness.averageBrightness === null) {
      return {
        blackContrastRatio: null,
        safeZoneId: brightness.safeZoneId,
        sourceBrightness: null,
        status: 'notMeasured',
        whiteContrastRatio: null,
      };
    }

    const normalized = brightness.averageBrightness / 255;
    return {
      blackContrastRatio: contrastRatio(normalized, 0),
      safeZoneId: brightness.safeZoneId,
      sourceBrightness: brightness.averageBrightness,
      status: 'measured',
      whiteContrastRatio: contrastRatio(normalized, 1),
    };
  });
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function measureSafeZoneBrightness(relativeImagePath: string): Partial<Record<ScorebugSafeZoneId, number>> | null {
  const absoluteImagePath = resolveRepoPath(relativeImagePath);
  const input = JSON.stringify({
    imagePath: absoluteImagePath,
    safeZones: FOOTBALL_JS_SCOREBUG_LAYOUT.safeZones,
  });
  const script = `
import json
import sys

try:
    from PIL import Image
except Exception:
    sys.exit(2)

payload = json.loads(sys.stdin.read())
image = Image.open(payload["imagePath"]).convert("RGB")
width, height = image.size
result = {}
for zone in payload["safeZones"]:
    bounds = zone["normalized"]
    left = max(0, min(width, int(round(bounds["x"] * width))))
    top = max(0, min(height, int(round(bounds["y"] * height))))
    right = max(left + 1, min(width, int(round((bounds["x"] + bounds["width"]) * width))))
    bottom = max(top + 1, min(height, int(round((bounds["y"] + bounds["height"]) * height))))
    crop = image.crop((left, top, right, bottom))
    pixels = list(crop.getdata())
    total = 0.0
    for r, g, b in pixels:
        total += 0.2126 * r + 0.7152 * g + 0.0722 * b
    result[zone["id"]] = round(total / max(1, len(pixels)), 2)
print(json.dumps(result))
`;
  const result = spawnSync('python', ['-c', script], {
    encoding: 'utf8',
    input,
    maxBuffer: 1024 * 1024,
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return null;
  }

  try {
    return JSON.parse(result.stdout) as Partial<Record<ScorebugSafeZoneId, number>>;
  } catch {
    return null;
  }
}

function readScorebugSelection(): ScorebugSelection | null {
  const selectionPath = resolveRepoPath(SCOREBUG_SELECTION_PATH);

  if (!existsSync(selectionPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(selectionPath, 'utf8')) as ScorebugSelection;
  } catch {
    return null;
  }
}

function copyScorebugRuntimeAsset(sourcePath: string, destinationPath: string, force: boolean): void {
  const absoluteSourcePath = resolveRepoPath(sourcePath);
  const absoluteDestinationPath = resolveRepoPath(destinationPath);

  if (!existsSync(absoluteSourcePath)) {
    throw new Error(`Missing selected scorebug asset: ${sourcePath}`);
  }
  if (existsSync(absoluteDestinationPath) && !force) {
    const sourceHash = createContentHash(readFileSync(absoluteSourcePath));
    const destinationHash = createContentHash(readFileSync(absoluteDestinationPath));

    if (sourceHash !== destinationHash) {
      throw new Error(`${destinationPath}: output already exists. Pass --force to overwrite.`);
    }
  }

  mkdirSync(dirname(absoluteDestinationPath), { recursive: true });
  copyFileSync(absoluteSourcePath, absoluteDestinationPath);
}

function parseScorebugReportCliOptions(args: readonly string[]): {
  readonly force: boolean;
  readonly selectCandidateId: ScorebugCandidateId | null;
  readonly write: boolean;
} {
  const selectArg = args.find((arg) => arg.startsWith('--select='));
  const selectCandidateId = selectArg?.slice('--select='.length) ?? process.env.npm_config_select ?? null;

  return {
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    selectCandidateId: isScorebugCandidateId(selectCandidateId) ? selectCandidateId : null,
    write: args.includes('--write') || readCliBoolean(process.env.npm_config_write),
  };
}

function isScorebugCandidateId(value: string | null): value is ScorebugCandidateId {
  return value === 'candidate-a' || value === 'candidate-b' || value === 'candidate-c';
}

function readCliBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function parseRequestedSize(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(value);
  return {
    height: match ? Number(match[2]) : 0,
    width: match ? Number(match[1]) : 0,
  };
}

function safeZone(
  id: ScorebugSafeZoneId,
  x: number,
  y: number,
  width: number,
  height: number,
): ScorebugSafeZone {
  return {
    id,
    normalized: { height, width, x, y },
  };
}

function writeTextFile(absolutePath: string, text: string): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, text, 'utf8');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const EXPECTED_SAFE_ZONE_IDS: readonly ScorebugSafeZoneId[] = [
  'ballLocation',
  'downDistance',
  'gameClock',
  'opponentAbbreviation',
  'opponentLogo',
  'opponentScore',
  'possession',
  'quarter',
  'userAbbreviation',
  'userLogo',
  'userScore',
];

if (isDirectCli(import.meta.url)) {
  const options = parseScorebugReportCliOptions(process.argv.slice(2));

  try {
    if (options.selectCandidateId) {
      selectScorebugAsset(FOOTBALL_JS_SCOREBUG_ASSET_PLAN, {
        force: options.force,
        selectedCandidateId: options.selectCandidateId,
      });
    }
    if (options.write || options.selectCandidateId) {
      writeScorebugAssetReportFiles(createScorebugAssetReport());
    }
    console.log(JSON.stringify(createScorebugAssetReport(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
