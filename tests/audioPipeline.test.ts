import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ANNOUNCER_AUDITION_PAGE_PATH,
  ANNOUNCER_CAPTION_MANIFEST_PATH,
  writeAnnouncerArtifacts,
} from '../tools/audio/announcerArtifacts';
import {
  ANNOUNCER_SCRIPT_CATALOG,
  createAnnouncerSpeechPlan,
  validateAnnouncerScriptCatalog,
} from '../tools/audio/announcerScriptCatalog';
import { FOOTBALL_AUDIO_PLAN, FOOTBALL_SFX_AUDIO_PLAN, validateFootballAudioPlan } from '../tools/audio/audioPlan';
import { createFootballAudioReport, writeFootballAudioReportFiles } from '../tools/audio/audioReport';
import { createAudioVerificationReport, writeAudioVerificationArtifacts } from '../tools/audio/audioVerify';
import { generateSoundEffects } from '../tools/audio/generateSoundEffects';
import { generateSpeech } from '../tools/audio/generateSpeech';
import {
  createAudioPlanReport,
  createProvenance,
  findBrowserSecretReferences,
  validateAudioPlan,
  type AudioAssetPlan,
  type GenerateOptions,
} from '../tools/audio/schemas';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  execute: false,
  force: false,
  maxFiles: 1,
  retryCount: 1,
};

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  if (ORIGINAL_ELEVENLABS_API_KEY === undefined) {
    delete process.env.ELEVENLABS_API_KEY;
  } else {
    process.env.ELEVENLABS_API_KEY = ORIGINAL_ELEVENLABS_API_KEY;
  }
});

describe('audio production pipeline', () => {
  it('validates the typed football audio generation plan', () => {
    expect(validateFootballAudioPlan()).toEqual([]);
    expect(validateAudioPlan(FOOTBALL_AUDIO_PLAN)).toEqual([]);
    expect(FOOTBALL_SFX_AUDIO_PLAN).toHaveLength(15);
    expect(FOOTBALL_AUDIO_PLAN).toHaveLength(42);
    expect(FOOTBALL_SFX_AUDIO_PLAN.every((asset) => asset.modelId === 'eleven_text_to_sound_v2')).toBe(true);
    expect(FOOTBALL_AUDIO_PLAN.every((asset) => asset.outputFormat === 'mp3_44100_128')).toBe(true);
    expect(FOOTBALL_AUDIO_PLAN.filter((asset) => asset.category === 'announcer')).toHaveLength(27);
    expect(FOOTBALL_SFX_AUDIO_PLAN.every((asset) => asset.category !== 'announcer')).toBe(true);
    expect(FOOTBALL_SFX_AUDIO_PLAN.every((asset) => !asset.script)).toBe(true);
    expect(
      FOOTBALL_AUDIO_PLAN.filter((asset) => asset.loop).every(
        (asset) => asset.runtimeLoadingStrategy === 'stream',
      ),
    ).toBe(true);
    expect(
      FOOTBALL_AUDIO_PLAN.filter((asset) => !asset.loop).every(
        (asset) => asset.runtimeLoadingStrategy === 'buffer',
      ),
    ).toBe(true);
    expect(
      FOOTBALL_AUDIO_PLAN.every(
        (asset) =>
          asset.assetId &&
          asset.category &&
          (asset.prompt || asset.script) &&
          asset.modelId &&
          asset.requestedDurationSeconds > 0 &&
          asset.outputFormat &&
          asset.outputPath &&
          asset.generationStatus &&
          asset.runtimeLoadingStrategy,
      ),
    ).toBe(true);
  });

  it('validates the controlled announcer script catalog and exact captions', () => {
    expect(validateAnnouncerScriptCatalog()).toEqual([]);
    expect(ANNOUNCER_SCRIPT_CATALOG).toHaveLength(27);
    expect(ANNOUNCER_SCRIPT_CATALOG.every((script) => script.caption === script.script)).toBe(true);
    expect(ANNOUNCER_SCRIPT_CATALOG.filter((script) => script.eventCategory === 'firstDown')).toHaveLength(3);
    expect(ANNOUNCER_SCRIPT_CATALOG.filter((script) => script.eventCategory === 'touchdown')).toHaveLength(3);
    expect(ANNOUNCER_SCRIPT_CATALOG.filter((script) => script.eventCategory === 'sack')).toHaveLength(3);
    expect(ANNOUNCER_SCRIPT_CATALOG.filter((script) => script.eventCategory === 'bigGain')).toHaveLength(3);
    expect(ANNOUNCER_SCRIPT_CATALOG.filter((script) => script.eventCategory === 'incomplete')).toHaveLength(3);
  });

  it('fails paid execution when ELEVENLABS_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.ELEVENLABS_API_KEY;

      await expect(
        generateSpeech(FOOTBALL_AUDIO_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        }),
      ).rejects.toThrow(/Missing ELEVENLABS_API_KEY/);
    });
  });

  it('keeps dry-run generation from constructing an API client or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let clientFactoryCalled = false;
      const summary = await generateSoundEffects(
        FOOTBALL_AUDIO_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          maxFiles: 2,
        },
        {
          clientFactory: async () => {
            clientFactoryCalled = true;
            throw new Error('dry-run should not create an ElevenLabs client');
          },
        },
      );

      expect(summary).toMatchObject({
        dryRun: true,
        generated: [],
      });
      expect(summary.skipped).toHaveLength(2);
      expect(clientFactoryCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/audio/crowd/crowd_idle_loop_01.mp3'))).toBe(false);
    });
  });

  it('writes announcer caption and audition artifacts from the script catalog', async () => {
    await withTemporaryCwd(async (cwd) => {
      const speechPlan = createAnnouncerSpeechPlan('voice-test');
      const written = writeAnnouncerArtifacts(speechPlan);
      const captions = JSON.parse(readFileSync(join(cwd, ANNOUNCER_CAPTION_MANIFEST_PATH), 'utf8')) as {
        scripts: Array<{ caption: string; script: string; voiceId: string }>;
      };

      expect(written).toEqual({
        auditionPagePath: ANNOUNCER_AUDITION_PAGE_PATH,
        captionManifestPath: ANNOUNCER_CAPTION_MANIFEST_PATH,
      });
      expect(captions.scripts).toHaveLength(27);
      expect(captions.scripts.every((entry) => entry.caption === entry.script)).toBe(true);
      expect(captions.scripts.every((entry) => entry.voiceId === 'voice-test')).toBe(true);
      expect(readFileSync(join(cwd, ANNOUNCER_AUDITION_PAGE_PATH), 'utf8')).toContain('Grant Mercer');
    });
  });

  it('generates voice previews, selects a temporary prototype voice, and skips identical speech on rerun', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      let designCalls = 0;
      let createVoiceCalls = 0;
      let speechCalls = 0;
      const fakeClient = {
        textToSpeech: {
          convert: async () => {
            speechCalls += 1;
            return createReadableStreamFromText('mp3-audio');
          },
        },
        textToVoice: {
          create: async () => {
            createVoiceCalls += 1;
            return { voiceId: 'voice-prototype' };
          },
          design: async () => {
            designCalls += 1;
            return {
              previews: [1, 2, 3].map((index) => ({
                audioBase64: Buffer.from(`preview-${index}`).toString('base64'),
                durationSecs: 1.25,
                generatedVoiceId: `generated-preview-${index}`,
                language: 'en',
                mediaType: 'audio/mpeg',
              })),
              text: 'Preview text for the fictional prototype announcer voice.',
            };
          },
        },
      };

      const firstRun = await generateSpeech(
        FOOTBALL_AUDIO_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        },
        {
          clientFactory: async () => fakeClient as never,
        },
      );
      const secondRun = await generateSpeech(
        FOOTBALL_AUDIO_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        },
        {
          clientFactory: async () => fakeClient as never,
        },
      );

      expect(firstRun.generated).toEqual(['ann_game_opening_01']);
      expect(secondRun.generated).toEqual([]);
      expect(secondRun.skipped).toEqual(['ann_game_opening_01']);
      expect(designCalls).toBe(1);
      expect(createVoiceCalls).toBe(1);
      expect(speechCalls).toBe(1);
      expect(existsSync(join(cwd, 'public/audio/announcer/voice-previews/announcer_voice_preview_01.mp3'))).toBe(true);
      const sidecar = JSON.parse(readFileSync(join(cwd, 'public/audio/announcer/ann_game_opening_01.mp3.json'), 'utf8')) as {
        caption: string;
        compressedBytes: number;
        scriptId: string;
        voiceId: string;
      };
      expect(sidecar).toMatchObject({
        caption: 'Settle in. The offense has a short field and a ticking clock.',
        scriptId: 'ann_game_opening_01',
        voiceId: 'voice-prototype',
      });
      expect(sidecar.compressedBytes).toBeGreaterThan(0);
      expect(existsSync(join(cwd, ANNOUNCER_CAPTION_MANIFEST_PATH))).toBe(true);
      expect(existsSync(join(cwd, ANNOUNCER_AUDITION_PAGE_PATH))).toBe(true);
    });
  });

  it('skips existing files before any paid request can start', async () => {
    await withTemporaryCwd(async (cwd) => {
      delete process.env.ELEVENLABS_API_KEY;
      const existingPath = join(cwd, 'public/audio/crowd/crowd_idle_loop_01.mp3');
      mkdirSync(join(cwd, 'public/audio/crowd'), { recursive: true });
      writeFileSync(existingPath, 'existing audio placeholder');
      let clientFactoryCalled = false;

      await expect(
        generateSoundEffects(
          FOOTBALL_AUDIO_PLAN,
          {
            ...DEFAULT_GENERATE_OPTIONS,
            execute: true,
          },
          {
            clientFactory: async () => {
              clientFactoryCalled = true;
              throw new Error('existing-only generation should not construct a client');
            },
          },
        ),
      ).resolves.toEqual({
        dryRun: false,
        generated: [],
        skipped: ['crowd_idle_loop_01'],
      });
      expect(clientFactoryCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing audio placeholder');
    });
  });

  it('requires an API key when at least one paid asset is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.ELEVENLABS_API_KEY;

      await expect(
        generateSoundEffects(FOOTBALL_AUDIO_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        }),
      ).rejects.toThrow(/Missing ELEVENLABS_API_KEY/);
    });
  });

  it('rejects invalid output paths', () => {
    const invalidAsset: AudioAssetPlan = {
      ...FOOTBALL_AUDIO_PLAN[0],
      assetId: 'invalid-output-path',
      outputPath: 'src/audio/invalid.mp3',
    };

    expect(validateAudioPlan([invalidAsset])).toContain(
      'invalid-output-path: outputPath must stay under public/audio/crowd',
    );
  });

  it('reports duration, streaming, and one-shot decoded-memory policy without an API key', async () => {
    await withTemporaryCwd(async (cwd) => {
      const loopAsset = FOOTBALL_AUDIO_PLAN[0];
      const oneShotAsset = FOOTBALL_AUDIO_PLAN.find((asset) => asset.assetId === 'pads_hit_01')!;
      mkdirSync(join(cwd, 'public/audio/crowd'), { recursive: true });
      mkdirSync(join(cwd, 'public/audio/sfx'), { recursive: true });
      writeFileSync(join(cwd, loopAsset.outputPath), 'loop placeholder');
      writeFileSync(join(cwd, oneShotAsset.outputPath), 'one-shot placeholder');

      const report = createFootballAudioReport([loopAsset, oneShotAsset], '2026-06-21T00:00:00.000Z');

      expect(report.validationErrors).toEqual([]);
      expect(report.totalCompressedBytes).toBeGreaterThan(0);
      expect(report.assets[0]).toMatchObject({
        assetId: 'crowd_idle_loop_01',
        runtimeLoadingStrategy: 'stream',
        decodedMemoryBytes: null,
      });
      expect(report.assets[1].runtimeLoadingStrategy).toBe('buffer');
      expect(report.assets[1].decodedMemoryBytes).toBeGreaterThan(0);

      const written = writeFootballAudioReportFiles(report);
      expect(existsSync(join(cwd, written.reportPath))).toBe(true);
      expect(readFileSync(join(cwd, written.auditionIndexPath), 'utf8')).toContain('Football SFX Audition Index');
    });
  });

  it('writes verification readiness artifacts without an API key', async () => {
    await withTemporaryCwd(async (cwd) => {
      const report = createAudioVerificationReport([FOOTBALL_AUDIO_PLAN[0]], []);
      const written = writeAudioVerificationArtifacts(report);

      expect(report.readiness).toBe('unavailable');
      expect(report.missingAssetIds).toEqual(['crowd_idle_loop_01']);
      expect(existsSync(join(cwd, written.reportPath))).toBe(true);
      expect(existsSync(join(cwd, written.readinessPath))).toBe(true);
      expect(readFileSync(join(cwd, written.auditionIndexPath), 'utf8')).toContain(
        'Football Audio Audition Index',
      );
    });
  });

  it('keeps secrets out of browser source and generated manifests', () => {
    const browserSourceFiles = readSourceFiles(join(ORIGINAL_CWD, 'src'));
    const secret = 'test-secret-value';
    process.env.ELEVENLABS_API_KEY = secret;

    const reportText = JSON.stringify(createAudioPlanReport(FOOTBALL_AUDIO_PLAN));
    const cliReportText = JSON.stringify(createFootballAudioReport());
    const provenanceText = JSON.stringify(
      createProvenance(FOOTBALL_AUDIO_PLAN[0], new Uint8Array([1, 2, 3]), '2026-06-21T00:00:00.000Z'),
    );

    expect(findBrowserSecretReferences(browserSourceFiles)).toEqual([]);
    expect(reportText).not.toContain(secret);
    expect(cliReportText).not.toContain(secret);
    expect(provenanceText).not.toContain(secret);
    expect(provenanceText).not.toContain('xi-api-key');
    expect(provenanceText).not.toContain('VITE_ELEVENLABS');
  });
});

function createReadableStreamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function withTemporaryCwd(run: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'football-audio-test-'));

  try {
    process.chdir(cwd);
    await run(cwd);
  } finally {
    process.chdir(ORIGINAL_CWD);
    rmSync(cwd, { force: true, recursive: true });
  }
}

function readSourceFiles(directory: string): Array<{ path: string; text: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return readSourceFiles(path);
    }
    if (!entry.name.endsWith('.ts')) {
      return [];
    }

    return [{ path, text: readFileSync(path, 'utf8') }];
  });
}
