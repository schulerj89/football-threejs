import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
  resolveRepoPath,
  toRepoRelativePath,
  type AudioOutputFormat,
} from './schemas';

type ElevenLabsClientInstance = InstanceType<typeof ElevenLabsClient>;

export interface QuarterbackCadenceVoiceConfig {
  createdAt: string;
  description: string;
  displayName: string;
  previewVoiceIds: string[];
  selectedVoiceId: string;
  sourceGeneratedVoiceId: string;
  temporaryPrototype: boolean;
}

export interface QuarterbackCadenceVoicePreviewMetadata {
  createdAt: string;
  description: string;
  durationSeconds: number;
  generatedVoiceId: string;
  language?: string;
  mediaType: string;
  outputPath: string;
  previewIndex: number;
  previewText: string;
}

interface DesignedVoicePreview {
  audioBase64: string;
  durationSecs: number;
  generatedVoiceId: string;
  language?: string;
  mediaType: string;
}

export interface EnsureQuarterbackCadenceVoiceOptions {
  execute: boolean;
}

export const QUARTERBACK_CADENCE_VOICE_CONFIG_PATH = 'tools/audio/quarterbackCadenceVoiceConfig.json';
export const QUARTERBACK_CADENCE_VOICE_PREVIEW_DIR = 'public/audio/sfx/qb-cadence-voice-previews';
export const QUARTERBACK_CADENCE_VOICE_DESIGN_MODEL_ID = 'eleven_multilingual_ttv_v2';
export const QUARTERBACK_CADENCE_VOICE_OUTPUT_FORMAT: AudioOutputFormat = 'mp3_44100_128';
export const QUARTERBACK_CADENCE_VOICE_ID_PLACEHOLDER = 'quarterback-cadence-voice-unconfigured';
export const QUARTERBACK_CADENCE_VOICE_DESCRIPTION = [
  'Original fictional American-football quarterback cadence voice for a stylized low-poly video game.',
  'Young adult quarterback, confident, short and forceful, clean and generic.',
  'Do not imitate any named person, real player, celebrity, or recognizable cadence.',
].join(' ');
export const QUARTERBACK_CADENCE_VOICE_PREVIEW_TEXT = [
  'Ready! Hut! Hut!',
  'Set at the line, strong and clear. Ready! Hut!',
  'Short confident cadence, fast command, clean football voice.',
].join(' ');

export function readConfiguredQuarterbackCadenceVoiceId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const envVoiceId = env.FOOTBALL_QB_CADENCE_VOICE_ID?.trim();

  if (envVoiceId) {
    return envVoiceId;
  }

  const config = readQuarterbackCadenceVoiceConfig();
  return config?.selectedVoiceId ?? null;
}

export function readQuarterbackCadenceVoiceConfig(): QuarterbackCadenceVoiceConfig | null {
  const configPath = resolveRepoPath(QUARTERBACK_CADENCE_VOICE_CONFIG_PATH);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as QuarterbackCadenceVoiceConfig;
  } catch {
    return null;
  }
}

export async function ensureQuarterbackCadenceVoice(
  client: ElevenLabsClientInstance,
  options: EnsureQuarterbackCadenceVoiceOptions,
): Promise<QuarterbackCadenceVoiceConfig | null> {
  const configuredVoiceId = readConfiguredQuarterbackCadenceVoiceId();

  if (configuredVoiceId) {
    return readQuarterbackCadenceVoiceConfig() ?? {
      createdAt: new Date().toISOString(),
      description: QUARTERBACK_CADENCE_VOICE_DESCRIPTION,
      displayName: 'Football JS Quarterback Cadence',
      previewVoiceIds: [],
      selectedVoiceId: configuredVoiceId,
      sourceGeneratedVoiceId: configuredVoiceId,
      temporaryPrototype: false,
    };
  }

  if (!options.execute) {
    return null;
  }

  const previews = await resolveOrCreateVoicePreviews(client);
  const selectedPreview = previews[0];
  const createdVoice = await client.textToVoice.create({
    generatedVoiceId: selectedPreview.generatedVoiceId,
    labels: {
      project: 'football-threejs',
      role: 'quarterback-cadence',
      temporary: 'true',
    },
    playedNotSelectedVoiceIds: previews.slice(1).map((preview) => preview.generatedVoiceId),
    voiceDescription: QUARTERBACK_CADENCE_VOICE_DESCRIPTION,
    voiceName: 'Football JS Quarterback Cadence Temporary',
  });
  const config: QuarterbackCadenceVoiceConfig = {
    createdAt: new Date().toISOString(),
    description: QUARTERBACK_CADENCE_VOICE_DESCRIPTION,
    displayName: 'Football JS Quarterback Cadence Temporary',
    previewVoiceIds: previews.map((preview) => preview.generatedVoiceId),
    selectedVoiceId: createdVoice.voiceId,
    sourceGeneratedVoiceId: selectedPreview.generatedVoiceId,
    temporaryPrototype: true,
  };

  writeJsonFile(QUARTERBACK_CADENCE_VOICE_CONFIG_PATH, config);
  return config;
}

async function resolveOrCreateVoicePreviews(
  client: ElevenLabsClientInstance,
): Promise<QuarterbackCadenceVoicePreviewMetadata[]> {
  const existingPreviews = readExistingPreviewMetadata();

  if (existingPreviews.length >= 3) {
    return existingPreviews.slice(0, 3);
  }

  const response = await client.textToVoice.design({
    autoGenerateText: false,
    guidanceScale: 6,
    loudness: 0,
    modelId: QUARTERBACK_CADENCE_VOICE_DESIGN_MODEL_ID,
    outputFormat: QUARTERBACK_CADENCE_VOICE_OUTPUT_FORMAT,
    quality: 0.8,
    seed: 11212,
    shouldEnhance: false,
    streamPreviews: false,
    text: QUARTERBACK_CADENCE_VOICE_PREVIEW_TEXT,
    voiceDescription: QUARTERBACK_CADENCE_VOICE_DESCRIPTION,
  });
  const designedPreviews = response.previews as DesignedVoicePreview[];
  const previews = designedPreviews.slice(0, 3).map((preview, index) => {
    const outputPath = `${QUARTERBACK_CADENCE_VOICE_PREVIEW_DIR}/qb_cadence_voice_preview_${String(index + 1).padStart(2, '0')}.mp3`;
    const metadata: QuarterbackCadenceVoicePreviewMetadata = {
      createdAt: new Date().toISOString(),
      description: QUARTERBACK_CADENCE_VOICE_DESCRIPTION,
      durationSeconds: preview.durationSecs,
      generatedVoiceId: preview.generatedVoiceId,
      language: preview.language,
      mediaType: preview.mediaType,
      outputPath,
      previewIndex: index + 1,
      previewText: response.text,
    };

    writeBinaryFile(outputPath, Buffer.from(preview.audioBase64, 'base64'));
    writeJsonFile(`${outputPath}.json`, metadata);
    return metadata;
  });

  if (previews.length < 3) {
    throw new Error(`Expected three quarterback cadence voice previews, received ${previews.length}.`);
  }

  return previews;
}

function readExistingPreviewMetadata(): QuarterbackCadenceVoicePreviewMetadata[] {
  const previews: QuarterbackCadenceVoicePreviewMetadata[] = [];

  for (let index = 1; index <= 3; index += 1) {
    const outputPath = `${QUARTERBACK_CADENCE_VOICE_PREVIEW_DIR}/qb_cadence_voice_preview_${String(index).padStart(2, '0')}.mp3`;
    const metadataPath = `${resolveRepoPath(outputPath)}.json`;

    if (!existsSync(resolveRepoPath(outputPath)) || !existsSync(metadataPath)) {
      continue;
    }

    previews.push(JSON.parse(readFileSync(metadataPath, 'utf8')) as QuarterbackCadenceVoicePreviewMetadata);
  }

  return previews;
}

function writeBinaryFile(relativePath: string, content: Uint8Array): void {
  const absolutePath = resolveRepoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function writeJsonFile(relativePath: string, value: unknown): void {
  const absolutePath = resolveRepoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function getQuarterbackCadenceVoiceConfigPath(): string {
  return toRepoRelativePath(resolveRepoPath(QUARTERBACK_CADENCE_VOICE_CONFIG_PATH));
}
