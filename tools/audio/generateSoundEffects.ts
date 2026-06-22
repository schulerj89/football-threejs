import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import {
  createElevenLabsClient,
  type ElevenLabsClientInstance,
} from './elevenLabsClient';
import {
  assetOutputExists,
  assertValidAudioPlan,
  isDirectCli,
  parseGenerateOptions,
  readAudioDurationSeconds,
  requireElevenLabsApiKey,
  writeAudioStreamToFile,
  writeProvenanceSidecar,
  type AudioAssetPlan,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';

export interface SoundEffectsGenerationDependencies {
  clientFactory?: (apiKey: string) => Promise<ElevenLabsClientInstance>;
}

export async function generateSoundEffects(
  plan: readonly AudioAssetPlan[],
  options: GenerateOptions,
  dependencies: SoundEffectsGenerationDependencies = {},
): Promise<GenerateSummary> {
  assertValidAudioPlan(plan);
  const assets = plan
    .filter((asset) => asset.category === 'sfx' || asset.category === 'crowd')
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .filter((asset) => asset.kind !== 'speech');
  const selectedAssets = assets.slice(0, options.maxFiles);

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const skipped = selectedAssets
    .filter((asset) => !options.force && assetOutputExists(asset))
    .map((asset) => asset.assetId);
  const assetsToGenerate = selectedAssets.filter(
    (asset) => options.force || !assetOutputExists(asset),
  );

  if (assetsToGenerate.length === 0) {
    return {
      dryRun: false,
      generated: [],
      skipped,
    };
  }

  const apiKey = requireElevenLabsApiKey();
  const client = dependencies.clientFactory
    ? await dependencies.clientFactory(apiKey)
    : await createElevenLabsClient(apiKey);
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    await withSingleRetry(options.retryCount, async () => {
      const audio = await client.textToSoundEffects.convert({
        durationSeconds: asset.requestedDurationSeconds,
        loop: asset.loop,
        modelId: asset.modelId,
        outputFormat: asset.outputFormat,
        promptInfluence: 0.45,
        text: asset.prompt ?? '',
      });
      const content = await writeAudioStreamToFile(audio, asset.outputPath);
      writeProvenanceSidecar(asset, content, undefined, readAudioDurationSeconds(asset.outputPath));
      generated.push(asset.assetId);
    });
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

async function withSingleRetry(retryCount: number, action: () => Promise<void>): Promise<void> {
  let attempt = 0;

  while (true) {
    try {
      await action();
      return;
    } catch (error) {
      if (attempt >= retryCount) {
        throw error;
      }
      attempt += 1;
    }
  }
}

if (isDirectCli(import.meta.url)) {
  const options = parseGenerateOptions(process.argv.slice(2));
  generateSoundEffects(FOOTBALL_AUDIO_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
