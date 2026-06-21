import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FOOTBALL_TITLE_MUSIC_DURATION_MS, FOOTBALL_TITLE_MUSIC_PLAN } from './musicPlan';
import {
  assetOutputExists,
  assertCanWriteAsset,
  assertValidAudioPlan,
  isDirectCli,
  parseGenerateOptions,
  readAudioDurationSeconds,
  requireElevenLabsApiKey,
  resolveRepoPath,
  writeProvenanceSidecar,
  type AudioAssetPlan,
  type GenerateOptions,
  type GenerateSummary,
} from './schemas';

const MAX_TITLE_MUSIC_CANDIDATES = 3;

export interface MusicGenerationDependencies {
  requestMusic?: (asset: AudioAssetPlan, apiKey: string) => Promise<MusicGenerationResult>;
}

export interface MusicGenerationResult {
  content: Uint8Array;
  songId?: string;
}

export async function generateMusic(
  plan: readonly AudioAssetPlan[],
  options: GenerateOptions,
  dependencies: MusicGenerationDependencies = {},
): Promise<GenerateSummary> {
  assertValidAudioPlan(plan);
  if (options.maxFiles > MAX_TITLE_MUSIC_CANDIDATES) {
    throw new Error(`Title music generation is capped at ${MAX_TITLE_MUSIC_CANDIDATES} candidates per execution.`);
  }

  const selectedAssets = plan
    .filter((asset) => asset.category === 'music')
    .filter((asset) => !options.onlyAssetId || asset.assetId === options.onlyAssetId)
    .slice(0, options.maxFiles);

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
  const assetsToGenerate = selectedAssets.filter((asset) => options.force || !assetOutputExists(asset));

  for (const asset of assetsToGenerate) {
    assertCanWriteAsset(asset, options.force);
  }

  if (assetsToGenerate.length === 0) {
    return {
      dryRun: false,
      generated: [],
      skipped,
    };
  }

  const apiKey = requireElevenLabsApiKey();
  const requestMusic = dependencies.requestMusic ?? requestElevenLabsMusic;
  const generated: string[] = [];

  for (const asset of assetsToGenerate) {
    const result = await withSingleRetry(options.retryCount, () => requestMusic(asset, apiKey));
    writeMusicBytes(asset, result.content);
    writeProvenanceSidecar(
      asset,
      result.content,
      undefined,
      readAudioDurationSeconds(asset.outputPath),
      result.songId,
    );
    generated.push(asset.assetId);
  }

  return {
    dryRun: false,
    generated,
    skipped,
  };
}

async function requestElevenLabsMusic(asset: AudioAssetPlan, apiKey: string): Promise<MusicGenerationResult> {
  const url = new URL('https://api.elevenlabs.io/v1/music');
  url.searchParams.set('output_format', asset.outputFormat);
  const response = await fetch(url, {
    body: JSON.stringify({
      force_instrumental: true,
      model_id: asset.modelId,
      music_length_ms: FOOTBALL_TITLE_MUSIC_DURATION_MS,
      prompt: asset.prompt ?? '',
    }),
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ElevenLabs music generation failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  return {
    content: new Uint8Array(await response.arrayBuffer()),
    songId: response.headers.get('song-id') ?? response.headers.get('x-song-id') ?? undefined,
  };
}

function writeMusicBytes(asset: AudioAssetPlan, content: Uint8Array): void {
  const outputPath = resolveRepoPath(asset.outputPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content);
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
  const options = parseGenerateOptions(process.argv.slice(2));
  generateMusic(FOOTBALL_TITLE_MUSIC_PLAN, options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      if (error instanceof Error && /Missing ELEVENLABS_API_KEY/.test(error.message)) {
        console.log(JSON.stringify({
          dryRunPlan: FOOTBALL_TITLE_MUSIC_PLAN,
          validationErrors: [],
        }, null, 2));
      }
      process.exitCode = 1;
    });
}
