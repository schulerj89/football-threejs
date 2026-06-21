import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ANNOUNCER_IDENTITY } from './announcerScriptCatalog';
import {
  resolveRepoPath,
  toRepoRelativePath,
  type AudioOutputFormat,
} from './schemas';

type ElevenLabsClientInstance = InstanceType<typeof ElevenLabsClient>;

export interface AnnouncerVoiceConfig {
  createdAt: string;
  description: string;
  displayName: string;
  previewVoiceIds: string[];
  selectedVoiceId: string;
  sourceGeneratedVoiceId: string;
  temporaryPrototype: boolean;
}

export interface AnnouncerVoicePreviewMetadata {
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

export interface EnsureAnnouncerVoiceOptions {
  execute: boolean;
}

export const ANNOUNCER_VOICE_CONFIG_PATH = 'tools/audio/announcerVoiceConfig.json';
export const ANNOUNCER_VOICE_PREVIEW_DIR = 'public/audio/announcer/voice-previews';
export const ANNOUNCER_VOICE_DESIGN_MODEL_ID = 'eleven_multilingual_ttv_v2';
export const ANNOUNCER_VOICE_OUTPUT_FORMAT: AudioOutputFormat = 'mp3_44100_128';
export const ANNOUNCER_VOICE_DESCRIPTION = [
  'Original fictional American-football broadcaster for a stylized low-poly video game.',
  'Energetic but controlled, clear modern broadcast delivery, warm and authoritative.',
  'Capable of excitement without shouting every line.',
  'Do not imitate any named person, real broadcaster, celebrity, or recognizable catchphrase.',
].join(' ');
export const ANNOUNCER_VOICE_PREVIEW_TEXT = [
  'Fresh snap coming, and the offense is set.',
  'Pressure arrives quickly, but the call stays clear and controlled.',
  'He finds daylight and finishes the drive with authority.',
].join(' ');

export function readConfiguredAnnouncerVoiceId(env: NodeJS.ProcessEnv = process.env): string | null {
  const envVoiceId = env.FOOTBALL_ANNOUNCER_VOICE_ID?.trim();

  if (envVoiceId) {
    return envVoiceId;
  }

  const config = readAnnouncerVoiceConfig();
  return config?.selectedVoiceId ?? null;
}

export function readAnnouncerVoiceConfig(): AnnouncerVoiceConfig | null {
  const configPath = resolveRepoPath(ANNOUNCER_VOICE_CONFIG_PATH);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as AnnouncerVoiceConfig;
  } catch {
    return null;
  }
}

export async function ensureAnnouncerVoice(
  client: ElevenLabsClientInstance,
  options: EnsureAnnouncerVoiceOptions,
): Promise<AnnouncerVoiceConfig | null> {
  const configuredVoiceId = readConfiguredAnnouncerVoiceId();

  if (configuredVoiceId) {
    return readAnnouncerVoiceConfig() ?? {
      createdAt: new Date().toISOString(),
      description: ANNOUNCER_VOICE_DESCRIPTION,
      displayName: ANNOUNCER_IDENTITY.displayName,
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
      role: 'prototype-announcer',
      temporary: 'true',
    },
    playedNotSelectedVoiceIds: previews.slice(1).map((preview) => preview.generatedVoiceId),
    voiceDescription: ANNOUNCER_VOICE_DESCRIPTION,
    voiceName: `${ANNOUNCER_IDENTITY.displayName} Temporary`,
  });
  const config: AnnouncerVoiceConfig = {
    createdAt: new Date().toISOString(),
    description: ANNOUNCER_VOICE_DESCRIPTION,
    displayName: `${ANNOUNCER_IDENTITY.displayName} Temporary`,
    previewVoiceIds: previews.map((preview) => preview.generatedVoiceId),
    selectedVoiceId: createdVoice.voiceId,
    sourceGeneratedVoiceId: selectedPreview.generatedVoiceId,
    temporaryPrototype: true,
  };

  writeJsonFile(ANNOUNCER_VOICE_CONFIG_PATH, config);
  return config;
}

async function resolveOrCreateVoicePreviews(
  client: ElevenLabsClientInstance,
): Promise<AnnouncerVoicePreviewMetadata[]> {
  const existingPreviews = readExistingPreviewMetadata();

  if (existingPreviews.length >= 3) {
    return existingPreviews.slice(0, 3);
  }

  const response = await client.textToVoice.design({
    autoGenerateText: false,
    guidanceScale: 6,
    loudness: 0,
    modelId: ANNOUNCER_VOICE_DESIGN_MODEL_ID,
    outputFormat: ANNOUNCER_VOICE_OUTPUT_FORMAT,
    quality: 0.85,
    seed: 4242,
    shouldEnhance: false,
    streamPreviews: false,
    text: ANNOUNCER_VOICE_PREVIEW_TEXT,
    voiceDescription: ANNOUNCER_VOICE_DESCRIPTION,
  });
  const previews = response.previews.slice(0, 3).map((preview, index) => {
    const outputPath = `${ANNOUNCER_VOICE_PREVIEW_DIR}/announcer_voice_preview_${String(index + 1).padStart(2, '0')}.mp3`;
    const metadata: AnnouncerVoicePreviewMetadata = {
      createdAt: new Date().toISOString(),
      description: ANNOUNCER_VOICE_DESCRIPTION,
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
    throw new Error(`Expected three announcer voice previews, received ${previews.length}.`);
  }

  return previews;
}

function readExistingPreviewMetadata(): AnnouncerVoicePreviewMetadata[] {
  const previews: AnnouncerVoicePreviewMetadata[] = [];

  for (let index = 1; index <= 3; index += 1) {
    const outputPath = `${ANNOUNCER_VOICE_PREVIEW_DIR}/announcer_voice_preview_${String(index).padStart(2, '0')}.mp3`;
    const metadataPath = `${resolveRepoPath(outputPath)}.json`;

    if (!existsSync(resolveRepoPath(outputPath)) || !existsSync(metadataPath)) {
      continue;
    }

    previews.push(JSON.parse(readFileSync(metadataPath, 'utf8')) as AnnouncerVoicePreviewMetadata);
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

export function getAnnouncerVoiceConfigPath(): string {
  return toRepoRelativePath(resolveRepoPath(ANNOUNCER_VOICE_CONFIG_PATH));
}
