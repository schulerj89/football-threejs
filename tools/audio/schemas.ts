import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export type AudioAssetCategory = 'announcer' | 'crowd' | 'music' | 'sfx';
export type AudioAssetKind = 'loop' | 'music' | 'oneShot' | 'positional' | 'speech';
export type AudioGenerationStatus = 'approved' | 'generated' | 'needsReview' | 'planned';
export type AudioOutputFormat = 'mp3_44100_128' | 'mp3_44100_64' | 'mp3_48000_192' | 'opus_48000_128';
export type AudioRuntimeLoadingStrategy = 'buffer' | 'stream';

export interface AudioAssetPlan {
  assetId: string;
  caption?: string;
  category: AudioAssetCategory;
  eventCategory?: string;
  kind: AudioAssetKind;
  prompt?: string;
  script?: string;
  scriptId?: string;
  modelId: string;
  voiceId?: string;
  voiceSettings?: {
    similarityBoost?: number;
    stability?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
  requestedDurationSeconds: number;
  loop: boolean;
  outputFormat: AudioOutputFormat;
  outputPath: string;
  generationStatus: AudioGenerationStatus;
  runtimeLoadingStrategy: AudioRuntimeLoadingStrategy;
  maxBytes: number;
  notes?: string;
}

export interface AudioProvenance {
  assetId: string;
  caption?: string;
  category: AudioAssetCategory;
  compressedBytes: number;
  contentHash: string;
  durationSeconds: number | null;
  eventCategory?: string;
  generatedAt: string;
  kind: AudioAssetKind;
  modelId: string;
  outputFormat: AudioOutputFormat;
  prompt?: string;
  requestedDurationSeconds: number;
  runtimeLoadingStrategy: AudioRuntimeLoadingStrategy;
  script?: string;
  scriptId?: string;
  songId?: string;
  voiceId?: string;
}

export interface AudioPlanReportEntry {
  assetId: string;
  category: AudioAssetCategory;
  exists: boolean;
  generationStatus: AudioGenerationStatus;
  kind: AudioAssetKind;
  loop: boolean;
  maxBytes: number;
  outputPath: string;
  runtimeLoadingStrategy: AudioRuntimeLoadingStrategy;
  sizeBytes: number;
}

export interface AudioPlanReport {
  assetCount: number;
  assets: AudioPlanReportEntry[];
  generatedCount: number;
  totalBytes: number;
  validationErrors: string[];
}

export interface GenerateOptions {
  execute: boolean;
  force: boolean;
  maxFiles: number;
  onlyAssetId?: string;
  retryCount: number;
}

export interface GenerateSummary {
  dryRun: boolean;
  generated: string[];
  skipped: string[];
}

export const AUDIO_ROOT = 'public/audio';
export const DEFAULT_MAX_FILES_PER_EXECUTION = 3;
export const MAX_AUTOMATIC_RETRIES = 1;
export const OFFICIAL_ELEVENLABS_SKILLS = [
  '.agents/skills/setup-api-key/SKILL.md',
  '.agents/skills/sound-effects/SKILL.md',
  '.agents/skills/text-to-speech/SKILL.md',
  '.agents/skills/music/SKILL.md',
] as const;

const ALLOWED_AUDIO_DIRS: Record<AudioAssetCategory, string> = {
  announcer: 'public/audio/announcer',
  crowd: 'public/audio/crowd',
  music: 'public/audio/music',
  sfx: 'public/audio/sfx',
};

const OUTPUT_FORMAT_EXTENSIONS: Record<AudioOutputFormat, string> = {
  mp3_44100_128: '.mp3',
  mp3_44100_64: '.mp3',
  mp3_48000_192: '.mp3',
  opus_48000_128: '.opus',
};

export function validateAudioPlan(plan: readonly AudioAssetPlan[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const asset of plan) {
    if (ids.has(asset.assetId)) {
      errors.push(`Duplicate audio asset ID: ${asset.assetId}`);
    }
    ids.add(asset.assetId);

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(asset.assetId)) {
      errors.push(`${asset.assetId}: assetId must be stable lowercase with hyphen or underscore separators`);
    }

    if (!asset.prompt && !asset.script) {
      errors.push(`${asset.assetId}: prompt or script is required`);
    }
    if (asset.prompt && asset.script) {
      errors.push(`${asset.assetId}: use prompt for non-speech or script for speech, not both`);
    }
    if (asset.kind === 'speech' && !asset.script) {
      errors.push(`${asset.assetId}: speech assets require script`);
    }
    if (asset.kind !== 'speech' && !asset.prompt) {
      errors.push(`${asset.assetId}: non-speech assets require prompt`);
    }
    if (asset.kind === 'speech' && !asset.voiceId) {
      errors.push(`${asset.assetId}: speech assets require voiceId`);
    }
    if (asset.kind === 'speech' && !asset.scriptId) {
      errors.push(`${asset.assetId}: speech assets require scriptId`);
    }
    if (asset.kind === 'speech' && !asset.caption) {
      errors.push(`${asset.assetId}: speech assets require caption`);
    }
    if (asset.kind === 'speech' && asset.caption !== asset.script) {
      errors.push(`${asset.assetId}: speech caption must exactly match script`);
    }
    if (asset.category === 'announcer' && asset.kind !== 'speech') {
      errors.push(`${asset.assetId}: announcer assets must be speech`);
    }
    if (asset.kind === 'loop' && !asset.loop) {
      errors.push(`${asset.assetId}: loop kind must set loop=true`);
    }
    if (asset.loop && asset.runtimeLoadingStrategy !== 'stream') {
      errors.push(`${asset.assetId}: looping assets must use stream runtime loading`);
    }
    if (!asset.loop && asset.runtimeLoadingStrategy !== 'buffer') {
      errors.push(`${asset.assetId}: non-loop assets must use buffer runtime loading`);
    }
    const maxDurationSeconds = asset.kind === 'music' ? 600 : 30;
    if (asset.requestedDurationSeconds <= 0 || asset.requestedDurationSeconds > maxDurationSeconds) {
      errors.push(`${asset.assetId}: requestedDurationSeconds must be between 0 and ${maxDurationSeconds}`);
    }
    if (asset.maxBytes <= 0) {
      errors.push(`${asset.assetId}: maxBytes must be positive`);
    }

    errors.push(...validateOutputPath(asset));
  }

  return errors;
}

export function validateOutputPath(asset: AudioAssetPlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalize(asset.outputPath).replaceAll('\\', '/');
  const allowedRoot = ALLOWED_AUDIO_DIRS[asset.category];
  const expectedExtension = OUTPUT_FORMAT_EXTENSIONS[asset.outputFormat];

  if (isAbsolute(asset.outputPath)) {
    errors.push(`${asset.assetId}: outputPath must be repository-relative`);
  }
  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith(`${allowedRoot}/`)) {
    errors.push(`${asset.assetId}: outputPath must stay under ${allowedRoot}`);
  }
  if (extname(normalizedPath) !== expectedExtension) {
    errors.push(`${asset.assetId}: ${asset.outputFormat} output must use ${expectedExtension}`);
  }

  return errors;
}

export function assertValidAudioPlan(plan: readonly AudioAssetPlan[]): void {
  const errors = validateAudioPlan(plan);

  if (errors.length > 0) {
    throw new Error(`Invalid audio plan:\n${errors.join('\n')}`);
  }
}

export function parseGenerateOptions(args: readonly string[]): GenerateOptions {
  let maxFiles = readPositiveInteger(process.env.AUDIO_MAX_FILES, DEFAULT_MAX_FILES_PER_EXECUTION);
  let onlyAssetId: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--max-files=')) {
      maxFiles = readPositiveInteger(arg.slice('--max-files='.length), DEFAULT_MAX_FILES_PER_EXECUTION);
    } else if (arg.startsWith('--asset=')) {
      onlyAssetId = arg.slice('--asset='.length);
    }
  }

  return {
    execute: args.includes('--execute'),
    force: args.includes('--force'),
    maxFiles,
    onlyAssetId,
    retryCount: MAX_AUTOMATIC_RETRIES,
  };
}

export function selectAssetsForGeneration(
  plan: readonly AudioAssetPlan[],
  category: AudioAssetCategory,
  options: GenerateOptions,
): AudioAssetPlan[] {
  return plan
    .filter((asset) => asset.category === category)
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);
}

export function requireElevenLabsApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const envKey = env.ELEVENLABS_API_KEY?.trim();
  const localKey = readLocalEnvApiKey();
  const apiKey = envKey || localKey;

  if (!apiKey) {
    throw new Error(
      'Missing ELEVENLABS_API_KEY. Add it to a local .env file or shell environment; never use a VITE_ prefix.',
    );
  }

  return apiKey;
}

export function createProvenance(
  asset: AudioAssetPlan,
  content: Uint8Array,
  generatedAt = new Date().toISOString(),
  durationSeconds: number | null = null,
  songId?: string,
): AudioProvenance {
  return {
    assetId: asset.assetId,
    caption: asset.caption,
    category: asset.category,
    compressedBytes: content.byteLength,
    contentHash: createHash('sha256').update(content).digest('hex'),
    durationSeconds,
    eventCategory: asset.eventCategory,
    generatedAt,
    kind: asset.kind,
    modelId: asset.modelId,
    outputFormat: asset.outputFormat,
    prompt: asset.prompt,
    requestedDurationSeconds: asset.requestedDurationSeconds,
    runtimeLoadingStrategy: asset.runtimeLoadingStrategy,
    script: asset.script,
    scriptId: asset.scriptId,
    songId,
    voiceId: asset.voiceId,
  };
}

export function writeProvenanceSidecar(
  asset: AudioAssetPlan,
  content: Uint8Array,
  generatedAt?: string,
  durationSeconds?: number | null,
  songId?: string,
): void {
  const sidecarPath = `${resolveRepoPath(asset.outputPath)}.json`;
  writeFileSync(
    sidecarPath,
    `${JSON.stringify(createProvenance(asset, content, generatedAt, durationSeconds ?? null, songId), null, 2)}\n`,
    'utf8',
  );
}

export async function writeAudioStreamToFile(
  stream: ReadableStream<Uint8Array>,
  outputPath: string,
): Promise<Uint8Array> {
  const absoluteOutputPath = resolveRepoPath(outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  const chunks: Uint8Array[] = [];
  const writer = createWriteStream(absoluteOutputPath);
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      chunks.push(value);
      if (!writer.write(value)) {
        await once(writer, 'drain');
      }
    }
  } finally {
    reader.releaseLock();
  }

  writer.end();
  await once(writer, 'finish');

  return concatUint8Arrays(chunks);
}

export function assertCanWriteAsset(asset: AudioAssetPlan, force: boolean): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;

  if (!force && (existsSync(absoluteOutputPath) || existsSync(sidecarPath))) {
    throw new Error(`${asset.assetId}: output already exists. Pass --force to overwrite.`);
  }
}

export function assetOutputExists(asset: AudioAssetPlan): boolean {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;
  return existsSync(absoluteOutputPath) || existsSync(sidecarPath);
}

export function assetOutputMatchesProvenance(asset: AudioAssetPlan): boolean {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;

  if (!existsSync(absoluteOutputPath) || !existsSync(sidecarPath)) {
    return false;
  }

  try {
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as Partial<AudioProvenance>;
    return sidecar.assetId === asset.assetId &&
      sidecar.script === asset.script &&
      sidecar.caption === asset.caption &&
      sidecar.scriptId === asset.scriptId &&
      sidecar.voiceId === asset.voiceId &&
      sidecar.modelId === asset.modelId &&
      sidecar.outputFormat === asset.outputFormat;
  } catch {
    return false;
  }
}

export function createAudioPlanReport(plan: readonly AudioAssetPlan[]): AudioPlanReport {
  const validationErrors = validateAudioPlan(plan);
  const assets = plan.map((asset) => {
    const absoluteOutputPath = resolveRepoPath(asset.outputPath);
    const exists = existsSync(absoluteOutputPath);
    const sizeBytes = exists ? statSync(absoluteOutputPath).size : 0;

    return {
      assetId: asset.assetId,
      category: asset.category,
      exists,
      generationStatus: exists ? 'generated' : asset.generationStatus,
      kind: asset.kind,
      loop: asset.loop,
      maxBytes: asset.maxBytes,
      outputPath: asset.outputPath,
      runtimeLoadingStrategy: asset.runtimeLoadingStrategy,
      sizeBytes,
    } satisfies AudioPlanReportEntry;
  });

  return {
    assetCount: plan.length,
    assets,
    generatedCount: assets.filter((asset) => asset.exists).length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
    validationErrors,
  };
}

export function getFileHash(relativePath: string): string | null {
  const path = resolveRepoPath(relativePath);
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

export function findBrowserSecretReferences(files: readonly { path: string; text: string }[]): string[] {
  const unsafePatterns = [/ELEVENLABS_API_KEY/, /VITE_ELEVENLABS/i, /@elevenlabs\/elevenlabs-js/];

  return files.flatMap((file) =>
    unsafePatterns
      .filter((pattern) => pattern.test(file.text))
      .map((pattern) => `${file.path}: ${pattern.source}`),
  );
}

export function readAudioDurationSeconds(relativePath: string): number | null {
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
        resolveRepoPath(relativePath),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const duration = Number(output);
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

export function resolveRepoPath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

export function toRepoRelativePath(absolutePath: string): string {
  return relative(process.cwd(), absolutePath).split(sep).join('/');
}

export function isDirectCli(importMetaUrl: string, argvPath = process.argv[1]): boolean {
  return Boolean(argvPath) && importMetaUrl === pathToFileURL(argvPath).href;
}

function readLocalEnvApiKey(): string | null {
  const envPath = resolveRepoPath('.env');

  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    const keyLine = lines.find((line) => line.trim().startsWith('ELEVENLABS_API_KEY='));

    if (keyLine) {
      return normalizeLocalApiKeyValue(keyLine.slice(keyLine.indexOf('=') + 1)) || null;
    }
  }

  const localKeyPath = resolve(process.cwd(), '..', 'eleven-labs-api-key.txt');
  if (existsSync(localKeyPath)) {
    return normalizeLocalApiKeyValue(readFileSync(localKeyPath, 'utf8')) || null;
  }

  return null;
}

function normalizeLocalApiKeyValue(value: string): string {
  const trimmed = value.trim();
  const rawValue = trimmed.includes('=') ? trimmed.slice(trimmed.indexOf('=') + 1).trim() : trimmed;
  return rawValue.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}
