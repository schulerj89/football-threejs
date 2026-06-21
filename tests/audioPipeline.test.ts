import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FOOTBALL_AUDIO_PLAN, validateFootballAudioPlan } from '../tools/audio/audioPlan';
import { createFootballAudioReport } from '../tools/audio/audioReport';
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
    expect(FOOTBALL_AUDIO_PLAN.length).toBeGreaterThan(0);
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
          asset.generationStatus,
      ),
    ).toBe(true);
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
      expect(existsSync(join(cwd, 'public/audio/sfx/player-footstep-turf-light.mp3'))).toBe(false);
    });
  });

  it('protects existing files before any paid request can start', async () => {
    await withTemporaryCwd(async (cwd) => {
      delete process.env.ELEVENLABS_API_KEY;
      const existingPath = join(cwd, 'public/audio/sfx/player-footstep-turf-light.mp3');
      mkdirSync(join(cwd, 'public/audio/sfx'), { recursive: true });
      writeFileSync(existingPath, 'existing audio placeholder');

      await expect(
        generateSoundEffects(FOOTBALL_AUDIO_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        }),
      ).rejects.toThrow(/already exists/);
    });
  });

  it('rejects invalid output paths', () => {
    const invalidAsset: AudioAssetPlan = {
      ...FOOTBALL_AUDIO_PLAN[0],
      assetId: 'invalid-output-path',
      outputPath: 'src/audio/invalid.mp3',
    };

    expect(validateAudioPlan([invalidAsset])).toContain(
      'invalid-output-path: outputPath must stay under public/audio/sfx',
    );
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
