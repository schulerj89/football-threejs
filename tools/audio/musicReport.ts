import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FOOTBALL_TITLE_MUSIC_PLAN } from './musicPlan';
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
  compressedBytes: number;
  contentHash: string | null;
  durationSeconds: number | null;
  exists: boolean;
  generationPrompt: string;
  generationTimestamp: string | null;
  modelId: string;
  outputFormat: string;
  outputPath: string;
  provenanceExists: boolean;
  provenancePath: string;
  requestedDurationSeconds: number;
  selected: boolean;
  songId: string | null;
}

export interface TitleMusicReport {
  assetCount: number;
  auditionPath: string;
  candidates: MusicCandidateReportEntry[];
  generatedCount: number;
  generatedAt: string;
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
export const TITLE_MUSIC_SELECTION_PATH = 'public/audio/music/music-selection.json';
export const TITLE_MUSIC_RUNTIME_PATH = 'public/audio/music/football-js-title.mp3';

export function createTitleMusicReport(
  plan: readonly AudioAssetPlan[] = FOOTBALL_TITLE_MUSIC_PLAN,
  generatedAt = new Date().toISOString(),
): TitleMusicReport {
  const selection = readTitleMusicSelection();
  const candidates = plan.map((asset) => {
    const exists = existsSync(resolveRepoPath(asset.outputPath));
    const provenance = readMusicProvenance(asset);
    return {
      assetId: asset.assetId,
      candidateDescription: asset.notes ?? '',
      compressedBytes: exists ? statSync(resolveRepoPath(asset.outputPath)).size : 0,
      contentHash: exists ? getFileHash(asset.outputPath) : null,
      durationSeconds: exists ? readAudioDurationSeconds(asset.outputPath) : null,
      exists,
      generationPrompt: asset.prompt ?? '',
      generationTimestamp: provenance?.generatedAt ?? null,
      modelId: asset.modelId,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      provenanceExists: existsSync(resolveRepoPath(`${asset.outputPath}.json`)),
      provenancePath: `${asset.outputPath}.json`,
      requestedDurationSeconds: asset.requestedDurationSeconds,
      selected: selection?.assetId === asset.assetId,
      songId: provenance?.songId ?? null,
    } satisfies MusicCandidateReportEntry;
  });

  return {
    assetCount: plan.length,
    auditionPath: TITLE_MUSIC_AUDITION_PATH,
    candidates,
    generatedAt,
    generatedCount: candidates.filter((candidate) => candidate.exists).length,
    reportPath: TITLE_MUSIC_REPORT_PATH,
    selection,
    selectionPath: TITLE_MUSIC_SELECTION_PATH,
    totalCompressedBytes: candidates.reduce((sum, candidate) => sum + candidate.compressedBytes, 0),
    validationErrors: validateAudioPlan(plan),
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
): { auditionPath: string; reportPath: string } {
  const reportPath = resolveRepoPath(TITLE_MUSIC_REPORT_PATH);
  const auditionPath = resolveRepoPath(TITLE_MUSIC_AUDITION_PATH);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(auditionPath, createMusicAuditionHtml(report), 'utf8');

  return {
    auditionPath: toRepoRelativePath(auditionPath),
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
  const rows = report.candidates.map((candidate) => {
    const audioSource = candidate.exists ? publicPathToUrl(candidate.outputPath) : '';
    return [
      '<article class="candidate">',
      `<h2>${escapeHtml(candidate.assetId)}${candidate.selected ? ' <span>Selected</span>' : ''}</h2>`,
      `<p>${escapeHtml(candidate.candidateDescription)}</p>`,
      candidate.exists
        ? `<audio controls preload="metadata" src="${escapeHtml(audioSource)}"></audio>`
        : '<div class="missing">Missing audio</div>',
      '<dl>',
      `<dt>Duration</dt><dd>${candidate.durationSeconds?.toFixed(2) ?? 'missing'}s</dd>`,
      `<dt>Requested</dt><dd>${candidate.requestedDurationSeconds}s</dd>`,
      `<dt>File size</dt><dd>${formatBytes(candidate.compressedBytes)}</dd>`,
      `<dt>Model</dt><dd>${escapeHtml(candidate.modelId)}</dd>`,
      `<dt>Format</dt><dd>${escapeHtml(candidate.outputFormat)}</dd>`,
      `<dt>Song ID</dt><dd>${escapeHtml(candidate.songId ?? 'not returned')}</dd>`,
      `<dt>Hash</dt><dd>${escapeHtml(candidate.contentHash ?? 'missing')}</dd>`,
      `<dt>Generated</dt><dd>${escapeHtml(candidate.generationTimestamp ?? 'missing')}</dd>`,
      '</dl>',
      `<details><summary>Prompt</summary><p>${escapeHtml(candidate.generationPrompt)}</p></details>`,
      '</article>',
    ].join('');
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Football JS Title Music Audition</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0f1419; color: #edf3f7; }
    body { margin: 0; padding: 32px; }
    h1 { margin: 0 0 8px; }
    .summary { color: #aeb9c2; margin-bottom: 24px; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
    .candidate { background: #17202a; border: 1px solid #334453; border-radius: 8px; padding: 16px; }
    h2 { font-size: 18px; margin: 0 0 8px; }
    h2 span { color: #ffd35a; font-size: 13px; margin-left: 8px; text-transform: uppercase; }
    audio { width: 100%; margin: 10px 0; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; font-size: 13px; }
    dt { color: #9fb3c1; }
    dd { margin: 0; overflow-wrap: anywhere; }
    details p { color: #c8d2da; font-size: 13px; line-height: 1.45; }
    .missing { color: #f0a8a8; padding: 12px 0; }
  </style>
</head>
<body>
  <h1>Football JS Title Music Audition</h1>
  <p class="summary">${report.generatedCount} / ${report.assetCount} generated. Total compressed size: ${formatBytes(report.totalCompressedBytes)}.</p>
  <main class="grid">
${rows}
  </main>
</body>
</html>
`;
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
