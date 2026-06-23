import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
  assertValidFootballJsScorebugAssetPlan,
  type ScorebugImageAssetPlan,
} from './scorebugAssetPlan';
import {
  isDirectCli,
  requireOpenAIApiKey,
  resolveRepoPath,
  type BrandGenerateOptions,
  type BrandGenerateSummary,
} from './schemas';
import { writeScorebugImageProvenanceSidecar, type ScorebugGenerationMetadata } from './scorebugAssetReport';

export interface ScorebugImageGenerationResult {
  readonly content: Uint8Array;
  readonly metadata: ScorebugGenerationMetadata;
}

export interface ScorebugImageGenerationDependencies {
  readonly requestImage?: (
    asset: ScorebugImageAssetPlan,
    apiKey: string,
  ) => Promise<ScorebugImageGenerationResult>;
}

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
}

export const DEFAULT_SCOREBUG_MAX_FILES_PER_EXECUTION = 3;
export const MAX_SCOREBUG_IMAGES_PER_EXECUTION = 3;
export const MAX_SCOREBUG_AUTOMATIC_RETRIES = 1;

export async function generateScorebugAssets(
  plan: readonly ScorebugImageAssetPlan[],
  options: BrandGenerateOptions,
  dependencies: ScorebugImageGenerationDependencies = {},
): Promise<BrandGenerateSummary> {
  assertValidFootballJsScorebugAssetPlan(plan);
  const selectedAssets = selectScorebugAssetsForGeneration(plan, options);

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const assetsToGenerate: ScorebugImageAssetPlan[] = [];
  const skipped: string[] = [];

  for (const asset of selectedAssets) {
    if (!options.force && scorebugAssetOutputExists(asset)) {
      skipped.push(asset.assetId);
      continue;
    }
    assertCanWriteScorebugAsset(asset, options.force);
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
  const requestImage = dependencies.requestImage ?? requestOpenAIScorebugImage;
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    const result = await withSingleRetry(
      options.retryCount,
      () => requestImage(asset, apiKey),
    );
    writeScorebugImageFile(asset, result.content);
    writeScorebugImageProvenanceSidecar(asset, result.content, result.metadata);
    generated.push(asset.assetId);
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

export function parseScorebugGenerateOptions(args: readonly string[]): BrandGenerateOptions {
  let maxFiles = readPositiveInteger(process.env.SCOREBUG_IMAGE_MAX_FILES, DEFAULT_SCOREBUG_MAX_FILES_PER_EXECUTION);
  if (process.env.npm_config_max_files) {
    maxFiles = readPositiveInteger(process.env.npm_config_max_files, DEFAULT_SCOREBUG_MAX_FILES_PER_EXECUTION);
  }
  let onlyAssetId: string | undefined = process.env.npm_config_asset;

  for (const arg of args) {
    if (arg.startsWith('--max-files=')) {
      maxFiles = readPositiveInteger(arg.slice('--max-files='.length), DEFAULT_SCOREBUG_MAX_FILES_PER_EXECUTION);
    } else if (arg.startsWith('--asset=')) {
      onlyAssetId = arg.slice('--asset='.length);
    }
  }

  if (maxFiles > MAX_SCOREBUG_IMAGES_PER_EXECUTION) {
    throw new Error(`Scorebug shell generation is capped at ${MAX_SCOREBUG_IMAGES_PER_EXECUTION} images per execution.`);
  }

  return {
    execute: args.includes('--execute') || readCliBoolean(process.env.npm_config_execute),
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    maxFiles,
    onlyAssetId,
    retryCount: MAX_SCOREBUG_AUTOMATIC_RETRIES,
  };
}

export function selectScorebugAssetsForGeneration(
  plan: readonly ScorebugImageAssetPlan[],
  options: BrandGenerateOptions,
): ScorebugImageAssetPlan[] {
  return plan
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);
}

export function scorebugAssetOutputExists(asset: ScorebugImageAssetPlan): boolean {
  const outputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${outputPath}.json`;
  return existsSync(outputPath) || existsSync(sidecarPath);
}

export function assertCanWriteScorebugAsset(asset: ScorebugImageAssetPlan, force: boolean): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;

  if (!force && (existsSync(absoluteOutputPath) || existsSync(sidecarPath))) {
    throw new Error(`${asset.assetId}: output already exists. Pass --force to overwrite.`);
  }
}

async function requestOpenAIScorebugImage(
  asset: ScorebugImageAssetPlan,
  apiKey: string,
): Promise<ScorebugImageGenerationResult> {
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
    throw new Error(`OpenAI image generation failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  const payload = (await response.json()) as OpenAIImageGenerationResponse;
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return {
      content: Buffer.from(image.b64_json, 'base64'),
      metadata: {
        apiEndpoint: 'images/generations',
        revisedPrompt: image.revised_prompt ?? null,
      },
    };
  }
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`OpenAI image download failed for ${asset.assetId}: ${imageResponse.status}`);
    }
    return {
      content: new Uint8Array(await imageResponse.arrayBuffer()),
      metadata: {
        apiEndpoint: 'images/generations',
        revisedPrompt: image.revised_prompt ?? null,
      },
    };
  }

  throw new Error(`OpenAI image generation returned no image data for ${asset.assetId}`);
}

function writeScorebugImageFile(asset: ScorebugImageAssetPlan, content: Uint8Array): void {
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
  const options = parseScorebugGenerateOptions(process.argv.slice(2));
  generateScorebugAssets(FOOTBALL_JS_SCOREBUG_ASSET_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
