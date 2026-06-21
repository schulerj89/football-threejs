import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import {
  assertCanWriteAsset,
  assertValidAudioPlan,
  isDirectCli,
  parseGenerateOptions,
  requireElevenLabsApiKey,
  writeAudioStreamToFile,
  writeProvenanceSidecar,
  type AudioAssetPlan,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';

type ElevenLabsModule = typeof import('@elevenlabs/elevenlabs-js');
type ElevenLabsClientInstance = InstanceType<typeof ElevenLabsClient>;

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

  for (const asset of selectedAssets) {
    assertCanWriteAsset(asset, options.force);
  }

  const apiKey = requireElevenLabsApiKey();
  const client = dependencies.clientFactory
    ? await dependencies.clientFactory(apiKey)
    : await createDefaultClient(apiKey);
  const generated: string[] = [];

  for (const asset of selectedAssets) {
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
      writeProvenanceSidecar(asset, content);
      generated.push(asset.assetId);
    });
  }

  return {
    dryRun: false,
    generated,
    skipped: [],
  };
}

async function createDefaultClient(apiKey: string): Promise<ElevenLabsClientInstance> {
  const module: ElevenLabsModule = await import('@elevenlabs/elevenlabs-js');
  return new module.ElevenLabsClient({ apiKey });
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
