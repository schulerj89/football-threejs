import { existsSync, readFileSync } from 'node:fs';
import { FOOTBALL_JS_COIN_ASSET_PLAN, assertValidFootballJsCoinAssetPlan, type CoinImageAssetPlan } from './coinAssetPlan';
import {
  assertCanWriteBrandAsset,
  isDirectCli,
  parseBrandGenerateOptions,
  requireOpenAIApiKey,
  resolveRepoPath,
  writeBrandImageFile,
  type BrandGenerateOptions,
  type BrandGenerateSummary,
  type BrandImageAssetPlan,
} from './schemas';
import { writeCoinImageProvenanceSidecar, type CoinGenerationMetadata } from './coinAssetReport';

export interface CoinImageGenerationResult {
  readonly content: Uint8Array;
  readonly metadata: CoinGenerationMetadata;
}

export interface CoinImageGenerationDependencies {
  readonly requestImage?: (
    asset: CoinImageAssetPlan,
    apiKey: string,
    referenceImage?: Uint8Array,
  ) => Promise<CoinImageGenerationResult>;
}

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
}

export async function generateCoinAssets(
  plan: readonly CoinImageAssetPlan[],
  options: BrandGenerateOptions,
  dependencies: CoinImageGenerationDependencies = {},
): Promise<BrandGenerateSummary> {
  assertValidFootballJsCoinAssetPlan(plan);
  const selectedAssets = selectCoinAssetsForGeneration(plan, options);

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const assetsToGenerate: CoinImageAssetPlan[] = [];
  const skipped: string[] = [];

  for (const asset of selectedAssets) {
    if (!options.force && coinAssetOutputExists(asset)) {
      skipped.push(asset.assetId);
      continue;
    }
    assertCanWriteBrandAsset(toBrandAssetPlan(asset), options.force);
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
  const requestImage = dependencies.requestImage ?? requestOpenAICoinImage;
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    const referenceImage = asset.referenceAssetId
      ? readReferenceImage(plan, asset)
      : undefined;
    const result = await withSingleRetry(
      options.retryCount,
      () => requestImage(asset, apiKey, referenceImage),
    );
    writeBrandImageFile(toBrandAssetPlan(asset), result.content);
    writeCoinImageProvenanceSidecar(asset, result.content, result.metadata);
    generated.push(asset.assetId);
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

export function selectCoinAssetsForGeneration(
  plan: readonly CoinImageAssetPlan[],
  options: BrandGenerateOptions,
): CoinImageAssetPlan[] {
  return plan
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);
}

export function coinAssetOutputExists(asset: CoinImageAssetPlan): boolean {
  const outputPath = resolveRepoPath(asset.outputPath);
  const sidecarPath = `${outputPath}.json`;
  return existsSync(outputPath) || existsSync(sidecarPath);
}

async function requestOpenAICoinImage(
  asset: CoinImageAssetPlan,
  apiKey: string,
  referenceImage?: Uint8Array,
): Promise<CoinImageGenerationResult> {
  if (referenceImage) {
    try {
      return await requestOpenAIImageEdit(asset, apiKey, referenceImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unsupported|not supported|400|404/i.test(message)) {
        throw error;
      }
    }
  }

  return requestOpenAIImageGeneration(asset, apiKey, Boolean(referenceImage));
}

async function requestOpenAIImageGeneration(
  asset: CoinImageAssetPlan,
  apiKey: string,
  referenceFallback: boolean,
): Promise<CoinImageGenerationResult> {
  const body = {
    background: asset.background,
    model: asset.model,
    n: 1,
    output_compression: 92,
    output_format: asset.outputFormat,
    prompt: asset.prompt,
    quality: asset.quality,
    size: asset.requestedSize,
  };
  const payload = await postOpenAIImageRequest(
    'https://api.openai.com/v1/images/generations',
    apiKey,
    body,
    asset.assetId,
  );

  return {
    content: payload.content,
    metadata: {
      apiEndpoint: 'images/generations',
      referenceMode: referenceFallback ? 'generationFallback' : 'none',
      revisedPrompt: payload.revisedPrompt,
    },
  };
}

async function requestOpenAIImageEdit(
  asset: CoinImageAssetPlan,
  apiKey: string,
  referenceImage: Uint8Array,
): Promise<CoinImageGenerationResult> {
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
    new Blob([referenceImageCopy.buffer], { type: 'image/webp' }),
    `${asset.referenceAssetId ?? 'reference'}.webp`,
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
    throw new Error(`OpenAI image edit failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  const payload = await readOpenAIImageResponse(response, asset.assetId);

  return {
    content: payload.content,
    metadata: {
      apiEndpoint: 'images/edits',
      referenceAssetId: asset.referenceAssetId,
      referenceMode: 'imageEdit',
      revisedPrompt: payload.revisedPrompt,
    },
  };
}

async function postOpenAIImageRequest(
  url: string,
  apiKey: string,
  body: unknown,
  assetId: string,
): Promise<{ content: Uint8Array; revisedPrompt: string | null }> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image generation failed for ${assetId}: ${response.status} ${errorBody}`);
  }

  return readOpenAIImageResponse(response, assetId);
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

function readReferenceImage(
  plan: readonly CoinImageAssetPlan[],
  asset: CoinImageAssetPlan,
): Uint8Array | undefined {
  const reference = plan.find((candidate) => candidate.assetId === asset.referenceAssetId);

  if (!reference) {
    return undefined;
  }

  const absolutePath = resolveRepoPath(reference.outputPath);
  return existsSync(absolutePath) ? readFileSync(absolutePath) : undefined;
}

function toBrandAssetPlan(asset: CoinImageAssetPlan): BrandImageAssetPlan {
  return {
    assetId: asset.assetId,
    category: 'emblem',
    generationStatus: asset.generationStatus,
    model: asset.model,
    notes: asset.notes,
    outputFormat: asset.outputFormat,
    outputPath: asset.outputPath,
    prompt: asset.prompt,
    provisionalApproval: asset.generationStatus === 'selected' ? 'selected' : 'needsReview',
    quality: asset.quality,
    requestedSize: asset.requestedSize,
  };
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

if (isDirectCli(import.meta.url)) {
  const options = parseBrandGenerateOptions(process.argv.slice(2));
  generateCoinAssets(FOOTBALL_JS_COIN_ASSET_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
