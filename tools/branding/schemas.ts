import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type BrandAssetCategory = 'emblem' | 'title';
export type BrandGenerationStatus = 'generated' | 'needsReview' | 'planned' | 'selected';
export type BrandImageOutputFormat = 'png' | 'webp';
export type BrandImageQuality = 'high';

export interface BrandImageAssetPlan {
  readonly assetId: string;
  readonly category: BrandAssetCategory;
  readonly generationStatus: BrandGenerationStatus;
  readonly model: 'gpt-image-2';
  readonly notes?: string;
  readonly outputFormat: BrandImageOutputFormat;
  readonly outputPath: string;
  readonly prompt: string;
  readonly provisionalApproval: 'needsReview' | 'rejected' | 'selected';
  readonly quality: BrandImageQuality;
  readonly requestedSize: string;
}

export interface BrandImageProvenance {
  readonly assetId: string;
  readonly category: BrandAssetCategory;
  readonly compressedBytes: number;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly model: string;
  readonly outputFormat: BrandImageOutputFormat;
  readonly prompt: string;
  readonly provisionalApproval: BrandImageAssetPlan['provisionalApproval'];
  readonly quality: BrandImageQuality;
  readonly requestedSize: string;
}

export interface BrandGenerateOptions {
  readonly execute: boolean;
  readonly force: boolean;
  readonly maxFiles: number;
  readonly onlyAssetId?: string;
  readonly retryCount: number;
}

export interface BrandGenerateSummary {
  readonly dryRun: boolean;
  readonly generated: readonly string[];
  readonly skipped: readonly string[];
}

export interface OpenAIApiKeyLookupOptions {
  readonly allowLocalFiles?: boolean;
  readonly env?: Record<string, string | undefined>;
  readonly envFilePath?: string | null;
  readonly localKeyFiles?: readonly string[];
}

export const BRAND_ROOT = 'public/branding';
export const BRAND_REPORT_PATH = 'public/branding/brand-asset-report.json';
export const BRAND_SELECTION_PATH = 'public/branding/brand-selection.json';
export const BRAND_GALLERY_PATH = 'public/branding/brand-gallery.html';
export const FOOTBALL_JS_TITLE_RUNTIME_PATH = 'public/branding/football-js-title.webp';
export const FOOTBALL_JS_EMBLEM_RUNTIME_PATH = 'public/branding/football-js-emblem.webp';
export const DEFAULT_BRAND_MAX_FILES_PER_EXECUTION = 4;
export const MAX_BRAND_IMAGES_PER_EXECUTION = 4;
export const MAX_BRAND_AUTOMATIC_RETRIES = 1;

const ALLOWED_BRAND_DIRS: Record<BrandAssetCategory, string> = {
  emblem: 'public/branding/emblem',
  title: 'public/branding/title',
};

const OUTPUT_FORMAT_EXTENSIONS: Record<BrandImageOutputFormat, string> = {
  png: '.png',
  webp: '.webp',
};

export function validateBrandAssetPlan(plan: readonly BrandImageAssetPlan[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (plan.length !== 4) {
    errors.push(`Expected exactly 4 planned brand images, found ${plan.length}`);
  }

  for (const asset of plan) {
    if (ids.has(asset.assetId)) {
      errors.push(`Duplicate brand asset ID: ${asset.assetId}`);
    }
    ids.add(asset.assetId);

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(asset.assetId)) {
      errors.push(`${asset.assetId}: assetId must be stable lowercase with hyphen or underscore separators`);
    }
    if (asset.model !== 'gpt-image-2') {
      errors.push(`${asset.assetId}: model must be gpt-image-2`);
    }
    if (asset.quality !== 'high') {
      errors.push(`${asset.assetId}: quality must be high`);
    }
    if (!asset.prompt.trim()) {
      errors.push(`${asset.assetId}: prompt is required`);
    }
    if (!/\b(no|without)\b.*\b(text|letter|logo|word|watermark)/i.test(asset.prompt)) {
      errors.push(`${asset.assetId}: prompt must explicitly prohibit text/logos/watermarks`);
    }

    errors.push(...validateBrandImageSize(asset));
    errors.push(...validateBrandOutputPath(asset));
  }

  const titleCount = plan.filter((asset) => asset.category === 'title').length;
  const emblemCount = plan.filter((asset) => asset.category === 'emblem').length;
  if (titleCount !== 2) {
    errors.push(`Expected 2 title-background candidates, found ${titleCount}`);
  }
  if (emblemCount !== 2) {
    errors.push(`Expected 2 emblem candidates, found ${emblemCount}`);
  }

  return errors;
}

export function assertValidBrandAssetPlan(plan: readonly BrandImageAssetPlan[]): void {
  const errors = validateBrandAssetPlan(plan);

  if (errors.length > 0) {
    throw new Error(`Invalid brand asset plan:\n${errors.join('\n')}`);
  }
}

export function validateBrandOutputPath(asset: BrandImageAssetPlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);
  const allowedRoot = ALLOWED_BRAND_DIRS[asset.category];
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

export function validateBrandImageSize(asset: BrandImageAssetPlan): string[] {
  const errors: string[] = [];
  const match = /^(\d+)x(\d+)$/.exec(asset.requestedSize);

  if (!match) {
    return [`${asset.assetId}: requestedSize must use WIDTHxHEIGHT`];
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  const pixels = width * height;
  const ratio = Math.max(width / height, height / width);

  if (width % 16 !== 0 || height % 16 !== 0) {
    errors.push(`${asset.assetId}: requestedSize dimensions must be divisible by 16`);
  }
  if (Math.max(width, height) > 3840) {
    errors.push(`${asset.assetId}: requestedSize max edge must be 3840 or less`);
  }
  if (ratio > 3) {
    errors.push(`${asset.assetId}: requestedSize aspect ratio must be 3:1 or less`);
  }
  if (pixels < 655_360 || pixels > 8_294_400) {
    errors.push(`${asset.assetId}: requestedSize pixel count is outside GPT Image 2 bounds`);
  }

  return errors;
}

export function parseBrandGenerateOptions(args: readonly string[]): BrandGenerateOptions {
  let maxFiles = readPositiveInteger(process.env.BRAND_IMAGE_MAX_FILES, DEFAULT_BRAND_MAX_FILES_PER_EXECUTION);
  let onlyAssetId: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--max-files=')) {
      maxFiles = readPositiveInteger(arg.slice('--max-files='.length), DEFAULT_BRAND_MAX_FILES_PER_EXECUTION);
    } else if (arg.startsWith('--asset=')) {
      onlyAssetId = arg.slice('--asset='.length);
    }
  }

  if (maxFiles > MAX_BRAND_IMAGES_PER_EXECUTION) {
    throw new Error(`Brand image generation is capped at ${MAX_BRAND_IMAGES_PER_EXECUTION} images per execution.`);
  }

  return {
    execute: args.includes('--execute'),
    force: args.includes('--force'),
    maxFiles,
    onlyAssetId,
    retryCount: MAX_BRAND_AUTOMATIC_RETRIES,
  };
}

export function selectBrandAssetsForGeneration(
  plan: readonly BrandImageAssetPlan[],
  options: BrandGenerateOptions,
): BrandImageAssetPlan[] {
  return plan
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);
}

export function requireOpenAIApiKey(options: OpenAIApiKeyLookupOptions = {}): string {
  const env = options.env ?? process.env;
  const envKey = env.OPENAI_API_KEY?.trim();
  const localKey = readLocalOpenAIApiKey(options);
  const apiKey = envKey || localKey;

  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY. Add it to a local .env file, shell environment, or local key file; never use a VITE_ prefix.',
    );
  }

  return apiKey;
}

export function readLocalOpenAIApiKey(options: OpenAIApiKeyLookupOptions = {}): string | null {
  const allowLocalFiles = options.allowLocalFiles ?? true;
  const envFilePath = options.envFilePath === undefined ? resolveRepoPath('.env') : options.envFilePath;
  const localKeyFiles = options.localKeyFiles ?? [resolve(process.cwd(), '..', 'openai_key.txt')];

  if (envFilePath && existsSync(envFilePath)) {
    const value = readEnvFileValue(envFilePath, 'OPENAI_API_KEY');
    if (value) {
      return value;
    }
  }

  if (!allowLocalFiles) {
    return null;
  }

  for (const keyFile of localKeyFiles) {
    if (!existsSync(keyFile)) {
      continue;
    }
    const value = readFileSync(keyFile, 'utf8').trim();
    if (value) {
      return stripEnvQuotes(value);
    }
  }

  return null;
}

export function assertCanWriteBrandAsset(asset: BrandImageAssetPlan, force: boolean): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;

  if (!force && (existsSync(absoluteOutputPath) || existsSync(sidecarPath))) {
    throw new Error(`${asset.assetId}: output already exists. Pass --force to overwrite.`);
  }
}

export function brandAssetOutputExists(asset: BrandImageAssetPlan): boolean {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;
  return existsSync(absoluteOutputPath) || existsSync(sidecarPath);
}

export function createBrandImageProvenance(
  asset: BrandImageAssetPlan,
  content: Uint8Array,
  generatedAt = new Date().toISOString(),
): BrandImageProvenance {
  return {
    assetId: asset.assetId,
    category: asset.category,
    compressedBytes: content.byteLength,
    contentHash: createHash('sha256').update(content).digest('hex'),
    generatedAt,
    model: asset.model,
    outputFormat: asset.outputFormat,
    prompt: asset.prompt,
    provisionalApproval: asset.provisionalApproval,
    quality: asset.quality,
    requestedSize: asset.requestedSize,
  };
}

export function writeBrandImageProvenanceSidecar(
  asset: BrandImageAssetPlan,
  content: Uint8Array,
  generatedAt?: string,
): void {
  const sidecarPath = `${resolveRepoPath(asset.outputPath)}.json`;
  writeJsonFile(sidecarPath, createBrandImageProvenance(asset, content, generatedAt));
}

export function readBrandImageProvenance(asset: BrandImageAssetPlan): BrandImageProvenance | null {
  const sidecarPath = `${resolveRepoPath(asset.outputPath)}.json`;

  if (!existsSync(sidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sidecarPath, 'utf8')) as BrandImageProvenance;
  } catch {
    return null;
  }
}

export function writeBrandImageFile(asset: BrandImageAssetPlan, content: Uint8Array): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, content);
}

export function copyBrandRuntimeAsset(
  sourcePath: string,
  destinationPath: string,
  force: boolean,
): void {
  const absoluteSourcePath = resolveRepoPath(sourcePath);
  const absoluteDestinationPath = resolveRepoPath(destinationPath);

  if (!existsSync(absoluteSourcePath)) {
    throw new Error(`Missing selected brand asset: ${sourcePath}`);
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

export function getFileSizeBytes(relativePath: string): number {
  const absolutePath = resolveRepoPath(relativePath);
  return existsSync(absolutePath) ? statSync(absolutePath).size : 0;
}

export function getFileContentHash(relativePath: string): string | null {
  const absolutePath = resolveRepoPath(relativePath);
  return existsSync(absolutePath) ? createContentHash(readFileSync(absolutePath)) : null;
}

export function findBrowserOpenAISecretReferences(files: readonly { path: string; text: string }[]): string[] {
  const unsafePatterns = [/OPENAI_API_KEY/, /VITE_OPENAI/i, /Authorization:\s*`?Bearer/i];

  return files.flatMap((file) =>
    unsafePatterns
      .filter((pattern) => pattern.test(file.text))
      .map((pattern) => `${file.path}: ${pattern.source}`),
  );
}

export function createContentHash(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

export function resolveRepoPath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

export function normalizePathForManifest(path: string): string {
  return normalize(path).replaceAll('\\', '/');
}

export function writeJsonFile(absolutePath: string, value: unknown): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function isDirectCli(importMetaUrl: string): boolean {
  const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
  return invokedPath !== '' && pathToFileURL(invokedPath).href === importMetaUrl;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readEnvFileValue(envPath: string, key: string): string | null {
  const contents = readFileSync(envPath, 'utf8');
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [name, ...rest] = trimmed.split('=');
    if (name !== key) {
      continue;
    }

    const value = rest.join('=').trim();
    return value ? stripEnvQuotes(value) : null;
  }

  return null;
}

function stripEnvQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
