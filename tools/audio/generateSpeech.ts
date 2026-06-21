import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import {
  assertCanWriteAsset,
  assertValidAudioPlan,
  isDirectCli,
  parseGenerateOptions,
  requireElevenLabsApiKey,
  selectAssetsForGeneration,
  writeAudioStreamToFile,
  writeProvenanceSidecar,
  type AudioAssetPlan,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';

type ElevenLabsModule = typeof import('@elevenlabs/elevenlabs-js');
type ElevenLabsClientInstance = InstanceType<typeof ElevenLabsClient>;

export interface SpeechGenerationDependencies {
  clientFactory?: (apiKey: string) => Promise<ElevenLabsClientInstance>;
}

export async function generateSpeech(
  plan: readonly AudioAssetPlan[],
  options: GenerateOptions,
  dependencies: SpeechGenerationDependencies = {},
): Promise<GenerateSummary> {
  assertValidAudioPlan(plan);
  const assets = selectAssetsForGeneration(plan, 'announcer', options)
    .filter((asset) => asset.kind === 'speech');

  if (!options.execute) {
    return {
      dryRun: true,
      generated: [],
      skipped: assets.map((asset) => asset.assetId),
    };
  }

  for (const asset of assets) {
    assertCanWriteAsset(asset, options.force);
  }

  const apiKey = requireElevenLabsApiKey();
  const client = dependencies.clientFactory
    ? await dependencies.clientFactory(apiKey)
    : await createDefaultClient(apiKey);
  const generated: string[] = [];

  for (const asset of assets) {
    await withSingleRetry(options.retryCount, async () => {
      const audio = await client.textToSpeech.convert(asset.voiceId ?? '', {
        modelId: asset.modelId,
        outputFormat: asset.outputFormat,
        text: asset.script ?? '',
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
  generateSpeech(FOOTBALL_AUDIO_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
