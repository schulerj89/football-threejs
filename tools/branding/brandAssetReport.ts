import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FOOTBALL_JS_BRAND_ASSET_PLAN } from './brandAssetPlan';
import {
  BRAND_GALLERY_PATH,
  BRAND_REPORT_PATH,
  BRAND_SELECTION_PATH,
  FOOTBALL_JS_EMBLEM_RUNTIME_PATH,
  FOOTBALL_JS_TITLE_RUNTIME_PATH,
  copyBrandRuntimeAsset,
  getFileContentHash,
  getFileSizeBytes,
  isDirectCli,
  normalizePathForManifest,
  readBrandImageProvenance,
  resolveRepoPath,
  validateBrandAssetPlan,
  writeJsonFile,
  type BrandImageAssetPlan,
  type BrandImageProvenance,
} from './schemas';

export interface BrandAssetReportEntry {
  readonly assetId: string;
  readonly category: BrandImageAssetPlan['category'];
  readonly compressedBytes: number;
  readonly contentHash: string | null;
  readonly exists: boolean;
  readonly model: string;
  readonly outputFormat: BrandImageAssetPlan['outputFormat'];
  readonly outputPath: string;
  readonly prompt: string;
  readonly provenance: BrandImageProvenance | null;
  readonly provenancePath: string;
  readonly provisionalApproval: BrandImageAssetPlan['provisionalApproval'];
  readonly quality: BrandImageAssetPlan['quality'];
  readonly requestedSize: string;
}

export interface BrandAssetReport {
  readonly assetCount: number;
  readonly assets: readonly BrandAssetReportEntry[];
  readonly generatedCount: number;
  readonly generatedTotalBytes: number;
  readonly galleryPath: string;
  readonly reportPath: string;
  readonly selectionPath: string;
  readonly validationErrors: readonly string[];
}

export interface BrandSelection {
  readonly brandTitle: string;
  readonly emblem: BrandSelectionEntry;
  readonly selectedAt: string;
  readonly title: BrandSelectionEntry;
}

export interface BrandSelectionEntry {
  readonly assetId: string;
  readonly contentHash: string | null;
  readonly outputPath: string;
  readonly runtimeImageUrl: string;
  readonly runtimePath: string;
}

export interface BrandSelectionOptions {
  readonly emblemAssetId: string;
  readonly force: boolean;
  readonly selectedAt?: string;
  readonly titleAssetId: string;
}

export function createBrandAssetReport(
  plan: readonly BrandImageAssetPlan[] = FOOTBALL_JS_BRAND_ASSET_PLAN,
): BrandAssetReport {
  const validationErrors = validateBrandAssetPlan(plan);
  const assets = plan.map((asset): BrandAssetReportEntry => {
    const exists = existsSync(resolveRepoPath(asset.outputPath));
    return {
      assetId: asset.assetId,
      category: asset.category,
      compressedBytes: exists ? getFileSizeBytes(asset.outputPath) : 0,
      contentHash: exists ? getFileContentHash(asset.outputPath) : null,
      exists,
      model: asset.model,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provenance: readBrandImageProvenance(asset),
      provenancePath: `${asset.outputPath}.json`,
      provisionalApproval: asset.provisionalApproval,
      quality: asset.quality,
      requestedSize: asset.requestedSize,
    };
  });

  return {
    assetCount: assets.length,
    assets,
    generatedCount: assets.filter((asset) => asset.exists).length,
    generatedTotalBytes: assets.reduce((total, asset) => total + asset.compressedBytes, 0),
    galleryPath: BRAND_GALLERY_PATH,
    reportPath: BRAND_REPORT_PATH,
    selectionPath: BRAND_SELECTION_PATH,
    validationErrors,
  };
}

export function writeBrandAssetReportFiles(report: BrandAssetReport): void {
  writeJsonFile(resolveRepoPath(BRAND_REPORT_PATH), report);
  writeBrandGalleryHtml(report);
}

export function selectBrandAssets(
  plan: readonly BrandImageAssetPlan[],
  options: BrandSelectionOptions,
): BrandSelection {
  const titleAsset = plan.find((asset) => asset.assetId === options.titleAssetId);
  const emblemAsset = plan.find((asset) => asset.assetId === options.emblemAssetId);

  if (!titleAsset || titleAsset.category !== 'title') {
    throw new Error(`Unknown title brand asset: ${options.titleAssetId}`);
  }
  if (!emblemAsset || emblemAsset.category !== 'emblem') {
    throw new Error(`Unknown emblem brand asset: ${options.emblemAssetId}`);
  }

  copyBrandRuntimeAsset(titleAsset.outputPath, FOOTBALL_JS_TITLE_RUNTIME_PATH, options.force);
  copyBrandRuntimeAsset(emblemAsset.outputPath, FOOTBALL_JS_EMBLEM_RUNTIME_PATH, options.force);

  const selection: BrandSelection = {
    brandTitle: 'Football JS',
    emblem: {
      assetId: emblemAsset.assetId,
      contentHash: getFileContentHash(emblemAsset.outputPath),
      outputPath: emblemAsset.outputPath,
      runtimeImageUrl: '/branding/football-js-emblem.webp',
      runtimePath: FOOTBALL_JS_EMBLEM_RUNTIME_PATH,
    },
    selectedAt: options.selectedAt ?? new Date().toISOString(),
    title: {
      assetId: titleAsset.assetId,
      contentHash: getFileContentHash(titleAsset.outputPath),
      outputPath: titleAsset.outputPath,
      runtimeImageUrl: '/branding/football-js-title.webp',
      runtimePath: FOOTBALL_JS_TITLE_RUNTIME_PATH,
    },
  };
  writeJsonFile(resolveRepoPath(BRAND_SELECTION_PATH), selection);
  return selection;
}

function writeBrandGalleryHtml(report: BrandAssetReport): void {
  const selection = readBrandSelection();
  const cards = report.assets.map((asset) => {
    const imageUrl = asset.exists ? `/${normalizePathForManifest(asset.outputPath).replace(/^public\//, '')}` : '';
    const selectedLabel = selection && (
      selection.title.assetId === asset.assetId || selection.emblem.assetId === asset.assetId
    )
      ? '<strong class="selected">Selected runtime candidate</strong>'
      : '';
    const preview = asset.exists
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(asset.assetId)}">`
      : '<div class="missing">Missing</div>';
    return `<article class="card">
      ${preview}
      <h2>${escapeHtml(asset.assetId)}</h2>${selectedLabel ? `\n      ${selectedLabel}` : ''}
      <dl>
        <dt>Category</dt><dd>${escapeHtml(asset.category)}</dd>
        <dt>Model</dt><dd>${escapeHtml(asset.model)}</dd>
        <dt>Size</dt><dd>${escapeHtml(asset.requestedSize)}</dd>
        <dt>Quality</dt><dd>${escapeHtml(asset.quality)}</dd>
        <dt>Format</dt><dd>${escapeHtml(asset.outputFormat)}</dd>
        <dt>Bytes</dt><dd>${asset.compressedBytes}</dd>
        <dt>Hash</dt><dd>${escapeHtml(asset.contentHash ?? 'missing')}</dd>
        <dt>Generated</dt><dd>${escapeHtml(asset.provenance?.generatedAt ?? 'missing')}</dd>
      </dl>
      <p>${escapeHtml(asset.prompt)}</p>
    </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Football JS Brand Gallery</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #101418; color: #f2f5f7; }
      body { margin: 0; padding: 32px; }
      h1 { margin: 0 0 8px; }
      .summary { color: #bac5cd; margin-bottom: 24px; }
      .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .card { background: #182029; border: 1px solid #31404d; border-radius: 8px; padding: 16px; }
      img, .missing { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 6px; background: #0a0d10; display: grid; place-items: center; color: #82909b; }
      .card:nth-child(n+3) img, .card:nth-child(n+3) .missing { aspect-ratio: 1; object-fit: contain; }
      h2 { font-size: 18px; margin: 14px 0 8px; }
      .selected { display: inline-block; color: #ffd35a; margin-bottom: 10px; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; font-size: 13px; }
      dt { color: #94a3ad; }
      dd { margin: 0; overflow-wrap: anywhere; }
      p { color: #c9d4dc; font-size: 13px; line-height: 1.45; }
    </style>
  </head>
  <body>
    <h1>Football JS Brand Gallery</h1>
    <p class="summary">${report.generatedCount} / ${report.assetCount} generated. Total compressed bytes: ${report.generatedTotalBytes}.</p>
    <main class="grid">${cards}</main>
  </body>
</html>
`;
  writeJsonAdjacentText(resolveRepoPath(BRAND_GALLERY_PATH), html);
}

function readBrandSelection(): BrandSelection | null {
  const selectionPath = resolveRepoPath(BRAND_SELECTION_PATH);

  if (!existsSync(selectionPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(selectionPath, 'utf8')) as BrandSelection;
  } catch {
    return null;
  }
}

function writeJsonAdjacentText(absolutePath: string, text: string): void {
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

function parseReportCliOptions(args: readonly string[]): {
  readonly emblemAssetId: string | null;
  readonly force: boolean;
  readonly titleAssetId: string | null;
  readonly write: boolean;
} {
  let emblemAssetId: string | null = null;
  let titleAssetId: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--select-title=')) {
      titleAssetId = arg.slice('--select-title='.length);
    } else if (arg.startsWith('--select-emblem=')) {
      emblemAssetId = arg.slice('--select-emblem='.length);
    }
  }

  return {
    emblemAssetId,
    force: args.includes('--force'),
    titleAssetId,
    write: args.includes('--write'),
  };
}

if (isDirectCli(import.meta.url)) {
  const options = parseReportCliOptions(process.argv.slice(2));
  const report = createBrandAssetReport();

  try {
    if (options.titleAssetId || options.emblemAssetId) {
      if (!options.titleAssetId || !options.emblemAssetId) {
        throw new Error('Both --select-title and --select-emblem are required when selecting runtime assets.');
      }
      selectBrandAssets(FOOTBALL_JS_BRAND_ASSET_PLAN, {
        emblemAssetId: options.emblemAssetId,
        force: options.force,
        titleAssetId: options.titleAssetId,
      });
    }
    if (options.write || options.titleAssetId || options.emblemAssetId) {
      writeBrandAssetReportFiles(createBrandAssetReport());
    }
    console.log(JSON.stringify(createBrandAssetReport(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
