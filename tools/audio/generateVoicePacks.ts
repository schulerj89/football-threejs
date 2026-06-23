import {
  createElevenLabsClient,
  type ElevenLabsClientInstance,
} from './elevenLabsClient';
import {
  COMPACT_BROADCAST_SCRIPT_CATALOG,
  createVoicePackManifest,
  createVoicePackSpeechPlan,
  validateCompactBroadcastScriptCatalog,
} from './compactBroadcastScriptCatalog';
import {
  assetOutputExists,
  assetOutputMatchesProvenance,
  assertCanWriteAsset,
  assertValidAudioPlan,
  isDirectCli,
  parseGenerateOptions,
  readAudioDurationSeconds,
  requireElevenLabsApiKey,
  writeAudioStreamToFile,
  writeProvenanceSidecar,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';
import { writeVoicePackArtifacts } from './voicePackReport';
import {
  VOICE_PACKS,
} from '../../src/audio/voicePacks/VoicePackRegistry';
import type { VoicePackId } from '../../src/audio/voicePacks/VoicePackTypes';

export interface VoicePackGenerationDependencies {
  clientFactory?: (apiKey: string) => Promise<ElevenLabsClientInstance>;
}

export async function generateVoicePacks(
  options: GenerateOptions,
  dependencies: VoicePackGenerationDependencies = {},
): Promise<GenerateSummary> {
  const plan = createAllVoicePackPlans();
  const validationErrors = [
    ...validateCompactBroadcastScriptCatalog(COMPACT_BROADCAST_SCRIPT_CATALOG),
  ];
  assertValidAudioPlan(plan);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid compact voice-pack catalog:\n${validationErrors.join('\n')}`);
  }

  const selectedAssets = selectVoicePackAssets(plan, options, options.execute);

  if (!options.execute) {
    writeVoicePackArtifacts();
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const missing = selectedAssets.filter(
    (asset) => options.force || !assetOutputMatchesProvenance(asset),
  );
  if (missing.length === 0) {
    writeVoicePackArtifacts();
    return {
      dryRun: false,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const apiKey = requireElevenLabsApiKey();
  const client = dependencies.clientFactory
    ? await dependencies.clientFactory(apiKey)
    : await createElevenLabsClient(apiKey);

  const skipped = selectedAssets
    .filter((asset) => !options.force && assetOutputMatchesProvenance(asset))
    .map((asset) => asset.assetId);
  const assetsToGenerate = selectedAssets.filter(
    (asset) => options.force || !assetOutputMatchesProvenance(asset),
  );

  for (const asset of assetsToGenerate) {
    if (!options.force && assetOutputExists(asset)) {
      assertCanWriteAsset(asset, options.force);
    }
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

  writeVoicePackArtifacts();
  return {
    dryRun: false,
    generated,
    skipped,
  };
}

export function createAllVoicePackPlans(): ReturnType<typeof createVoicePackSpeechPlan> {
  return VOICE_PACKS.flatMap((pack) =>
    createVoicePackSpeechPlan(pack.id as VoicePackId, readConfiguredVoiceId(pack.id as VoicePackId)),
  );
}

function selectVoicePackAssets(
  plan: ReturnType<typeof createVoicePackSpeechPlan>,
  options: GenerateOptions,
  missingFirst: boolean,
): ReturnType<typeof createVoicePackSpeechPlan> {
  const candidates = plan.filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId);
  const sortedCandidates = missingFirst && !options.force
    ? [
        ...candidates.filter((asset) => !assetOutputMatchesProvenance(asset)),
        ...candidates.filter((asset) => assetOutputMatchesProvenance(asset)),
      ]
    : candidates;

  return sortedCandidates.slice(0, options.maxFiles);
}

function readConfiguredVoiceId(packId: VoicePackId): string | undefined {
  const envKey = packId === 'announcer-a'
    ? process.env.FOOTBALL_ANNOUNCER_A_VOICE_ID ?? process.env.FOOTBALL_ANNOUNCER_VOICE_ID
    : process.env.FOOTBALL_ANNOUNCER_B_VOICE_ID;
  return envKey?.trim() || undefined;
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
  const args = process.argv.slice(2);
  const options = parseGenerateOptions(args);
  Promise.resolve()
    .then(() => {
      if (options.execute && !args.some((arg) => arg.startsWith('--max-files='))) {
        throw new Error('Voice-pack paid generation requires an explicit --max-files value.');
      }
      return generateVoicePacks(options);
    })
    .then((summary) => {
      console.log(JSON.stringify({
        ...summary,
        manifests: VOICE_PACKS.map((pack) => createVoicePackManifest(pack.id as VoicePackId).id),
      }, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
