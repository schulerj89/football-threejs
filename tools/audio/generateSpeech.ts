import { FOOTBALL_AUDIO_PLAN } from './audioPlan';
import { writeAnnouncerArtifacts } from './announcerArtifacts';
import { ensureAnnouncerVoice } from './announcerVoice';
import {
  createElevenLabsClient,
  type ElevenLabsClientInstance,
} from './elevenLabsClient';
import {
  assetOutputExists,
  assetOutputMatchesProvenance,
  assertCanWriteAsset,
  assertValidAudioPlan,
  isDirectCli,
  parseGenerateOptions,
  readAudioDurationSeconds,
  requireElevenLabsApiKey,
  selectAssetsForGeneration,
  writeAudioStreamToFile,
  writeProvenanceSidecar,
  type AudioAssetPlan,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';

export interface SpeechGenerationDependencies {
  clientFactory?: (apiKey: string) => Promise<ElevenLabsClientInstance>;
}

export async function generateSpeech(
  plan: readonly AudioAssetPlan[],
  options: GenerateOptions,
  dependencies: SpeechGenerationDependencies = {},
): Promise<GenerateSummary> {
  assertValidAudioPlan(plan);
  const allSpeechAssets = plan.filter((asset) => asset.category === 'announcer' && asset.kind === 'speech');
  const selectedAssets = selectAssetsForGeneration(plan, 'announcer', options)
    .filter((asset) => asset.kind === 'speech');

  if (!options.execute) {
    writeAnnouncerArtifacts(allSpeechAssets);
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const apiKey = requireElevenLabsApiKey();
  const client = dependencies.clientFactory
    ? await dependencies.clientFactory(apiKey)
    : await createElevenLabsClient(apiKey);
  const announcerVoice = await ensureAnnouncerVoice(client, { execute: options.execute });
  const allMaterializedSpeechAssets = allSpeechAssets.map((asset) => ({
    ...asset,
    voiceId: announcerVoice?.selectedVoiceId ?? asset.voiceId,
  }));
  const selectedAssetIds = new Set(selectedAssets.map((asset) => asset.assetId));
  const assets = allMaterializedSpeechAssets.filter((asset) => selectedAssetIds.has(asset.assetId));
  const skipped = assets
    .filter((asset) => !options.force && assetOutputMatchesProvenance(asset))
    .map((asset) => asset.assetId);
  const assetsToGenerate = assets.filter((asset) => options.force || !assetOutputMatchesProvenance(asset));

  for (const asset of assetsToGenerate) {
    if (!options.force && assetOutputExists(asset)) {
      assertCanWriteAsset(asset, options.force);
    }
  }

  if (assetsToGenerate.length === 0) {
    writeAnnouncerArtifacts(allMaterializedSpeechAssets);
    return {
      dryRun: false,
      generated: [],
      skipped,
    };
  }

  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    await withSingleRetry(options.retryCount, async () => {
      const audio = await client.textToSpeech.convert(asset.voiceId ?? '', {
        modelId: asset.modelId,
        outputFormat: asset.outputFormat,
        text: asset.script ?? '',
        voiceSettings: asset.voiceSettings
          ? {
              similarityBoost: asset.voiceSettings.similarityBoost,
              stability: asset.voiceSettings.stability,
              style: asset.voiceSettings.style,
              useSpeakerBoost: asset.voiceSettings.useSpeakerBoost,
            }
          : undefined,
      });
      const content = await writeAudioStreamToFile(audio, asset.outputPath);
      writeProvenanceSidecar(asset, content, undefined, readAudioDurationSeconds(asset.outputPath));
      generated.push(asset.assetId);
    });
  }
  writeAnnouncerArtifacts(allMaterializedSpeechAssets);

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
  generateSpeech(FOOTBALL_AUDIO_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
