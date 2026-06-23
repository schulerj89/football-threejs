import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import {
  DEFAULT_MAX_DECODED_AUDIO_BUFFER_BYTES,
} from '../../src/audio/AudioAssetLoader';
import {
  LOCAL_AUDIO_ASSET_MANIFEST,
  type LocalAudioAsset,
} from '../../src/audio/AudioAssetManifest';
import { isLocalPregameCommentaryAssetId } from '../../src/audio/PregameLocalAudioAssets';
import { COMMENTARY_CATALOG } from '../../src/audio/CommentaryCatalog';
import {
  ANNOUNCER_SCRIPT_CATALOG,
  ANNOUNCER_VOICE_ID_PLACEHOLDER,
} from './announcerScriptCatalog';
import { readConfiguredAnnouncerVoiceId } from './announcerVoice';
import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import { createFootballAudioReport } from './audioReport';
import { FOOTBALL_STADIUM_CHANT_PLAN } from './musicPlan';
import { createPregameSpeechPlan } from './pregameScriptCatalog';
import {
  isDirectCli,
  readAudioDurationSeconds,
  resolveRepoPath,
  toRepoRelativePath,
  validateAudioPlan,
  type AudioAssetPlan,
  type AudioProvenance,
} from './schemas';

export type AudioRuntimeReadiness = 'complete' | 'partial' | 'unavailable';

export interface AudioVerificationEntry {
  assetId: string;
  caption: string | null;
  category: AudioAssetPlan['category'];
  compressedBytes: number;
  decodable: boolean;
  durationSeconds: number | null;
  durationWithinBounds: boolean;
  exists: boolean;
  expectedPath: string;
  issues: string[];
  manifestUrl: string | null;
  provenanceExists: boolean;
  requestedDurationSeconds: number;
  sidecarPath: string;
}

export interface AudioReadinessManifest {
  availableAssetIds: string[];
  auditionIndexPath: string;
  failedAssetIds: string[];
  generatedAt: string;
  knownMissingOptionalAssetIds: string[];
  readiness: AudioRuntimeReadiness;
  reportPath: string;
  requiredAssetCount: number;
  totalCompressedBytes: number;
}

export interface AudioVerificationReport {
  assetCount: number;
  assets: AudioVerificationEntry[];
  auditionIndexPath: string;
  captionErrors: string[];
  compressedBudgetBytes: number;
  decodedBufferBudgetBytes: number;
  generatedAt: string;
  largestDecodedBufferBytes: number;
  missingAssetIds: string[];
  planValidationErrors: string[];
  readiness: AudioRuntimeReadiness;
  readinessPath: string;
  reportPath: string;
  runtimeManifestErrors: string[];
  totalBufferedDecodedMemoryBytes: number;
  totalCompressedBytes: number;
}

const COMPRESSED_STARTER_PACK_BUDGET_BYTES = 5 * 1024 * 1024;
const REPORT_PATH = 'public/audio/audio-verification-report.json';
const READINESS_PATH = 'public/audio/audio-readiness.json';
const AUDITION_INDEX_PATH = 'public/audio/audition-index.html';

export function createAudioVerificationPlan(): readonly AudioAssetPlan[] {
  const localPregamePlan = createPregameSpeechPlan(
    readConfiguredAnnouncerVoiceId() ?? ANNOUNCER_VOICE_ID_PLACEHOLDER,
  ).filter((asset) => isLocalPregameCommentaryAssetId(asset.assetId));

  return [
    ...FOOTBALL_AUDIO_PLAN,
    ...FOOTBALL_STADIUM_CHANT_PLAN,
    ...localPregamePlan,
  ];
}

export function createAudioVerificationReport(
  plan: readonly AudioAssetPlan[] = createAudioVerificationPlan(),
  manifest: readonly LocalAudioAsset[] = LOCAL_AUDIO_ASSET_MANIFEST,
  generatedAt = new Date().toISOString(),
): AudioVerificationReport {
  const planValidationErrors = validateAudioPlan(plan);
  const runtimeAssets = manifest.filter(
    (asset) => !asset.assetId.startsWith('runtime-test-') && asset.category !== 'music',
  );
  const manifestByAssetId = new Map(runtimeAssets.map((asset) => [asset.assetId, asset]));
  const planByAssetId = new Map(plan.map((asset) => [asset.assetId, asset]));
  const runtimeManifestErrors = validateRuntimeManifest(plan, runtimeAssets);
  const captionErrors = validateCaptionManifest(plan);
  const report = createFootballAudioReport(plan, generatedAt);
  const entries = plan.map((asset) =>
    createVerificationEntry(asset, manifestByAssetId.get(asset.assetId) ?? null),
  );
  for (const asset of runtimeAssets) {
    if (!planByAssetId.has(asset.assetId)) {
      runtimeManifestErrors.push(`${asset.assetId}: runtime manifest asset is not in the production plan`);
    }
  }
  const missingAssetIds = entries
    .filter((entry) => !entry.exists)
    .map((entry) => entry.assetId);
  const failedAssetIds = entries
    .filter((entry) => entry.issues.length > 0)
    .map((entry) => entry.assetId);
  const allErrors = [
    ...planValidationErrors,
    ...runtimeManifestErrors,
    ...captionErrors,
    ...entries.flatMap((entry) => entry.issues.map((issue) => `${entry.assetId}: ${issue}`)),
  ];
  const readiness = classifyReadiness({
    assetCount: plan.length,
    errorCount: allErrors.length,
    generatedCount: entries.filter((entry) => entry.exists).length,
  });

  return {
    assetCount: plan.length,
    assets: entries,
    auditionIndexPath: AUDITION_INDEX_PATH,
    captionErrors,
    compressedBudgetBytes: COMPRESSED_STARTER_PACK_BUDGET_BYTES,
    decodedBufferBudgetBytes: DEFAULT_MAX_DECODED_AUDIO_BUFFER_BYTES,
    generatedAt,
    largestDecodedBufferBytes: report.largestDecodedBufferBytes,
    missingAssetIds,
    planValidationErrors,
    readiness,
    readinessPath: READINESS_PATH,
    reportPath: REPORT_PATH,
    runtimeManifestErrors,
    totalBufferedDecodedMemoryBytes: report.totalBufferedDecodedMemoryBytes,
    totalCompressedBytes: report.totalCompressedBytes,
  };
}

export function writeAudioVerificationArtifacts(
  verificationReport: AudioVerificationReport = createAudioVerificationReport(),
): {
  auditionIndexPath: string;
  readinessPath: string;
  reportPath: string;
} {
  const reportPath = resolveRepoPath(REPORT_PATH);
  const readinessPath = resolveRepoPath(READINESS_PATH);
  const auditionIndexPath = resolveRepoPath(AUDITION_INDEX_PATH);
  mkdirSync(dirname(reportPath), { recursive: true });

  const failedAssetIds = verificationReport.assets
    .filter((entry) => entry.issues.length > 0)
    .map((entry) => entry.assetId);
  const readiness: AudioReadinessManifest = {
    availableAssetIds: verificationReport.assets
      .filter((entry) => entry.exists && entry.issues.length === 0)
      .map((entry) => entry.assetId)
      .sort(),
    auditionIndexPath: AUDITION_INDEX_PATH,
    failedAssetIds,
    generatedAt: verificationReport.generatedAt,
    knownMissingOptionalAssetIds: verificationReport.missingAssetIds,
    readiness: verificationReport.readiness,
    reportPath: REPORT_PATH,
    requiredAssetCount: verificationReport.assetCount,
    totalCompressedBytes: verificationReport.totalCompressedBytes,
  };

  writeFileSync(reportPath, `${JSON.stringify(verificationReport, null, 2)}\n`, 'utf8');
  writeFileSync(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, 'utf8');
  writeFileSync(auditionIndexPath, createAuditionIndexHtml(verificationReport), 'utf8');

  return {
    auditionIndexPath: toRepoRelativePath(auditionIndexPath),
    readinessPath: toRepoRelativePath(readinessPath),
    reportPath: toRepoRelativePath(reportPath),
  };
}

if (isDirectCli(import.meta.url)) {
  const report = createAudioVerificationReport();
  const written = writeAudioVerificationArtifacts(report);

  console.log(JSON.stringify({ ...written, readiness: report.readiness, report }, null, 2));

  if (report.readiness !== 'complete') {
    process.exitCode = 1;
  }
}

function createVerificationEntry(
  asset: AudioAssetPlan,
  runtimeAsset: LocalAudioAsset | null,
): AudioVerificationEntry {
  const outputPath = resolveRepoPath(asset.outputPath);
  const exists = existsSync(outputPath);
  const sidecarPath = `${asset.outputPath}.json`;
  const absoluteSidecarPath = resolveRepoPath(sidecarPath);
  const provenanceExists = existsSync(absoluteSidecarPath);
  const durationSeconds = exists ? readAudioDurationSeconds(asset.outputPath) : null;
  const compressedBytes = exists ? statSync(outputPath).size : 0;
  const issues: string[] = [];

  if (!runtimeAsset) {
    issues.push('missing from runtime manifest');
  } else if (`public${runtimeAsset.url}` !== asset.outputPath) {
    issues.push(
      `runtime manifest URL ${runtimeAsset.url} does not match ${asset.outputPath}`,
    );
  }
  if (!exists) {
    issues.push('missing audio file');
  } else if (compressedBytes <= 0) {
    issues.push('audio file is empty');
  }
  if (compressedBytes > asset.maxBytes) {
    issues.push(`compressed file exceeds asset budget ${asset.maxBytes} bytes`);
  }
  if (!durationSeconds || durationSeconds <= 0) {
    issues.push('audio file is not decodable or has no duration');
  } else if (!isDurationWithinBounds(asset, durationSeconds)) {
    const bounds = getDurationBounds(asset);
    issues.push(
      `duration ${durationSeconds.toFixed(2)}s is outside ${bounds.minimum.toFixed(2)}-${bounds.maximum.toFixed(2)}s`,
    );
  }
  if (!provenanceExists) {
    issues.push('missing provenance sidecar');
  } else {
    issues.push(...validateProvenance(asset, absoluteSidecarPath, exists ? outputPath : null));
  }

  return {
    assetId: asset.assetId,
    caption: asset.caption ?? null,
    category: asset.category,
    compressedBytes,
    decodable: durationSeconds !== null && durationSeconds > 0,
    durationSeconds,
    durationWithinBounds:
      durationSeconds !== null && isDurationWithinBounds(asset, durationSeconds),
    exists,
    expectedPath: asset.outputPath,
    issues,
    manifestUrl: runtimeAsset?.url ?? null,
    provenanceExists,
    requestedDurationSeconds: asset.requestedDurationSeconds,
    sidecarPath,
  };
}

function validateRuntimeManifest(
  plan: readonly AudioAssetPlan[],
  runtimeAssets: readonly LocalAudioAsset[],
): string[] {
  const errors: string[] = [];
  const manifestByAssetId = new Map(runtimeAssets.map((asset) => [asset.assetId, asset]));

  for (const asset of plan) {
    const runtimeAsset = manifestByAssetId.get(asset.assetId);

    if (!runtimeAsset) {
      errors.push(`${asset.assetId}: missing from runtime manifest`);
      continue;
    }
    if (`public${runtimeAsset.url}` !== asset.outputPath) {
      errors.push(`${asset.assetId}: runtime manifest URL does not match output path`);
    }
  }

  return errors;
}

function validateCaptionManifest(plan: readonly AudioAssetPlan[]): string[] {
  const captionPath = resolveRepoPath('public/audio/announcer/announcer-captions.json');
  const errors: string[] = [];

  if (!existsSync(captionPath)) {
    return ['announcer-captions.json is missing'];
  }

  let manifest: {
    scripts?: Array<{
      caption?: string;
      outputPath?: string;
      script?: string;
      scriptId?: string;
      voiceId?: string;
    }>;
  };

  try {
    manifest = JSON.parse(readFileSync(captionPath, 'utf8')) as typeof manifest;
  } catch (error) {
    return [
      `announcer-captions.json is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    ];
  }

  const captionsByScriptId = new Map(
    (manifest.scripts ?? []).map((entry) => [entry.scriptId, entry]),
  );

  for (const script of ANNOUNCER_SCRIPT_CATALOG) {
    const entry = captionsByScriptId.get(script.scriptId);
    const plannedAsset = plan.find((asset) => asset.assetId === script.scriptId);

    if (!entry) {
      errors.push(`${script.scriptId}: missing caption entry`);
      continue;
    }
    if (entry.caption !== script.caption || entry.script !== script.script) {
      errors.push(`${script.scriptId}: caption manifest text does not match script catalog`);
    }
    if (entry.outputPath !== plannedAsset?.outputPath) {
      errors.push(`${script.scriptId}: caption manifest output path does not match plan`);
    }
  }

  for (const clip of COMMENTARY_CATALOG) {
    const entry = captionsByScriptId.get(clip.scriptId);

    if (!entry) {
      errors.push(`${clip.scriptId}: missing commentary caption entry`);
    } else if (entry.caption !== clip.caption) {
      errors.push(`${clip.scriptId}: caption manifest text does not match runtime commentary catalog`);
    }
  }

  return errors;
}

function validateProvenance(
  asset: AudioAssetPlan,
  absoluteSidecarPath: string,
  absoluteOutputPath: string | null,
): string[] {
  const errors: string[] = [];
  let sidecar: Partial<AudioProvenance>;

  try {
    sidecar = JSON.parse(readFileSync(absoluteSidecarPath, 'utf8')) as Partial<AudioProvenance>;
  } catch (error) {
    return [
      `provenance sidecar is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    ];
  }

  const expectedFields: Array<keyof AudioAssetPlan & keyof AudioProvenance> = [
    'assetId',
    'category',
    'kind',
    'modelId',
    'outputFormat',
    'runtimeLoadingStrategy',
  ];

  for (const field of expectedFields) {
    if (sidecar[field] !== asset[field]) {
      errors.push(`provenance ${field} does not match plan`);
    }
  }
  if (
    sidecar.requestedDurationSeconds !== undefined
    && (
      typeof sidecar.requestedDurationSeconds !== 'number'
      || !Number.isFinite(sidecar.requestedDurationSeconds)
      || sidecar.requestedDurationSeconds <= 0
    )
  ) {
    errors.push('provenance requestedDurationSeconds is invalid');
  }
  if ((sidecar.prompt ?? undefined) !== asset.prompt) {
    errors.push('provenance prompt does not match plan');
  }
  if ((sidecar.script ?? undefined) !== asset.script) {
    errors.push('provenance script does not match plan');
  }
  if ((sidecar.caption ?? undefined) !== asset.caption) {
    errors.push('provenance caption does not match plan');
  }
  if ((sidecar.scriptId ?? undefined) !== asset.scriptId) {
    errors.push('provenance scriptId does not match plan');
  }
  if ((sidecar.voiceId ?? undefined) !== asset.voiceId) {
    errors.push('provenance voiceId does not match plan');
  }

  if (absoluteOutputPath) {
    const content = readFileSync(absoluteOutputPath);
    const contentHash = createHash('sha256').update(content).digest('hex');

    if (sidecar.contentHash !== contentHash) {
      errors.push('provenance content hash does not match audio file');
    }
    if (sidecar.compressedBytes !== content.byteLength) {
      errors.push('provenance compressed byte count does not match audio file');
    }
  }

  return errors;
}

function classifyReadiness(options: {
  assetCount: number;
  errorCount: number;
  generatedCount: number;
}): AudioRuntimeReadiness {
  if (options.generatedCount === 0) {
    return 'unavailable';
  }

  if (options.generatedCount < options.assetCount || options.errorCount > 0) {
    return 'partial';
  }

  return 'complete';
}

function isDurationWithinBounds(asset: AudioAssetPlan, durationSeconds: number): boolean {
  const bounds = getDurationBounds(asset);
  return durationSeconds >= bounds.minimum && durationSeconds <= bounds.maximum;
}

function getDurationBounds(asset: AudioAssetPlan): { maximum: number; minimum: number } {
  const tolerance = asset.kind === 'loop'
    ? 1.25
    : asset.kind === 'speech'
      ? Math.max(0.85, asset.requestedDurationSeconds * 0.35)
      : Math.max(0.45, asset.requestedDurationSeconds * 0.35);

  return {
    maximum: asset.requestedDurationSeconds + tolerance,
    minimum: Math.max(0.05, asset.requestedDurationSeconds - tolerance),
  };
}

function createAuditionIndexHtml(report: AudioVerificationReport): string {
  const rows = report.assets.map((asset) => {
    const sidecar = readSidecar(asset.sidecarPath);
    const categoryLabel = asset.category === 'sfx' ? 'gameplay effects' : asset.category;
    const duration = asset.durationSeconds === null
      ? 'missing'
      : `${asset.durationSeconds.toFixed(2)}s`;
    const source = asset.exists ? publicPathToRelativeUrl(asset.expectedPath, AUDITION_INDEX_PATH) : '';
    const caption = asset.caption ?? sidecar?.prompt ?? '';
    const metadata = [
      sidecar?.generatedAt ? `generated ${sidecar.generatedAt}` : 'metadata missing',
      sidecar?.modelId ? `model ${sidecar.modelId}` : '',
      sidecar?.voiceId ? `voice ${sidecar.voiceId}` : '',
    ].filter(Boolean).join('; ');

    return [
      '<tr>',
      `<td>${escapeHtml(asset.assetId)}</td>`,
      `<td>${escapeHtml(categoryLabel)}</td>`,
      `<td>${escapeHtml(caption)}</td>`,
      `<td>${duration}</td>`,
      `<td>${formatBytes(asset.compressedBytes)}</td>`,
      `<td>${escapeHtml(metadata)}</td>`,
      `<td>${asset.exists ? `<audio controls preload="metadata" src="${escapeHtml(source)}"></audio>` : 'missing'}</td>`,
      `<td>${escapeHtml(asset.issues.join('; ') || 'ok')}</td>`,
      '</tr>',
    ].join('');
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Football Audio Audition Index</title>
  <style>
    body { background: #101920; color: #e8eef2; font: 14px/1.45 system-ui, sans-serif; margin: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #33424c; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #9ec7db; }
    audio { width: 260px; }
    .meta { color: #aab8c2; }
    .toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
    button { background: #20313c; border: 1px solid #527083; border-radius: 6px; color: #e8eef2; cursor: pointer; font: inherit; padding: 8px 12px; }
    button:hover, button:focus-visible { background: #2a4050; outline: 2px solid #9ec7db; outline-offset: 2px; }
    .count { color: #aab8c2; }
  </style>
</head>
<body>
  <h1>Football Audio Audition Index</h1>
  <p class="meta">Readiness: ${escapeHtml(report.readiness)}. Total compressed size: ${formatBytes(report.totalCompressedBytes)} / ${formatBytes(report.compressedBudgetBytes)}.</p>
  <div class="toolbar">
    <button type="button" data-play-all>Play all</button>
    <button type="button" data-stop-all>Stop</button>
    <span class="count">${report.assets.filter((asset) => asset.exists).length} available clips</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Asset</th>
        <th>Category</th>
        <th>Caption / Prompt</th>
        <th>Duration</th>
        <th>Size</th>
        <th>Metadata</th>
        <th>Audition</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <script>
    const audios = Array.from(document.querySelectorAll('audio'));
    let playAllToken = 0;

    async function playAll() {
      const token = ++playAllToken;
      for (const audio of audios) {
        if (token !== playAllToken) {
          return;
        }
        audio.currentTime = 0;
        try {
          await audio.play();
          await new Promise((resolve) => {
            const done = () => {
              audio.removeEventListener('ended', done);
              audio.removeEventListener('error', done);
              resolve();
            };
            audio.addEventListener('ended', done);
            audio.addEventListener('error', done);
          });
        } catch {
          return;
        }
      }
    }

    function stopAll() {
      playAllToken += 1;
      for (const audio of audios) {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    document.querySelector('[data-play-all]')?.addEventListener('click', playAll);
    document.querySelector('[data-stop-all]')?.addEventListener('click', stopAll);
  </script>
</body>
</html>
`;
}

function readSidecar(sidecarPath: string): Partial<AudioProvenance> | null {
  const absoluteSidecarPath = resolveRepoPath(sidecarPath);

  if (!existsSync(absoluteSidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(absoluteSidecarPath, 'utf8')) as Partial<AudioProvenance>;
  } catch {
    return null;
  }
}

function publicPathToRelativeUrl(assetPath: string, pagePath: string): string {
  const pageDirectory = dirname(stripPublicPrefix(pagePath));
  const asset = stripPublicPrefix(assetPath);
  const relativePath = relative(pageDirectory, asset).replaceAll('\\', '/');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function stripPublicPrefix(path: string): string {
  return path.replaceAll('\\', '/').replace(/^public\//, '');
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
