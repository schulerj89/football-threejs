import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import {
  FOOTBALL_EXPANDED_MUSIC_PLAN,
  FOOTBALL_MENU_PLAYLIST_PLAN,
  FOOTBALL_MUSIC_COMPOSER_DISPLAY,
  FOOTBALL_STADIUM_CHANT_PLAN,
  FOOTBALL_TITLE_MUSIC_PLAN,
  FOOTBALL_TRANSITION_STINGER_PLAN,
  type MusicCatalogCategory,
} from './musicPlan';
import {
  getFileHash,
  isDirectCli,
  readAudioDurationSeconds,
  resolveRepoPath,
  toRepoRelativePath,
  validateAudioPlan,
  type AudioAssetPlan,
  type AudioProvenance,
} from './schemas';

export interface MusicCandidateReportEntry {
  assetId: string;
  candidateDescription: string;
  catalogCategory: MusicCatalogCategory | null;
  compressedBytes: number;
  contentHash: string | null;
  decodable: boolean | null;
  displayTitle: string;
  durationSeconds: number | null;
  durationStatus: 'missing' | 'ok' | 'outOfRange' | 'unknown';
  exists: boolean;
  generationPrompt: string;
  generationTimestamp: string | null;
  longSilenceWarnings: readonly string[] | null;
  modelId: string;
  outputFormat: string;
  outputPath: string;
  provenanceExists: boolean;
  provenancePath: string;
  requestedDurationSeconds: number;
  selected: boolean;
  songId: string | null;
  stableFilename: boolean;
}

export interface MusicCatalogEntry {
  assetId: string;
  category: MusicCatalogCategory;
  composerDisplay: string;
  contentHash: string | null;
  displayTitle: string;
  durationSeconds: number | null;
  energyLevel: string;
  generationMetadata: {
    generatedAt: string | null;
    modelId: string;
    outputFormat: string;
    prompt: string;
    songId: string | null;
  };
  looping: boolean;
  outputPath: string;
  runtimeAudioUrl: string;
  transitionPurpose: string;
}

export interface TitleMusicReport {
  assetCount: number;
  auditionPath: string;
  candidates: MusicCandidateReportEntry[];
  catalog: MusicCatalogEntry[];
  catalogPath: string;
  generatedAt: string;
  generatedCount: number;
  reportPath: string;
  selection: TitleMusicSelection | null;
  selectionPath: string;
  totalCompressedBytes: number;
  validationErrors: string[];
}

export interface TitleMusicSelection {
  assetId: string;
  contentHash: string | null;
  outputPath: string;
  runtimeAudioUrl: string;
  runtimePath: string;
  selectedAt: string;
}

export interface TitleMusicSelectionOptions {
  assetId: string;
  force: boolean;
  selectedAt?: string;
}

export const TITLE_MUSIC_REPORT_PATH = 'public/audio/music/music-report.json';
export const TITLE_MUSIC_AUDITION_PATH = 'public/audio/music/music-audition.html';
export const TITLE_MUSIC_CATALOG_PATH = 'public/audio/music/music-catalog.json';
export const TITLE_MUSIC_SELECTION_PATH = 'public/audio/music/music-selection.json';
export const TITLE_MUSIC_RUNTIME_PATH = 'public/audio/music/football-js-title.mp3';

const RUNTIME_TITLE_CATALOG_ID = 'football-js-title';
const RUNTIME_TITLE_DISPLAY_TITLE = 'Football JS Main Theme';

export function createTitleMusicReport(
  plan: readonly AudioAssetPlan[] = FOOTBALL_EXPANDED_MUSIC_PLAN,
  generatedAt = new Date().toISOString(),
): TitleMusicReport {
  const selection = readTitleMusicSelection();
  const candidates = plan.map((asset) => createCandidateReportEntry(asset, selection));
  const catalog = createMusicCatalog(plan, selection);
  const catalogErrors = validateMusicCatalog(catalog, candidates, selection);

  return {
    assetCount: plan.length,
    auditionPath: TITLE_MUSIC_AUDITION_PATH,
    candidates,
    catalog,
    catalogPath: TITLE_MUSIC_CATALOG_PATH,
    generatedAt,
    generatedCount: candidates.filter((candidate) => candidate.exists).length,
    reportPath: TITLE_MUSIC_REPORT_PATH,
    selection,
    selectionPath: TITLE_MUSIC_SELECTION_PATH,
    totalCompressedBytes: catalog.reduce((sum, entry) => {
      const path = resolveRepoPath(entry.outputPath);
      return sum + (existsSync(path) ? statSync(path).size : 0);
    }, 0),
    validationErrors: [
      ...validateAudioPlan(plan),
      ...catalogErrors,
      ...candidates.flatMap((candidate) => validateCandidate(candidate)),
    ],
  };
}

export function selectTitleMusicAsset(
  plan: readonly AudioAssetPlan[],
  options: TitleMusicSelectionOptions,
): TitleMusicSelection {
  const asset = plan.find((candidate) => candidate.assetId === options.assetId);

  if (!asset) {
    throw new Error(`Unknown title music asset: ${options.assetId}`);
  }

  const sourcePath = resolveRepoPath(asset.outputPath);
  const destinationPath = resolveRepoPath(TITLE_MUSIC_RUNTIME_PATH);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing selected title music asset: ${asset.outputPath}`);
  }
  if (existsSync(destinationPath) && !options.force) {
    const sourceHash = getFileHash(asset.outputPath);
    const destinationHash = getFileHash(TITLE_MUSIC_RUNTIME_PATH);
    if (sourceHash !== destinationHash) {
      throw new Error(`${TITLE_MUSIC_RUNTIME_PATH}: output already exists. Pass --force to overwrite.`);
    }
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
  const selection: TitleMusicSelection = {
    assetId: asset.assetId,
    contentHash: getFileHash(asset.outputPath),
    outputPath: asset.outputPath,
    runtimeAudioUrl: '/audio/music/football-js-title.mp3',
    runtimePath: TITLE_MUSIC_RUNTIME_PATH,
    selectedAt: options.selectedAt ?? new Date().toISOString(),
  };
  writeFileSync(resolveRepoPath(TITLE_MUSIC_SELECTION_PATH), `${JSON.stringify(selection, null, 2)}\n`, 'utf8');
  return selection;
}

export function writeTitleMusicReportFiles(
  report: TitleMusicReport = createTitleMusicReport(),
): { auditionPath: string; catalogPath: string; reportPath: string } {
  const reportPath = resolveRepoPath(TITLE_MUSIC_REPORT_PATH);
  const auditionPath = resolveRepoPath(TITLE_MUSIC_AUDITION_PATH);
  const catalogPath = resolveRepoPath(TITLE_MUSIC_CATALOG_PATH);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(catalogPath, `${JSON.stringify({ tracks: report.catalog }, null, 2)}\n`, 'utf8');
  writeFileSync(auditionPath, createMusicAuditionHtml(report), 'utf8');

  return {
    auditionPath: toRepoRelativePath(auditionPath),
    catalogPath: toRepoRelativePath(catalogPath),
    reportPath: toRepoRelativePath(reportPath),
  };
}

if (isDirectCli(import.meta.url)) {
  const options = parseMusicReportCliOptions(process.argv.slice(2));

  try {
    if (options.selectAssetId) {
      selectTitleMusicAsset(FOOTBALL_TITLE_MUSIC_PLAN, {
        assetId: options.selectAssetId,
        force: options.force,
      });
    }
    const report = createTitleMusicReport();
    if (options.write || options.selectAssetId) {
      writeTitleMusicReportFiles(report);
    }
    console.log(JSON.stringify(createTitleMusicReport(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function createCandidateReportEntry(
  asset: AudioAssetPlan,
  selection: TitleMusicSelection | null,
): MusicCandidateReportEntry {
  const exists = existsSync(resolveRepoPath(asset.outputPath));
  const provenance = readMusicProvenance(asset);
  const durationSeconds = exists ? readAudioDurationSeconds(asset.outputPath) : null;
  return {
    assetId: asset.assetId,
    candidateDescription: asset.notes ?? '',
    catalogCategory: getCatalogCategory(asset),
    compressedBytes: exists ? statSync(resolveRepoPath(asset.outputPath)).size : 0,
    contentHash: exists ? getFileHash(asset.outputPath) : null,
    decodable: exists ? durationSeconds !== null : null,
    displayTitle: getDisplayTitle(asset),
    durationSeconds,
    durationStatus: getDurationStatus(asset, exists, durationSeconds),
    exists,
    generationPrompt: asset.prompt ?? '',
    generationTimestamp: provenance?.generatedAt ?? null,
    longSilenceWarnings: exists ? detectLongSilence(asset.outputPath) : null,
    modelId: asset.modelId,
    outputFormat: asset.outputFormat,
    outputPath: asset.outputPath,
    provenanceExists: existsSync(resolveRepoPath(`${asset.outputPath}.json`)),
    provenancePath: `${asset.outputPath}.json`,
    requestedDurationSeconds: asset.requestedDurationSeconds,
    selected: selection?.assetId === asset.assetId,
    songId: provenance?.songId ?? null,
    stableFilename: basename(asset.outputPath, '.mp3') === asset.assetId,
  };
}

function createMusicCatalog(
  plan: readonly AudioAssetPlan[],
  selection: TitleMusicSelection | null,
): MusicCatalogEntry[] {
  const selectedTitle = selection ? createRuntimeTitleCatalogEntry(selection) : null;
  const catalogAssets = plan.filter((asset) =>
    FOOTBALL_MENU_PLAYLIST_PLAN.includes(asset) ||
    FOOTBALL_TRANSITION_STINGER_PLAN.includes(asset) ||
    FOOTBALL_STADIUM_CHANT_PLAN.includes(asset),
  );

  return [
    ...(selectedTitle ? [selectedTitle] : []),
    ...catalogAssets.map(createPlannedCatalogEntry),
  ];
}

function createRuntimeTitleCatalogEntry(selection: TitleMusicSelection): MusicCatalogEntry {
  const selectedPlanAsset = FOOTBALL_TITLE_MUSIC_PLAN.find((asset) => asset.assetId === selection.assetId);
  const provenance = selectedPlanAsset ? readMusicProvenance(selectedPlanAsset) : null;
  return {
    assetId: RUNTIME_TITLE_CATALOG_ID,
    category: 'menu',
    composerDisplay: FOOTBALL_MUSIC_COMPOSER_DISPLAY,
    contentHash: getFileHash(TITLE_MUSIC_RUNTIME_PATH),
    displayTitle: RUNTIME_TITLE_DISPLAY_TITLE,
    durationSeconds: readAudioDurationSeconds(TITLE_MUSIC_RUNTIME_PATH),
    energyLevel: 'high',
    generationMetadata: {
      generatedAt: provenance?.generatedAt ?? selection.selectedAt,
      modelId: selectedPlanAsset?.modelId ?? 'music_v2',
      outputFormat: selectedPlanAsset?.outputFormat ?? 'mp3_48000_192',
      prompt: selectedPlanAsset?.prompt ?? '',
      songId: provenance?.songId ?? null,
    },
    looping: true,
    outputPath: TITLE_MUSIC_RUNTIME_PATH,
    runtimeAudioUrl: '/audio/music/football-js-title.mp3',
    transitionPurpose: 'menu-playlist',
  };
}

function createPlannedCatalogEntry(asset: AudioAssetPlan): MusicCatalogEntry {
  const provenance = readMusicProvenance(asset);
  return {
    assetId: asset.assetId,
    category: getCatalogCategory(asset) ?? 'menu',
    composerDisplay: getMetadataString(asset, 'composerDisplay', FOOTBALL_MUSIC_COMPOSER_DISPLAY),
    contentHash: getFileHash(asset.outputPath),
    displayTitle: getDisplayTitle(asset),
    durationSeconds: readAudioDurationSeconds(asset.outputPath),
    energyLevel: getMetadataString(asset, 'energyLevel', 'medium'),
    generationMetadata: {
      generatedAt: provenance?.generatedAt ?? null,
      modelId: asset.modelId,
      outputFormat: asset.outputFormat,
      prompt: asset.prompt ?? '',
      songId: provenance?.songId ?? null,
    },
    looping: asset.loop,
    outputPath: asset.outputPath,
    runtimeAudioUrl: publicPathToUrl(asset.outputPath),
    transitionPurpose: getMetadataString(asset, 'transitionPurpose', 'unspecified'),
  };
}

function validateMusicCatalog(
  catalog: readonly MusicCatalogEntry[],
  candidates: readonly MusicCandidateReportEntry[],
  selection: TitleMusicSelection | null,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const entry of catalog) {
    if (ids.has(entry.assetId)) {
      errors.push(`Duplicate music catalog ID: ${entry.assetId}`);
    }
    ids.add(entry.assetId);
    if (!entry.outputPath || !entry.runtimeAudioUrl) {
      errors.push(`${entry.assetId}: catalog entry requires outputPath and runtimeAudioUrl`);
    }
  }

  if (!selection) {
    errors.push('music catalog: missing selected title track manifest');
  }
  if (!catalog.some((entry) => entry.assetId === RUNTIME_TITLE_CATALOG_ID)) {
    errors.push('music catalog: missing stable football-js-title menu track');
  }
  if (catalog.filter((entry) => entry.category === 'menu').length < 4) {
    errors.push('music catalog: menu playlist must contain at least four tracks');
  }
  if (catalog.filter((entry) => entry.category === 'stinger').length !== 6) {
    errors.push('music catalog: transition stinger catalog must contain exactly six tracks');
  }
  if (catalog.filter((entry) => entry.category === 'chant').length !== 3) {
    errors.push('music catalog: stadium chant catalog must contain exactly three tracks');
  }
  for (const candidate of candidates) {
    if (candidate.exists && !candidate.provenanceExists) {
      errors.push(`${candidate.assetId}: provenance sidecar is missing`);
    }
  }

  return errors;
}

function validateCandidate(candidate: MusicCandidateReportEntry): string[] {
  if (!candidate.exists) {
    return [];
  }

  const errors: string[] = [];
  if (candidate.compressedBytes <= 0) {
    errors.push(`${candidate.assetId}: generated file is empty`);
  }
  if (candidate.decodable === false) {
    errors.push(`${candidate.assetId}: generated file is not decodable by ffprobe`);
  }
  if (candidate.durationStatus === 'outOfRange') {
    errors.push(`${candidate.assetId}: duration ${candidate.durationSeconds?.toFixed(2)}s is outside expected bounds`);
  }
  if (!candidate.stableFilename && candidate.catalogCategory !== null) {
    errors.push(`${candidate.assetId}: filename must match stable asset ID`);
  }
  if (candidate.catalogCategory !== null || candidate.selected) {
    for (const warning of candidate.longSilenceWarnings ?? []) {
      errors.push(`${candidate.assetId}: ${warning}`);
    }
  }
  return errors;
}

function getDurationStatus(
  asset: AudioAssetPlan,
  exists: boolean,
  durationSeconds: number | null,
): MusicCandidateReportEntry['durationStatus'] {
  if (!exists) {
    return 'missing';
  }
  if (durationSeconds === null) {
    return 'unknown';
  }

  const toleranceSeconds = asset.kind === 'music'
    ? Math.max(4, asset.requestedDurationSeconds * 0.1)
    : Math.max(1.5, asset.requestedDurationSeconds * 0.25);
  const lowerBound = asset.requestedDurationSeconds - toleranceSeconds;
  const upperBound = asset.requestedDurationSeconds + toleranceSeconds;
  return durationSeconds >= lowerBound && durationSeconds <= upperBound ? 'ok' : 'outOfRange';
}

function readMusicProvenance(asset: AudioAssetPlan): AudioProvenance | null {
  const path = resolveRepoPath(`${asset.outputPath}.json`);
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as AudioProvenance;
  } catch {
    return null;
  }
}

function readTitleMusicSelection(): TitleMusicSelection | null {
  const path = resolveRepoPath(TITLE_MUSIC_SELECTION_PATH);
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TitleMusicSelection;
  } catch {
    return null;
  }
}

function parseMusicReportCliOptions(args: readonly string[]): {
  force: boolean;
  selectAssetId: string | null;
  write: boolean;
} {
  const selectArg = args.find((arg) => arg.startsWith('--select='));
  return {
    force: args.includes('--force'),
    selectAssetId: selectArg ? selectArg.slice('--select='.length) : null,
    write: args.includes('--write'),
  };
}

function createMusicAuditionHtml(report: TitleMusicReport): string {
  const groups: Array<{ category: MusicCatalogCategory; heading: string }> = [
    { category: 'menu', heading: 'Menu Tracks' },
    { category: 'stinger', heading: 'Transition Stingers' },
    { category: 'chant', heading: 'Stadium Chants' },
  ];
  const errorHtml = report.validationErrors.length > 0
    ? `  <p class="errors">${report.validationErrors.length} verification issue(s) found. See music-report.json.</p>\n`
    : '';
  const sections = groups.map((group) => {
    const rows = report.catalog
      .filter((entry) => entry.category === group.category)
      .map((entry) => createCatalogCard(entry))
      .join('\n');
    return `<section><h2>${group.heading}</h2><div class="grid">${rows}</div></section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Football JS Music Pack Audition</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0f1419; color: #edf3f7; }
    body { margin: 0; padding: 32px; }
    h1 { margin: 0 0 8px; }
    h2 { margin-top: 30px; }
    .summary { color: #aeb9c2; margin-bottom: 24px; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
    .candidate { background: #17202a; border: 1px solid #334453; border-radius: 8px; padding: 16px; }
    .candidate h3 { font-size: 18px; margin: 0 0 8px; }
    .candidate h3 span { color: #ffd35a; font-size: 13px; margin-left: 8px; text-transform: uppercase; }
    audio { width: 100%; margin: 10px 0; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; font-size: 13px; }
    dt { color: #9fb3c1; }
    dd { margin: 0; overflow-wrap: anywhere; }
    details p { color: #c8d2da; font-size: 13px; line-height: 1.45; }
    .missing { color: #f0a8a8; padding: 12px 0; }
    .errors { color: #f0a8a8; }
  </style>
</head>
<body>
  <h1>Football JS Music Pack Audition</h1>
  <p class="summary">${report.generatedCount} / ${report.assetCount} planned generation assets exist. Catalog compressed size: ${formatBytes(report.totalCompressedBytes)}.</p>
${errorHtml}  ${sections}
</body>
</html>
`;
}

function createCatalogCard(entry: MusicCatalogEntry): string {
  const exists = existsSync(resolveRepoPath(entry.outputPath));
  const audioSource = exists ? entry.runtimeAudioUrl : '';
  return [
    '<article class="candidate">',
    `<h3>${escapeHtml(entry.displayTitle)}${entry.assetId === RUNTIME_TITLE_CATALOG_ID ? ' <span>Selected</span>' : ''}</h3>`,
    exists
      ? `<audio controls preload="metadata" src="${escapeHtml(audioSource)}"></audio>`
      : '<div class="missing">Missing audio</div>',
    '<dl>',
    `<dt>Asset ID</dt><dd>${escapeHtml(entry.assetId)}</dd>`,
    `<dt>Category</dt><dd>${escapeHtml(entry.category)}</dd>`,
    `<dt>Duration</dt><dd>${entry.durationSeconds?.toFixed(2) ?? 'missing'}s</dd>`,
    `<dt>Looping</dt><dd>${entry.looping ? 'yes' : 'no'}</dd>`,
    `<dt>File size</dt><dd>${formatBytes(exists ? statSync(resolveRepoPath(entry.outputPath)).size : 0)}</dd>`,
    `<dt>Energy</dt><dd>${escapeHtml(entry.energyLevel)}</dd>`,
    `<dt>Purpose</dt><dd>${escapeHtml(entry.transitionPurpose)}</dd>`,
    `<dt>Model</dt><dd>${escapeHtml(entry.generationMetadata.modelId)}</dd>`,
    `<dt>Format</dt><dd>${escapeHtml(entry.generationMetadata.outputFormat)}</dd>`,
    `<dt>Song ID</dt><dd>${escapeHtml(entry.generationMetadata.songId ?? 'not returned')}</dd>`,
    `<dt>Hash</dt><dd>${escapeHtml(entry.contentHash ?? 'missing')}</dd>`,
    `<dt>Generated</dt><dd>${escapeHtml(entry.generationMetadata.generatedAt ?? 'missing')}</dd>`,
    '</dl>',
    `<details><summary>Prompt</summary><p>${escapeHtml(entry.generationMetadata.prompt)}</p></details>`,
    '</article>',
  ].join('');
}

function detectLongSilence(relativePath: string): readonly string[] | null {
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      resolveRepoPath(relativePath),
      '-af',
      'silencedetect=noise=-48dB:d=3',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );

  if (result.error) {
    return null;
  }

  return parseSilenceWarnings(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
}

function parseSilenceWarnings(output: string): readonly string[] {
  const matches = Array.from(output.matchAll(/silence_duration:\s*([0-9.]+)/g));
  return matches
    .map((match) => Number(match[1]))
    .filter((duration) => Number.isFinite(duration) && duration >= 3)
    .map((duration) => `long silence detected (${duration.toFixed(2)}s)`);
}

function getCatalogCategory(asset: AudioAssetPlan): MusicCatalogCategory | null {
  const category = asset.metadata?.catalogCategory;
  return category === 'menu' || category === 'stinger' || category === 'chant' ? category : null;
}

function getDisplayTitle(asset: AudioAssetPlan): string {
  return getMetadataString(asset, 'displayTitle', asset.assetId);
}

function getMetadataString(asset: AudioAssetPlan, key: string, fallback: string): string {
  const value = asset.metadata?.[key];
  return typeof value === 'string' ? value : fallback;
}

function publicPathToUrl(path: string): string {
  return path.replace(/^public\//, '/');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
