import { FOOTBALL_JS_BRAND_ASSET_PLAN } from './brandAssetPlan';
import {
  assertCanWriteBrandAsset,
  assertValidBrandAssetPlan,
  brandAssetOutputExists,
  isDirectCli,
  parseBrandGenerateOptions,
  requireOpenAIApiKey,
  selectBrandAssetsForGeneration,
  writeBrandImageFile,
  writeBrandImageProvenanceSidecar,
  type BrandGenerateOptions,
  type BrandGenerateSummary,
  type BrandImageAssetPlan,
} from './schemas';

export interface BrandImageGenerationDependencies {
  readonly requestImage?: (asset: BrandImageAssetPlan, apiKey: string) => Promise<Uint8Array>;
}

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
}

export async function generateBrandImages(
  plan: readonly BrandImageAssetPlan[],
  options: BrandGenerateOptions,
  dependencies: BrandImageGenerationDependencies = {},
): Promise<BrandGenerateSummary> {
  assertValidBrandAssetPlan(plan);
  const selectedAssets = selectBrandAssetsForGeneration(plan, options);

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const assetsToGenerate: BrandImageAssetPlan[] = [];
  const skipped: string[] = [];

  for (const asset of selectedAssets) {
    if (!options.force && brandAssetOutputExists(asset)) {
      skipped.push(asset.assetId);
      continue;
    }
    assertCanWriteBrandAsset(asset, options.force);
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
  const requestImage = dependencies.requestImage ?? requestOpenAIImage;
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    const content = await withSingleRetry(options.retryCount, () => requestImage(asset, apiKey));
    writeBrandImageFile(asset, content);
    writeBrandImageProvenanceSidecar(asset, content);
    generated.push(asset.assetId);
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

async function requestOpenAIImage(asset: BrandImageAssetPlan, apiKey: string): Promise<Uint8Array> {
  const body = {
    model: asset.model,
    n: 1,
    output_compression: asset.outputFormat === 'webp' ? 90 : undefined,
    output_format: asset.outputFormat,
    prompt: asset.prompt,
    quality: asset.quality,
    size: asset.requestedSize,
  };

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    body: JSON.stringify(body),
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
    return Buffer.from(image.b64_json, 'base64');
  }
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`OpenAI image download failed for ${asset.assetId}: ${imageResponse.status}`);
    }
    return new Uint8Array(await imageResponse.arrayBuffer());
  }

  throw new Error(`OpenAI image generation returned no image data for ${asset.assetId}`);
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
  generateBrandImages(FOOTBALL_JS_BRAND_ASSET_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
