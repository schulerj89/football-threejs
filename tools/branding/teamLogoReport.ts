import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
  validateFootballJsTeamLogoPlan,
  type TeamLogoAssetPlan,
  type TeamLogoCandidateId,
} from './teamLogoPlan';
import {
  createContentHash,
  getFileContentHash,
  getFileSizeBytes,
  isDirectCli,
  normalizePathForManifest,
  resolveRepoPath,
  writeJsonFile,
} from './schemas';

export interface TeamLogoGenerationMetadata {
  readonly apiEndpoint: 'images/generations';
  readonly revisedPrompt?: string | null;
}

export interface TeamLogoProvenance {
  readonly assetId: string;
  readonly background: TeamLogoAssetPlan['background'];
  readonly candidateId: TeamLogoCandidateId;
  readonly compressedBytes: number;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly generationMetadata: TeamLogoGenerationMetadata;
  readonly model: TeamLogoAssetPlan['model'];
  readonly outputFormat: TeamLogoAssetPlan['outputFormat'];
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: TeamLogoAssetPlan['quality'];
  readonly requestedSize: TeamLogoAssetPlan['requestedSize'];
  readonly teamId: string;
}

export interface TeamLogoReportEntry {
  readonly assetId: string;
  readonly candidateId: TeamLogoCandidateId;
  readonly compressedBytes: number;
  readonly contentHash: string | null;
  readonly exists: boolean;
  readonly model: string;
  readonly outputFormat: string;
  readonly outputPath: string;
  readonly prompt: string;
  readonly provenance: TeamLogoProvenance | null;
  readonly provenancePath: string;
  readonly quality: string;
  readonly requestedSize: string;
  readonly teamId: string;
}

export interface TeamLogoSelection {
  readonly selectedAt: string;
  readonly teams: readonly TeamLogoSelectionEntry[];
}

export interface TeamLogoSelectionEntry {
  readonly assetId: string;
  readonly candidateId: TeamLogoCandidateId;
  readonly contentHash: string | null;
  readonly outputPath: string;
  readonly runtimeImageUrl: string;
  readonly runtimePath: string;
  readonly teamId: string;
}

export interface TeamLogoReport {
  readonly assetCount: number;
  readonly assets: readonly TeamLogoReportEntry[];
  readonly galleryPath: string;
  readonly generatedCount: number;
  readonly generatedTotalBytes: number;
  readonly reportPath: string;
  readonly selection: TeamLogoSelection | null;
  readonly selectionPath: string;
  readonly validationErrors: readonly string[];
}

export interface TeamLogoSelectionOptions {
  readonly force: boolean;
  readonly selectedAt?: string;
  readonly selectedCandidateId: TeamLogoCandidateId;
}

export const TEAM_LOGO_REPORT_PATH = 'public/branding/teams/team-logo-report.json';
export const TEAM_LOGO_SELECTION_PATH = 'public/branding/teams/team-logo-selection.json';
export const TEAM_LOGO_GALLERY_PATH = 'public/branding/teams/team-logo-gallery.html';

export function createTeamLogoReport(
  plan: readonly TeamLogoAssetPlan[] = FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
): TeamLogoReport {
  const validationErrors = validateFootballJsTeamLogoPlan(plan);
  const assets = plan.map((asset): TeamLogoReportEntry => {
    const exists = existsSync(resolveRepoPath(asset.outputPath));
    return {
      assetId: asset.assetId,
      candidateId: asset.candidateId,
      compressedBytes: exists ? getFileSizeBytes(asset.outputPath) : 0,
      contentHash: exists ? getFileContentHash(asset.outputPath) : null,
      exists,
      model: asset.model,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provenance: readTeamLogoProvenance(asset),
      provenancePath: `${asset.outputPath}.json`,
      quality: asset.quality,
      requestedSize: asset.requestedSize,
      teamId: asset.teamId,
    };
  });

  return {
    assetCount: assets.length,
    assets,
    galleryPath: TEAM_LOGO_GALLERY_PATH,
    generatedCount: assets.filter((asset) => asset.exists).length,
    generatedTotalBytes: assets.reduce((total, asset) => total + asset.compressedBytes, 0),
    reportPath: TEAM_LOGO_REPORT_PATH,
    selection: readTeamLogoSelection(),
    selectionPath: TEAM_LOGO_SELECTION_PATH,
    validationErrors,
  };
}

export function writeTeamLogoReportFiles(report: TeamLogoReport): void {
  writeJsonFile(resolveRepoPath(TEAM_LOGO_REPORT_PATH), report);
  writeTeamLogoGalleryHtml(report);
}

export function selectTeamLogos(
  plan: readonly TeamLogoAssetPlan[],
  options: TeamLogoSelectionOptions,
): TeamLogoSelection {
  const teamIds = [...new Set(plan.map((asset) => asset.teamId))].sort();
  const selectedAt = options.selectedAt ?? new Date().toISOString();
  const teams = teamIds.map((teamId): TeamLogoSelectionEntry => {
    const asset = plan.find(
      (candidate) => candidate.teamId === teamId && candidate.candidateId === options.selectedCandidateId,
    );

    if (!asset) {
      throw new Error(`${teamId}: missing ${options.selectedCandidateId} logo candidate`);
    }

    const runtimePath = `public/branding/teams/${teamId}/logo.webp`;
    copyTeamLogoRuntimeAsset(asset.outputPath, runtimePath, options.force);

    return {
      assetId: asset.assetId,
      candidateId: asset.candidateId,
      contentHash: getFileContentHash(asset.outputPath),
      outputPath: asset.outputPath,
      runtimeImageUrl: `/branding/teams/${teamId}/logo.webp`,
      runtimePath,
      teamId,
    };
  });

  const selection: TeamLogoSelection = {
    selectedAt,
    teams,
  };
  writeJsonFile(resolveRepoPath(TEAM_LOGO_SELECTION_PATH), selection);
  return selection;
}

export function writeTeamLogoProvenanceSidecar(
  asset: TeamLogoAssetPlan,
  content: Uint8Array,
  metadata: TeamLogoGenerationMetadata,
  generatedAt = new Date().toISOString(),
): void {
  const provenance: TeamLogoProvenance = {
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
    teamId: asset.teamId,
  };
  writeJsonFile(resolveRepoPath(`${asset.outputPath}.json`), provenance);
}

export function readTeamLogoProvenance(asset: TeamLogoAssetPlan): TeamLogoProvenance | null {
  const sidecarPath = resolveRepoPath(`${asset.outputPath}.json`);

  if (!existsSync(sidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sidecarPath, 'utf8')) as TeamLogoProvenance;
  } catch {
    return null;
  }
}

function writeTeamLogoGalleryHtml(report: TeamLogoReport): void {
  const teamIds = [...new Set(report.assets.map((asset) => asset.teamId))].sort();
  const sections = teamIds.map((teamId) => {
    const assets = report.assets.filter((asset) => asset.teamId === teamId);
    const cards = assets.map((asset) => {
      const selected = report.selection?.teams.some((entry) => entry.assetId === asset.assetId) ?? false;
      const imageUrl = asset.exists
        ? normalizePathForManifest(asset.outputPath).replace(/^public\/branding\/teams\//, './')
        : '';
      const preview = asset.exists
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${teamId} ${asset.candidateId}`)}">`
        : '<div class="missing">Missing</div>';

      return `<article class="card">
        ${preview}
        <h3>${escapeHtml(asset.candidateId)}</h3>
        ${selected ? '<strong class="selected">Selected runtime logo</strong>' : ''}
        <dl>
          <dt>Asset</dt><dd>${escapeHtml(asset.assetId)}</dd>
          <dt>Model</dt><dd>${escapeHtml(asset.model)}</dd>
          <dt>Size</dt><dd>${escapeHtml(asset.requestedSize)}</dd>
          <dt>Quality</dt><dd>${escapeHtml(asset.quality)}</dd>
          <dt>Format</dt><dd>${escapeHtml(asset.outputFormat)}</dd>
          <dt>Bytes</dt><dd>${asset.compressedBytes}</dd>
          <dt>Hash</dt><dd>${escapeHtml(asset.contentHash ?? 'missing')}</dd>
          <dt>Generated</dt><dd>${escapeHtml(asset.provenance?.generatedAt ?? 'missing')}</dd>
        </dl>
      </article>`;
    }).join('\n');

    return `<section>
      <h2>${escapeHtml(teamId)}</h2>
      <div class="grid">${cards}</div>
    </section>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Football JS Team Logo Gallery</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #101418; color: #f2f5f7; }
      body { margin: 0; padding: 32px; }
      h1 { margin: 0 0 8px; }
      h2 { margin-top: 30px; text-transform: uppercase; letter-spacing: .08em; color: #9ec7db; }
      .summary { color: #bac5cd; margin-bottom: 24px; }
      .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      .card { background: #182029; border: 1px solid #31404d; border-radius: 8px; padding: 16px; }
      img, .missing { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: #0a0d10; display: grid; place-items: center; color: #82909b; }
      h3 { font-size: 17px; margin: 14px 0 8px; }
      .selected { display: inline-block; color: #ffd35a; margin-bottom: 10px; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; font-size: 13px; }
      dt { color: #94a3ad; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <h1>Football JS Team Logo Gallery</h1>
    <p class="summary">${report.generatedCount} / ${report.assetCount} generated. Selected teams: ${report.selection?.teams.length ?? 0}.</p>
    ${sections}
  </body>
</html>
`;
  writeTextFile(resolveRepoPath(TEAM_LOGO_GALLERY_PATH), html);
}

function readTeamLogoSelection(): TeamLogoSelection | null {
  const selectionPath = resolveRepoPath(TEAM_LOGO_SELECTION_PATH);

  if (!existsSync(selectionPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(selectionPath, 'utf8')) as TeamLogoSelection;
  } catch {
    return null;
  }
}

function copyTeamLogoRuntimeAsset(sourcePath: string, destinationPath: string, force: boolean): void {
  const absoluteSourcePath = resolveRepoPath(sourcePath);
  const absoluteDestinationPath = resolveRepoPath(destinationPath);

  if (!existsSync(absoluteSourcePath)) {
    throw new Error(`Missing selected team logo asset: ${sourcePath}`);
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

function parseTeamLogoReportCliOptions(args: readonly string[]): {
  readonly force: boolean;
  readonly selectCandidateId: TeamLogoCandidateId | null;
  readonly write: boolean;
} {
  const selectArg = args.find((arg) => arg.startsWith('--select='));
  const selectCandidateId = selectArg?.slice('--select='.length) ?? process.env.npm_config_select ?? null;

  return {
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    selectCandidateId: selectCandidateId === 'candidate-a' || selectCandidateId === 'candidate-b'
      ? selectCandidateId
      : null,
    write: args.includes('--write') || readCliBoolean(process.env.npm_config_write),
  };
}

function readCliBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true';
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
  const options = parseTeamLogoReportCliOptions(process.argv.slice(2));

  try {
    if (options.selectCandidateId) {
      selectTeamLogos(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN, {
        force: options.force,
        selectedCandidateId: options.selectCandidateId,
      });
    }
    if (options.write || options.selectCandidateId) {
      writeTeamLogoReportFiles(createTeamLogoReport());
    }
    console.log(JSON.stringify(createTeamLogoReport(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
