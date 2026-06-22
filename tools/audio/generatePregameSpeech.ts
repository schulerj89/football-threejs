import { ensureAnnouncerVoice, readConfiguredAnnouncerVoiceId } from './announcerVoice';
import {
  createElevenLabsClient,
  type ElevenLabsClientInstance,
} from './elevenLabsClient';
import {
  createPregameSpeechPlan,
  writePregameArtifacts,
} from './pregameScriptCatalog';
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
  type AudioAssetPlan,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';

export interface PregameSpeechGenerationDependencies {
  clientFactory?: (apiKey: string) => Promise<ElevenLabsClientInstance>;
}

export async function generatePregameSpeech(
  options: GenerateOptions,
  dependencies: PregameSpeechGenerationDependencies = {},
): Promise<GenerateSummary> {
  const initialPlan = createPregameSpeechPlan(readConfiguredAnnouncerVoiceId() ?? undefined);
  assertValidAudioPlan(initialPlan);

  if (!options.execute) {
    const selectedAssets = selectPregameAssets(initialPlan, options, false);
    writePregameArtifacts(initialPlan);
    return {
      dryRun: true,
      generated: [],
      skipped: selectedAssets.map((asset) => asset.assetId),
    };
  }

  const preliminarilySelectedAssets = selectPregameAssets(initialPlan, options, true);
  const preliminarilyMissing = preliminarilySelectedAssets.filter(
    (asset) => options.force || !assetOutputMatchesProvenance(asset),
  );

  if (preliminarilyMissing.length > 0) {
    try {
      requireElevenLabsApiKey();
    } catch (error) {
      writePregameArtifacts(initialPlan);
      const missingList = preliminarilyMissing.map((asset) => asset.assetId).join(', ');
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} Missing pregame assets: ${missingList}`,
      );
    }
  }
  if (preliminarilyMissing.length === 0) {
    writePregameArtifacts(initialPlan);
    return {
      dryRun: false,
      generated: [],
      skipped: preliminarilySelectedAssets.map((asset) => asset.assetId),
    };
  }

  const apiKey = requireElevenLabsApiKey();
  const client = dependencies.clientFactory
    ? await dependencies.clientFactory(apiKey)
    : await createElevenLabsClient(apiKey);
  const announcerVoice = await ensureAnnouncerVoice(client, { execute: options.execute });
  const plan = createPregameSpeechPlan(announcerVoice?.selectedVoiceId ?? readConfiguredAnnouncerVoiceId() ?? undefined);
  assertValidAudioPlan(plan);

  const selectedAssets = selectPregameAssets(plan, options, true);
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

  writePregameArtifacts(plan);

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

function selectPregameAssets(
  plan: readonly AudioAssetPlan[],
  options: GenerateOptions,
  missingFirst: boolean,
): AudioAssetPlan[] {
  const candidates = plan
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId);
  const sortedCandidates = missingFirst && !options.force
    ? [
        ...candidates.filter((asset) => !assetOutputMatchesProvenance(asset)),
        ...candidates.filter((asset) => assetOutputMatchesProvenance(asset)),
      ]
    : candidates;

  return sortedCandidates.slice(0, options.maxFiles);
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
        throw new Error('Pregame paid generation requires an explicit --max-files value.');
      }

      return generatePregameSpeech(options);
    })
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
