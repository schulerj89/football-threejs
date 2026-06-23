import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  FOOTBALL_JS_PLAY_ART_ASSET_PLAN,
  assertValidFootballJsPlayArtAssetPlan,
  type PlayArtImageAssetPlan,
} from './playArtAssetPlan';
import {
  isDirectCli,
  requireOpenAIApiKey,
  resolveRepoPath,
  type BrandGenerateOptions,
  type BrandGenerateSummary,
} from './schemas';
import { writePlayArtImageProvenanceSidecar, type PlayArtGenerationMetadata } from './playArtAssetReport';

export interface PlayArtImageGenerationResult {
  readonly content: Uint8Array;
  readonly metadata: PlayArtGenerationMetadata;
}

export interface PlayArtImageGenerationDependencies {
  readonly requestImage?: (
    asset: PlayArtImageAssetPlan,
    apiKey: string,
    referenceImage: Uint8Array | null,
  ) => Promise<PlayArtImageGenerationResult>;
}

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
}

export const DEFAULT_PLAY_ART_MAX_FILES_PER_EXECUTION = 3;
export const MAX_PLAY_ART_IMAGES_PER_EXECUTION = 3;
export const MAX_PLAY_ART_AUTOMATIC_RETRIES = 1;

export async function generatePlayArtAssets(
  plan: readonly PlayArtImageAssetPlan[],
  options: BrandGenerateOptions,
  dependencies: PlayArtImageGenerationDependencies = {},
): Promise<BrandGenerateSummary> {
  assertValidFootballJsPlayArtAssetPlan(plan);
  const selectedAssets = selectPlayArtAssetsForGeneration(plan, options);

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const assetsToGenerate: PlayArtImageAssetPlan[] = [];
  const skipped: string[] = [];

  for (const asset of selectedAssets) {
    if (!options.force && playArtAssetOutputExists(asset)) {
      skipped.push(asset.assetId);
      continue;
    }
    assertCanWritePlayArtAsset(asset, options.force);
    assetsToGenerate.push(asset);
  }

  if (assetsToGenerate.length === 0) {
    return {
      dryRun: false,
      generated: [],
      skipped,
    };
  }

  const apiKey = requireOpenAIApiKey();
  const requestImage = dependencies.requestImage ?? requestOpenAIPlayArtImage;
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    const referenceImage = readReferenceImage(asset);
    const result = await withSingleRetry(
      options.retryCount,
      () => requestImage(asset, apiKey, referenceImage),
    );
    writePlayArtImageFile(asset, result.content);
    writePlayArtImageProvenanceSidecar(asset, result.content, result.metadata);
    generated.push(asset.assetId);
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

export function parsePlayArtGenerateOptions(args: readonly string[]): BrandGenerateOptions {
  let maxFiles = readPositiveInteger(process.env.PLAY_ART_IMAGE_MAX_FILES, DEFAULT_PLAY_ART_MAX_FILES_PER_EXECUTION);
  if (process.env.npm_config_max_files) {
    maxFiles = readPositiveInteger(process.env.npm_config_max_files, DEFAULT_PLAY_ART_MAX_FILES_PER_EXECUTION);
  }
  let onlyAssetId: string | undefined = process.env.npm_config_asset;

  for (const arg of args) {
    if (arg.startsWith('--max-files=')) {
      maxFiles = readPositiveInteger(arg.slice('--max-files='.length), DEFAULT_PLAY_ART_MAX_FILES_PER_EXECUTION);
    } else if (arg.startsWith('--asset=')) {
      onlyAssetId = arg.slice('--asset='.length);
    }
  }

  if (maxFiles > MAX_PLAY_ART_IMAGES_PER_EXECUTION) {
    throw new Error(`Play-art generation is capped at ${MAX_PLAY_ART_IMAGES_PER_EXECUTION} images per execution.`);
  }

  return {
    execute: args.includes('--execute') || readCliBoolean(process.env.npm_config_execute),
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    maxFiles,
    onlyAssetId,
    retryCount: MAX_PLAY_ART_AUTOMATIC_RETRIES,
  };
}

export function selectPlayArtAssetsForGeneration(
  plan: readonly PlayArtImageAssetPlan[],
  options: BrandGenerateOptions,
): PlayArtImageAssetPlan[] {
  return plan
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);
}

export function playArtAssetOutputExists(asset: PlayArtImageAssetPlan): boolean {
  const outputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${outputPath}.json`;
  return existsSync(outputPath) || existsSync(sidecarPath);
}

export function assertCanWritePlayArtAsset(asset: PlayArtImageAssetPlan, force: boolean): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;

  if (!force && (existsSync(absoluteOutputPath) || existsSync(sidecarPath))) {
    throw new Error(`${asset.assetId}: output already exists. Pass --force to overwrite.`);
  }
}

async function requestOpenAIPlayArtImage(
  asset: PlayArtImageAssetPlan,
  apiKey: string,
  referenceImage: Uint8Array | null,
): Promise<PlayArtImageGenerationResult> {
  if (referenceImage) {
    try {
      return await requestOpenAIPlayArtEdit(asset, apiKey, referenceImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unsupported|not supported|400|404/i.test(message)) {
        throw error;
      }
    }
  }

  return requestOpenAIPlayArtGeneration(asset, apiKey, Boolean(referenceImage));
}

async function requestOpenAIPlayArtGeneration(
  asset: PlayArtImageAssetPlan,
  apiKey: string,
  referenceFallback: boolean,
): Promise<PlayArtImageGenerationResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    body: JSON.stringify({
      background: asset.background,
      model: asset.model,
      n: 1,
      output_compression: 92,
      output_format: asset.outputFormat,
      prompt: asset.prompt,
      quality: asset.quality,
      size: asset.requestedSize,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI play-art image generation failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  const payload = await readOpenAIImageResponse(response, asset.assetId);
  return {
    content: payload.content,
    metadata: {
      apiEndpoint: 'images/generations',
      referenceImagePath: referenceFallback ? asset.referenceImagePath : null,
      referenceMode: referenceFallback ? 'generationFallback' : 'none',
      revisedPrompt: payload.revisedPrompt,
    },
  };
}

async function requestOpenAIPlayArtEdit(
  asset: PlayArtImageAssetPlan,
  apiKey: string,
  referenceImage: Uint8Array,
): Promise<PlayArtImageGenerationResult> {
  const referenceImageCopy = new Uint8Array(referenceImage);
  const form = new FormData();
  form.set('background', asset.background);
  form.set('model', asset.model);
  form.set('n', '1');
  form.set('output_compression', '92');
  form.set('output_format', asset.outputFormat);
  form.set('prompt', asset.prompt);
  form.set('quality', asset.quality);
  form.set('size', asset.requestedSize);
  form.set(
    'image',
    new Blob([referenceImageCopy.buffer], { type: 'image/png' }),
    'current-play-svg-context.png',
  );

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    body: form,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI play-art image edit failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  const payload = await readOpenAIImageResponse(response, asset.assetId);
  return {
    content: payload.content,
    metadata: {
      apiEndpoint: 'images/edits',
      referenceImagePath: asset.referenceImagePath,
      referenceMode: 'imageEdit',
      revisedPrompt: payload.revisedPrompt,
    },
  };
}

async function readOpenAIImageResponse(
  response: Response,
  assetId: string,
): Promise<{ content: Uint8Array; revisedPrompt: string | null }> {
  const payload = (await response.json()) as OpenAIImageGenerationResponse;
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return {
      content: Buffer.from(image.b64_json, 'base64'),
      revisedPrompt: image.revised_prompt ?? null,
    };
  }
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`OpenAI image download failed for ${assetId}: ${imageResponse.status}`);
    }
    return {
      content: new Uint8Array(await imageResponse.arrayBuffer()),
      revisedPrompt: image.revised_prompt ?? null,
    };
  }

  throw new Error(`OpenAI image generation returned no image data for ${assetId}`);
}

function readReferenceImage(asset: PlayArtImageAssetPlan): Uint8Array | null {
  const absolutePath = resolveRepoPath(asset.referenceImagePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath) : null;
}

function writePlayArtImageFile(asset: PlayArtImageAssetPlan, content: Uint8Array): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, content);
}

async function withSingleRetry<T>(retryCount: number, action: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= retryCount) {
        throw error;
      }
      attempt += 1;
    }
  }
}

function readCliBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

if (isDirectCli(import.meta.url)) {
  const options = parsePlayArtGenerateOptions(process.argv.slice(2));
  generatePlayArtAssets(FOOTBALL_JS_PLAY_ART_ASSET_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
