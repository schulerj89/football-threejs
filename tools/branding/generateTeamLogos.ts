import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
  assertValidFootballJsTeamLogoPlan,
  type TeamLogoAssetPlan,
} from './teamLogoPlan';
import {
  isDirectCli,
  requireOpenAIApiKey,
  resolveRepoPath,
  type BrandGenerateOptions,
  type BrandGenerateSummary,
} from './schemas';
import { writeTeamLogoProvenanceSidecar, type TeamLogoGenerationMetadata } from './teamLogoReport';

export interface TeamLogoGenerationResult {
  readonly content: Uint8Array;
  readonly metadata: TeamLogoGenerationMetadata;
}

export interface TeamLogoGenerationDependencies {
  readonly requestImage?: (asset: TeamLogoAssetPlan, apiKey: string) => Promise<TeamLogoGenerationResult>;
}

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
}

export const DEFAULT_TEAM_LOGO_MAX_FILES_PER_EXECUTION = 12;
export const MAX_TEAM_LOGO_IMAGES_PER_EXECUTION = 12;
export const MAX_TEAM_LOGO_AUTOMATIC_RETRIES = 1;

export async function generateTeamLogos(
  plan: readonly TeamLogoAssetPlan[],
  options: BrandGenerateOptions,
  dependencies: TeamLogoGenerationDependencies = {},
): Promise<BrandGenerateSummary> {
  assertValidFootballJsTeamLogoPlan(plan);
  const selectedAssets = selectTeamLogosForGeneration(plan, options);

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const assetsToGenerate: TeamLogoAssetPlan[] = [];
  const skipped: string[] = [];

  for (const asset of selectedAssets) {
    if (!options.force && teamLogoAssetOutputExists(asset)) {
      skipped.push(asset.assetId);
      continue;
    }
    assertCanWriteTeamLogoAsset(asset, options.force);
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
  const requestImage = dependencies.requestImage ?? requestOpenAITeamLogoImage;
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    const result = await withSingleRetry(
      options.retryCount,
      () => requestImage(asset, apiKey),
    );
    writeTeamLogoImageFile(asset, result.content);
    writeTeamLogoProvenanceSidecar(asset, result.content, result.metadata);
    generated.push(asset.assetId);
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

export function parseTeamLogoGenerateOptions(args: readonly string[]): BrandGenerateOptions {
  let maxFiles = readPositiveInteger(process.env.TEAM_LOGO_MAX_FILES, DEFAULT_TEAM_LOGO_MAX_FILES_PER_EXECUTION);
  if (process.env.npm_config_max_files) {
    maxFiles = readPositiveInteger(process.env.npm_config_max_files, DEFAULT_TEAM_LOGO_MAX_FILES_PER_EXECUTION);
  }
  let onlyAssetId: string | undefined = process.env.npm_config_asset;

  for (const arg of args) {
    if (arg.startsWith('--max-files=')) {
      maxFiles = readPositiveInteger(arg.slice('--max-files='.length), DEFAULT_TEAM_LOGO_MAX_FILES_PER_EXECUTION);
    } else if (arg.startsWith('--asset=')) {
      onlyAssetId = arg.slice('--asset='.length);
    }
  }

  if (maxFiles > MAX_TEAM_LOGO_IMAGES_PER_EXECUTION) {
    throw new Error(`Team logo generation is capped at ${MAX_TEAM_LOGO_IMAGES_PER_EXECUTION} images per execution.`);
  }

  return {
    execute: args.includes('--execute') || readCliBoolean(process.env.npm_config_execute),
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    maxFiles,
    onlyAssetId,
    retryCount: MAX_TEAM_LOGO_AUTOMATIC_RETRIES,
  };
}

export function selectTeamLogosForGeneration(
  plan: readonly TeamLogoAssetPlan[],
  options: BrandGenerateOptions,
): TeamLogoAssetPlan[] {
  return plan
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);
}

export function teamLogoAssetOutputExists(asset: TeamLogoAssetPlan): boolean {
  const outputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${outputPath}.json`;
  return existsSync(outputPath) || existsSync(sidecarPath);
}

export function assertCanWriteTeamLogoAsset(asset: TeamLogoAssetPlan, force: boolean): void {
  const absoluteOutputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${absoluteOutputPath}.json`;

  if (!force && (existsSync(absoluteOutputPath) || existsSync(sidecarPath))) {
    throw new Error(`${asset.assetId}: output already exists. Pass --force to overwrite.`);
  }
}

async function requestOpenAITeamLogoImage(
  asset: TeamLogoAssetPlan,
  apiKey: string,
): Promise<TeamLogoGenerationResult> {
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

function writeTeamLogoImageFile(asset: TeamLogoAssetPlan, content: Uint8Array): void {
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
  const options = parseTeamLogoGenerateOptions(process.argv.slice(2));
  generateTeamLogos(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
