import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import {
  isDirectCli,
  resolveRepoPath,
  toRepoRelativePath,
  validateAudioPlan,
  type AudioAssetPlan,
} from './schemas';

export interface FootballAudioAssetReportEntry {
  assetId: string;
  category: AudioAssetPlan['category'];
  compressedBytes: number;
  decodedMemoryBytes: number | null;
  durationSeconds: number | null;
  exists: boolean;
  kind: AudioAssetPlan['kind'];
  loop: boolean;
  outputPath: string;
  provenanceExists: boolean;
  provenancePath: string;
  requestedDurationSeconds: number;
  runtimeLoadingStrategy: AudioAssetPlan['runtimeLoadingStrategy'];
  spokenWordCheck: 'notDetectable' | 'promptForbidsSpeech';
  underBudget: boolean;
}

export interface FootballAudioPackReport {
  assetCount: number;
  assets: FootballAudioAssetReportEntry[];
  generatedAt: string;
  generatedCount: number;
  targetCompressedBytes: number;
  totalCompressedBytes: number;
  underTarget: boolean;
  validationErrors: string[];
}

const STARTER_PACK_TARGET_BYTES = 5 * 1024 * 1024;
const PCM_BYTES_PER_SAMPLE = Float32Array.BYTES_PER_ELEMENT;
const ESTIMATED_DECODED_CHANNELS = 2;
const OUTPUT_SAMPLE_RATE = 44_100;
const REPORT_PATH = 'public/audio/football-sfx-pack-report.json';
const AUDITION_INDEX_PATH = 'public/audio/audition-index.html';

export function createFootballAudioReport(
  plan: readonly AudioAssetPlan[] = FOOTBALL_AUDIO_PLAN,
  generatedAt = new Date().toISOString(),
): FootballAudioPackReport {
  const assets = plan.map((asset) => {
    const absoluteOutputPath = resolveRepoPath(asset.outputPath);
    const exists = existsSync(absoluteOutputPath);
    const durationSeconds = exists ? readAudioDurationSeconds(absoluteOutputPath) : null;
    const compressedBytes = exists ? statSync(absoluteOutputPath).size : 0;
    const provenancePath = `${asset.outputPath}.json`;
    const decodedMemoryBytes =
      exists && asset.runtimeLoadingStrategy === 'buffer'
        ? estimateDecodedMemoryBytes(durationSeconds ?? asset.requestedDurationSeconds)
        : null;

    return {
      assetId: asset.assetId,
      category: asset.category,
      compressedBytes,
      decodedMemoryBytes,
      durationSeconds,
      exists,
      kind: asset.kind,
      loop: asset.loop,
      outputPath: asset.outputPath,
      provenanceExists: existsSync(resolveRepoPath(provenancePath)),
      provenancePath,
      requestedDurationSeconds: asset.requestedDurationSeconds,
      runtimeLoadingStrategy: asset.runtimeLoadingStrategy,
      spokenWordCheck: promptForbidsSpeech(asset) ? 'promptForbidsSpeech' : 'notDetectable',
      underBudget: compressedBytes <= asset.maxBytes,
    } satisfies FootballAudioAssetReportEntry;
  });

  return {
    assetCount: plan.length,
    assets,
    generatedAt,
    generatedCount: assets.filter((asset) => asset.exists).length,
    targetCompressedBytes: STARTER_PACK_TARGET_BYTES,
    totalCompressedBytes: assets.reduce((sum, asset) => sum + asset.compressedBytes, 0),
    underTarget:
      assets.reduce((sum, asset) => sum + asset.compressedBytes, 0) <= STARTER_PACK_TARGET_BYTES,
    validationErrors: validateAudioPlan(plan),
  };
}

export function writeFootballAudioReportFiles(
  report: FootballAudioPackReport = createFootballAudioReport(),
): { auditionIndexPath: string; reportPath: string } {
  const reportPath = resolveRepoPath(REPORT_PATH);
  const auditionIndexPath = resolveRepoPath(AUDITION_INDEX_PATH);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(auditionIndexPath, createAuditionIndexHtml(report), 'utf8');

  return {
    auditionIndexPath: toRepoRelativePath(auditionIndexPath),
    reportPath: toRepoRelativePath(reportPath),
  };
}

if (isDirectCli(import.meta.url)) {
  const report = createFootballAudioReport();

  if (process.argv.includes('--write')) {
    const written = writeFootballAudioReportFiles(report);
    console.log(JSON.stringify({ ...written, report }, null, 2));
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

function readAudioDurationSeconds(absoluteOutputPath: string): number | null {
  try {
    const output = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        absoluteOutputPath,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const duration = Number(output);
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

function estimateDecodedMemoryBytes(durationSeconds: number): number {
  return Math.ceil(
    durationSeconds * OUTPUT_SAMPLE_RATE * ESTIMATED_DECODED_CHANNELS * PCM_BYTES_PER_SAMPLE,
  );
}

function promptForbidsSpeech(asset: AudioAssetPlan): boolean {
  const text = `${asset.prompt ?? ''} ${asset.script ?? ''}`.toLowerCase();
  return text.includes('no speech') || text.includes('no voice') || text.includes('no intelligible');
}

function createAuditionIndexHtml(report: FootballAudioPackReport): string {
  const rows = report.assets.map((asset) => {
    const audioSource = asset.exists ? publicPathToUrl(asset.outputPath) : '';
    const duration = asset.durationSeconds?.toFixed(2) ?? 'missing';
    const decoded = asset.decodedMemoryBytes === null
      ? 'streamed'
      : formatBytes(asset.decodedMemoryBytes);

    return [
      '<tr>',
      `<td>${escapeHtml(asset.assetId)}</td>`,
      `<td>${escapeHtml(asset.category)}</td>`,
      `<td>${escapeHtml(asset.kind)}</td>`,
      `<td>${escapeHtml(asset.runtimeLoadingStrategy)}</td>`,
      `<td>${duration}s</td>`,
      `<td>${formatBytes(asset.compressedBytes)}</td>`,
      `<td>${decoded}</td>`,
      `<td>${asset.exists ? `<audio controls src="${escapeHtml(audioSource)}"></audio>` : 'missing'}</td>`,
      '</tr>',
    ].join('');
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Football SFX Audition Index</title>
  <style>
    body { background: #101920; color: #e8eef2; font: 14px/1.45 system-ui, sans-serif; margin: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #33424c; padding: 8px; text-align: left; vertical-align: middle; }
    th { color: #9ec7db; }
    audio { width: 260px; }
  </style>
</head>
<body>
  <h1>Football SFX Audition Index</h1>
  <p>Total compressed size: ${formatBytes(report.totalCompressedBytes)} / ${formatBytes(report.targetCompressedBytes)}</p>
  <table>
    <thead>
      <tr>
        <th>Asset</th>
        <th>Category</th>
        <th>Kind</th>
        <th>Loading</th>
        <th>Duration</th>
        <th>Compressed</th>
        <th>Decoded Estimate</th>
        <th>Audition</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
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
    .replaceAll('"', '&quot;');
}
