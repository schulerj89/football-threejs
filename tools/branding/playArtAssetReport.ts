import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  FOOTBALL_JS_PLAY_ART_ASSET_PLAN,
  validateFootballJsPlayArtAssetPlan,
  type PlayArtCandidateId,
  type PlayArtImageAssetPlan,
} from './playArtAssetPlan';
import {
  createContentHash,
  getFileContentHash,
  getFileSizeBytes,
  isDirectCli,
  resolveRepoPath,
  writeJsonFile,
} from './schemas';

export interface PlayArtGenerationMetadata {
  readonly apiEndpoint: 'images/edits' | 'images/generations';
  readonly referenceImagePath: string | null;
  readonly referenceMode: 'generationFallback' | 'imageEdit' | 'none';
  readonly revisedPrompt?: string | null;
}

export interface PlayArtImageProvenance {
  readonly assetId: string;
  readonly background: PlayArtImageAssetPlan['background'];
  readonly candidateId: PlayArtCandidateId;
  readonly compressedBytes: number;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly generationMetadata: PlayArtGenerationMetadata;
  readonly model: PlayArtImageAssetPlan['model'];
  readonly outputFormat: PlayArtImageAssetPlan['outputFormat'];
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: PlayArtImageAssetPlan['quality'];
  readonly referenceImagePath: string;
  readonly requestedSize: PlayArtImageAssetPlan['requestedSize'];
}

export interface PlayArtAssetReportEntry {
  readonly assetId: string;
  readonly candidateId: PlayArtCandidateId;
  readonly compressedBytes: number;
  readonly contentHash: string | null;
  readonly dimensions: {
    readonly height: number;
    readonly width: number;
  };
  readonly exists: boolean;
  readonly model: string;
  readonly notes: string;
  readonly outputFormat: string;
  readonly outputPath: string;
  readonly prompt: string;
  readonly provenance: PlayArtImageProvenance | null;
  readonly provenancePath: string;
  readonly quality: string;
  readonly referenceImageExists: boolean;
  readonly referenceImagePath: string;
  readonly requestedSize: string;
}

export interface PlayArtAssetReport {
  readonly assetCount: number;
  readonly assets: readonly PlayArtAssetReportEntry[];
  readonly galleryPath: string;
  readonly generatedCount: number;
  readonly generatedTotalBytes: number;
  readonly referenceImagePath: string;
  readonly reportPath: string;
  readonly selection: PlayArtSelection | null;
  readonly selectionPath: string;
  readonly validationErrors: readonly string[];
}

export interface PlayArtSelection {
  readonly selected: PlayArtSelectionEntry;
  readonly selectedAt: string;
  readonly selectedCandidateId: PlayArtCandidateId;
}

export interface PlayArtSelectionEntry {
  readonly assetId: string;
  readonly contentHash: string | null;
  readonly outputPath: string;
  readonly runtimeImageUrl: string;
  readonly runtimePath: string;
}

export interface PlayArtSelectionOptions {
  readonly force: boolean;
  readonly selectedAt?: string;
  readonly selectedCandidateId: PlayArtCandidateId;
}

export const PLAY_ART_REPORT_PATH = 'public/branding/play-art/play-art-asset-report.json';
export const PLAY_ART_SELECTION_PATH = 'public/branding/play-art/play-art-selection.json';
export const PLAY_ART_GALLERY_PATH = 'public/branding/play-art/play-art-gallery.html';
export const PLAY_ART_REFERENCE_IMAGE_PATH = 'public/branding/play-art/current-play-svg-context.png';
export const FOOTBALL_JS_PLAY_ART_RUNTIME_PATH = 'public/branding/play-art/football-js-play-card-field.webp';

export function createPlayArtAssetReport(
  plan: readonly PlayArtImageAssetPlan[] = FOOTBALL_JS_PLAY_ART_ASSET_PLAN,
): PlayArtAssetReport {
  const validationErrors = validateFootballJsPlayArtAssetPlan(plan);
  const assets = plan.map((asset): PlayArtAssetReportEntry => {
    const exists = existsSync(resolveRepoPath(asset.outputPath));

    return {
      assetId: asset.assetId,
      candidateId: asset.candidateId,
      compressedBytes: exists ? getFileSizeBytes(asset.outputPath) : 0,
      contentHash: exists ? getFileContentHash(asset.outputPath) : null,
      dimensions: parseRequestedSize(asset.requestedSize),
      exists,
      model: asset.model,
      notes: asset.notes,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provenance: readPlayArtImageProvenance(asset),
      provenancePath: `${asset.outputPath}.json`,
      quality: asset.quality,
      referenceImageExists: existsSync(resolveRepoPath(asset.referenceImagePath)),
      referenceImagePath: asset.referenceImagePath,
      requestedSize: asset.requestedSize,
    };
  });

  return {
    assetCount: assets.length,
    assets,
    galleryPath: PLAY_ART_GALLERY_PATH,
    generatedCount: assets.filter((asset) => asset.exists).length,
    generatedTotalBytes: assets.reduce((total, asset) => total + asset.compressedBytes, 0),
    referenceImagePath: PLAY_ART_REFERENCE_IMAGE_PATH,
    reportPath: PLAY_ART_REPORT_PATH,
    selection: readPlayArtSelection(),
    selectionPath: PLAY_ART_SELECTION_PATH,
    validationErrors,
  };
}

export function writePlayArtAssetReportFiles(report: PlayArtAssetReport): void {
  writeJsonFile(resolveRepoPath(PLAY_ART_REPORT_PATH), report);
  writePlayArtGalleryHtml(report);
}

export function selectPlayArtAsset(
  plan: readonly PlayArtImageAssetPlan[],
  options: PlayArtSelectionOptions,
): PlayArtSelection {
  const asset = plan.find((candidate) => candidate.candidateId === options.selectedCandidateId);

  if (!asset) {
    throw new Error(`Unknown play-art candidate: ${options.selectedCandidateId}`);
  }

  copyPlayArtRuntimeAsset(asset.outputPath, FOOTBALL_JS_PLAY_ART_RUNTIME_PATH, options.force);

  const selection: PlayArtSelection = {
    selected: {
      assetId: asset.assetId,
      contentHash: getFileContentHash(asset.outputPath),
      outputPath: asset.outputPath,
      runtimeImageUrl: '/branding/play-art/football-js-play-card-field.webp',
      runtimePath: FOOTBALL_JS_PLAY_ART_RUNTIME_PATH,
    },
    selectedAt: options.selectedAt ?? new Date().toISOString(),
    selectedCandidateId: options.selectedCandidateId,
  };
  writeJsonFile(resolveRepoPath(PLAY_ART_SELECTION_PATH), selection);
  return selection;
}

export function writePlayArtImageProvenanceSidecar(
  asset: PlayArtImageAssetPlan,
  content: Uint8Array,
  metadata: PlayArtGenerationMetadata,
  generatedAt = new Date().toISOString(),
): void {
  const sidecarPath = `${resolveRepoPath(asset.outputPath)}.json`;
  writeJsonFile(sidecarPath, {
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
    referenceImagePath: asset.referenceImagePath,
    requestedSize: asset.requestedSize,
  } satisfies PlayArtImageProvenance);
}

export function readPlayArtImageProvenance(asset: PlayArtImageAssetPlan): PlayArtImageProvenance | null {
  const sidecarPath = `${resolveRepoPath(asset.outputPath)}.json`;

  if (!existsSync(sidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sidecarPath, 'utf8')) as PlayArtImageProvenance;
  } catch {
    return null;
  }
}

export function readPlayArtSelection(): PlayArtSelection | null {
  if (!existsSync(resolveRepoPath(PLAY_ART_SELECTION_PATH))) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(resolveRepoPath(PLAY_ART_SELECTION_PATH), 'utf8')) as PlayArtSelection;
  } catch {
    return null;
  }
}

function copyPlayArtRuntimeAsset(sourcePath: string, destinationPath: string, force: boolean): void {
  const absoluteSourcePath = resolveRepoPath(sourcePath);
  const absoluteDestinationPath = resolveRepoPath(destinationPath);

  if (!existsSync(absoluteSourcePath)) {
    throw new Error(`Missing selected play-art asset: ${sourcePath}`);
  }
  if (existsSync(absoluteDestinationPath) && !force) {
    const sourceHash = createContentHash(readFileSync(absoluteSourcePath));
    const destinationHash = createContentHash(readFileSync(absoluteDestinationPath));

    if (sourceHash !== destinationHash) {
      throw new Error(`${destinationPath}: output already exists. Pass --force to overwrite.`);
    }
  }

  mkdirSync(resolveRepoPath('public/branding/play-art'), { recursive: true });
  copyFileSync(absoluteSourcePath, absoluteDestinationPath);
}

function writePlayArtGalleryHtml(report: PlayArtAssetReport): void {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Football JS Play Art Gallery</title>
  <style>
    body { margin: 0; background: #07100d; color: #f4f8f5; font-family: Arial, sans-serif; }
    main { padding: 24px; }
    h1, h2 { margin: 0 0 12px; }
    .context, .grid { display: grid; gap: 16px; }
    .grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    figure { margin: 0; padding: 12px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(255,255,255,.05); }
    img { display: block; width: 100%; height: auto; border-radius: 6px; background: #102018; }
    figcaption { margin-top: 10px; color: #cbd8d0; font-size: 13px; line-height: 1.4; }
    code { color: #f6e27a; }
    .missing { display: grid; min-height: 160px; place-items: center; border: 1px dashed rgba(255,255,255,.24); border-radius: 6px; color: #b8c4bd; }
  </style>
</head>
<body>
  <main>
    <h1>Football JS Play Art Gallery</h1>
    <p>GPT Image 2 candidates are blank play-card backgrounds. Runtime SVG routes, blocks, players, and arrows stay data-driven on top.</p>
    <section class="context">
      <h2>Current Play SVG Screenshot Context</h2>
      ${existsSync(resolveRepoPath(PLAY_ART_REFERENCE_IMAGE_PATH))
        ? `<figure><img src="/branding/play-art/current-play-svg-context.png" alt="Current play-card SVG context screenshot"><figcaption>Reference screenshot used for context when available.</figcaption></figure>`
        : `<div class="missing">Missing ${PLAY_ART_REFERENCE_IMAGE_PATH}</div>`}
    </section>
    <h2>Candidates</h2>
    <section class="grid">
      ${report.assets.map((asset) => `
        <figure>
          ${asset.exists
            ? `<img src="/${asset.outputPath.replace(/^public\//, '')}" alt="${asset.assetId} play-card background candidate">`
            : `<div class="missing">Missing ${asset.outputPath}</div>`}
          <figcaption>
            <strong>${asset.assetId}</strong><br>
            ${asset.notes}<br>
            ${asset.exists ? `${asset.compressedBytes} bytes, hash <code>${asset.contentHash?.slice(0, 12) ?? 'n/a'}</code>` : 'not generated'}
          </figcaption>
        </figure>
      `).join('')}
    </section>
  </main>
</body>
</html>
`;
  const galleryPath = resolveRepoPath(PLAY_ART_GALLERY_PATH);
  mkdirSync(resolveRepoPath('public/branding/play-art'), { recursive: true });
  writeFileSync(galleryPath, html, 'utf8');
}

function parseRequestedSize(size: string): { height: number; width: number } {
  const match = /^(\d+)x(\d+)$/.exec(size);
  return {
    height: match ? Number(match[2]) : 0,
    width: match ? Number(match[1]) : 0,
  };
}

if (isDirectCli(import.meta.url)) {
  const report = createPlayArtAssetReport();
  writePlayArtAssetReportFiles(report);
  console.log(JSON.stringify(report, null, 2));
  if (report.validationErrors.length > 0) {
    process.exitCode = 1;
  }
}
