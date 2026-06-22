import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { FOOTBALL_JS_COIN_ASSET_PLAN, validateFootballJsCoinAssetPlan, type CoinFace, type CoinImageAssetPlan, type CoinSetId } from './coinAssetPlan';
import {
  createContentHash,
  getFileContentHash,
  getFileSizeBytes,
  isDirectCli,
  normalizePathForManifest,
  resolveRepoPath,
  writeJsonFile,
} from './schemas';

export interface CoinGenerationMetadata {
  readonly apiEndpoint: 'images/edits' | 'images/generations';
  readonly referenceAssetId?: string;
  readonly referenceMode: 'generationFallback' | 'imageEdit' | 'none';
  readonly revisedPrompt?: string | null;
}

export interface CoinImageProvenance {
  readonly assetId: string;
  readonly background: CoinImageAssetPlan['background'];
  readonly coinSetId: CoinSetId;
  readonly compressedBytes: number;
  readonly contentHash: string;
  readonly face: CoinFace;
  readonly generatedAt: string;
  readonly generationMetadata: CoinGenerationMetadata;
  readonly model: CoinImageAssetPlan['model'];
  readonly outputFormat: CoinImageAssetPlan['outputFormat'];
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: CoinImageAssetPlan['quality'];
  readonly requestedSize: CoinImageAssetPlan['requestedSize'];
}

export interface CoinAssetReportEntry {
  readonly assetId: string;
  readonly coinSetId: CoinSetId;
  readonly compressedBytes: number;
  readonly contentHash: string | null;
  readonly exists: boolean;
  readonly face: CoinFace;
  readonly model: string;
  readonly outputFormat: string;
  readonly outputPath: string;
  readonly prompt: string;
  readonly provenance: CoinImageProvenance | null;
  readonly provenancePath: string;
  readonly quality: string;
  readonly requestedSize: string;
}

export interface CoinAssetReport {
  readonly assetCount: number;
  readonly assets: readonly CoinAssetReportEntry[];
  readonly galleryPath: string;
  readonly generatedCount: number;
  readonly generatedTotalBytes: number;
  readonly reportPath: string;
  readonly selection: CoinSelection | null;
  readonly selectionPath: string;
  readonly validationErrors: readonly string[];
}

export interface CoinSelection {
  readonly heads: CoinSelectionEntry;
  readonly selectedAt: string;
  readonly selectedSetId: CoinSetId;
  readonly tails: CoinSelectionEntry;
}

export interface CoinSelectionEntry {
  readonly assetId: string;
  readonly contentHash: string | null;
  readonly outputPath: string;
  readonly runtimeImageUrl: string;
  readonly runtimePath: string;
}

export interface CoinSelectionOptions {
  readonly force: boolean;
  readonly selectedAt?: string;
  readonly selectedSetId: CoinSetId;
}

export const COIN_REPORT_PATH = 'public/branding/coin/coin-asset-report.json';
export const COIN_SELECTION_PATH = 'public/branding/coin/coin-selection.json';
export const COIN_GALLERY_PATH = 'public/branding/coin/coin-gallery.html';
export const FOOTBALL_JS_COIN_HEADS_RUNTIME_PATH = 'public/branding/coin/football-js-coin-heads.webp';
export const FOOTBALL_JS_COIN_TAILS_RUNTIME_PATH = 'public/branding/coin/football-js-coin-tails.webp';

export function createCoinAssetReport(
  plan: readonly CoinImageAssetPlan[] = FOOTBALL_JS_COIN_ASSET_PLAN,
): CoinAssetReport {
  const validationErrors = validateFootballJsCoinAssetPlan(plan);
  const assets = plan.map((asset): CoinAssetReportEntry => {
    const exists = existsSync(resolveRepoPath(asset.outputPath));
    return {
      assetId: asset.assetId,
      coinSetId: asset.coinSetId,
      compressedBytes: exists ? getFileSizeBytes(asset.outputPath) : 0,
      contentHash: exists ? getFileContentHash(asset.outputPath) : null,
      exists,
      face: asset.face,
      model: asset.model,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provenance: readCoinImageProvenance(asset),
      provenancePath: `${asset.outputPath}.json`,
      quality: asset.quality,
      requestedSize: asset.requestedSize,
    };
  });

  return {
    assetCount: assets.length,
    assets,
    galleryPath: COIN_GALLERY_PATH,
    generatedCount: assets.filter((asset) => asset.exists).length,
    generatedTotalBytes: assets.reduce((total, asset) => total + asset.compressedBytes, 0),
    reportPath: COIN_REPORT_PATH,
    selection: readCoinSelection(),
    selectionPath: COIN_SELECTION_PATH,
    validationErrors,
  };
}

export function writeCoinAssetReportFiles(report: CoinAssetReport): void {
  writeJsonFile(resolveRepoPath(COIN_REPORT_PATH), report);
  writeCoinGalleryHtml(report);
}

export function selectCoinAssets(
  plan: readonly CoinImageAssetPlan[],
  options: CoinSelectionOptions,
): CoinSelection {
  const heads = plan.find((asset) => asset.coinSetId === options.selectedSetId && asset.face === 'heads');
  const tails = plan.find((asset) => asset.coinSetId === options.selectedSetId && asset.face === 'tails');

  if (!heads || !tails) {
    throw new Error(`Unknown complete coin set: ${options.selectedSetId}`);
  }

  copyCoinRuntimeAsset(heads.outputPath, FOOTBALL_JS_COIN_HEADS_RUNTIME_PATH, options.force);
  copyCoinRuntimeAsset(tails.outputPath, FOOTBALL_JS_COIN_TAILS_RUNTIME_PATH, options.force);

  const selection: CoinSelection = {
    heads: {
      assetId: heads.assetId,
      contentHash: getFileContentHash(heads.outputPath),
      outputPath: heads.outputPath,
      runtimeImageUrl: '/branding/coin/football-js-coin-heads.webp',
      runtimePath: FOOTBALL_JS_COIN_HEADS_RUNTIME_PATH,
    },
    selectedAt: options.selectedAt ?? new Date().toISOString(),
    selectedSetId: options.selectedSetId,
    tails: {
      assetId: tails.assetId,
      contentHash: getFileContentHash(tails.outputPath),
      outputPath: tails.outputPath,
      runtimeImageUrl: '/branding/coin/football-js-coin-tails.webp',
      runtimePath: FOOTBALL_JS_COIN_TAILS_RUNTIME_PATH,
    },
  };
  writeJsonFile(resolveRepoPath(COIN_SELECTION_PATH), selection);
  return selection;
}

export function writeCoinImageProvenanceSidecar(
  asset: CoinImageAssetPlan,
  content: Uint8Array,
  metadata: CoinGenerationMetadata,
  generatedAt = new Date().toISOString(),
): void {
  const provenance: CoinImageProvenance = {
    assetId: asset.assetId,
    background: asset.background,
    coinSetId: asset.coinSetId,
    compressedBytes: content.byteLength,
    contentHash: createContentHash(content),
    face: asset.face,
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

export function readCoinImageProvenance(asset: CoinImageAssetPlan): CoinImageProvenance | null {
  const sidecarPath = resolveRepoPath(`${asset.outputPath}.json`);

  if (!existsSync(sidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sidecarPath, 'utf8')) as CoinImageProvenance;
  } catch {
    return null;
  }
}

function writeCoinGalleryHtml(report: CoinAssetReport): void {
  const grouped = (['candidate-a', 'candidate-b'] as const).map((setId) => {
    const assets = report.assets.filter((asset) => asset.coinSetId === setId);
    const cards = assets.map((asset) => {
      const selected = report.selection?.heads.assetId === asset.assetId ||
        report.selection?.tails.assetId === asset.assetId;
      const imageUrl = asset.exists ? `/${normalizePathForManifest(asset.outputPath).replace(/^public\//, '')}` : '';
      const preview = asset.exists
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(asset.assetId)}">`
        : '<div class="missing">Missing</div>';

      return `<article class="card">
        ${preview}
        <h3>${escapeHtml(asset.face.toUpperCase())}</h3>
        ${selected ? '<strong class="selected">Selected runtime face</strong>' : ''}
        <dl>
          <dt>Asset</dt><dd>${escapeHtml(asset.assetId)}</dd>
          <dt>Model</dt><dd>${escapeHtml(asset.model)}</dd>
          <dt>Size</dt><dd>${escapeHtml(asset.requestedSize)}</dd>
          <dt>Quality</dt><dd>${escapeHtml(asset.quality)}</dd>
          <dt>Format</dt><dd>${escapeHtml(asset.outputFormat)}</dd>
          <dt>Bytes</dt><dd>${asset.compressedBytes}</dd>
          <dt>Hash</dt><dd>${escapeHtml(asset.contentHash ?? 'missing')}</dd>
          <dt>Generated</dt><dd>${escapeHtml(asset.provenance?.generatedAt ?? 'missing')}</dd>
          <dt>Reference</dt><dd>${escapeHtml(asset.provenance?.generationMetadata.referenceMode ?? 'missing')}</dd>
        </dl>
      </article>`;
    }).join('\n');

    return `<section>
      <h2>${escapeHtml(setId)}</h2>
      <div class="pair">${cards}</div>
    </section>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Football JS Coin Gallery</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #101418; color: #f2f5f7; }
      body { margin: 0; padding: 32px; }
      h1 { margin: 0 0 8px; }
      h2 { margin-top: 30px; text-transform: uppercase; letter-spacing: .08em; color: #9ec7db; }
      .summary { color: #bac5cd; margin-bottom: 24px; }
      .pair { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .card { background: #182029; border: 1px solid #31404d; border-radius: 8px; padding: 16px; }
      img, .missing { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: 6px; background: #0a0d10; display: grid; place-items: center; color: #82909b; }
      h3 { font-size: 17px; margin: 14px 0 8px; }
      .selected { display: inline-block; color: #ffd35a; margin-bottom: 10px; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; font-size: 13px; }
      dt { color: #94a3ad; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <h1>Football JS Coin Gallery</h1>
    <p class="summary">${report.generatedCount} / ${report.assetCount} generated. Selected pair: ${escapeHtml(report.selection?.selectedSetId ?? 'none')}.</p>
    ${grouped}
  </body>
</html>
`;
  writeTextFile(resolveRepoPath(COIN_GALLERY_PATH), html);
}

function readCoinSelection(): CoinSelection | null {
  const selectionPath = resolveRepoPath(COIN_SELECTION_PATH);

  if (!existsSync(selectionPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(selectionPath, 'utf8')) as CoinSelection;
  } catch {
    return null;
  }
}

function copyCoinRuntimeAsset(sourcePath: string, destinationPath: string, force: boolean): void {
  const absoluteSourcePath = resolveRepoPath(sourcePath);
  const absoluteDestinationPath = resolveRepoPath(destinationPath);

  if (!existsSync(absoluteSourcePath)) {
    throw new Error(`Missing selected coin asset: ${sourcePath}`);
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

function writeTextFile(absolutePath: string, text: string): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, text, 'utf8');
}

function parseCoinReportCliOptions(args: readonly string[]): {
  readonly force: boolean;
  readonly selectSetId: CoinSetId | null;
  readonly write: boolean;
} {
  const selectArg = args.find((arg) => arg.startsWith('--select='));
  const selectSetId = selectArg?.slice('--select='.length) ?? null;

  return {
    force: args.includes('--force'),
    selectSetId: selectSetId === 'candidate-a' || selectSetId === 'candidate-b' ? selectSetId : null,
    write: args.includes('--write'),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

if (isDirectCli(import.meta.url)) {
  const options = parseCoinReportCliOptions(process.argv.slice(2));

  try {
    if (options.selectSetId) {
      selectCoinAssets(FOOTBALL_JS_COIN_ASSET_PLAN, {
        force: options.force,
        selectedSetId: options.selectSetId,
      });
    }
    if (options.write || options.selectSetId) {
      writeCoinAssetReportFiles(createCoinAssetReport());
    }
    console.log(JSON.stringify(createCoinAssetReport(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
