import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PREGAME_COMMENTARY_CATALOG,
  listKnownStartingQuarterbacks,
  resolveMatchupLine,
  resolvePregameWelcome,
  resolveQuarterbackSpotlight,
  resolveWeatherLine,
  validatePregameCommentaryCatalog,
} from '../src/audio/PregameCommentaryCatalog';
import { listTeamProfiles } from '../src/teams/TeamRegistry';
import {
  PREGAME_AUDITION_PAGE_PATH,
  PREGAME_CAPTION_MANIFEST_PATH,
  createPregameSpeechPlan,
  validatePregameScriptCatalog,
  writePregameArtifacts,
} from '../tools/audio/pregameScriptCatalog';
import { generatePregameSpeech } from '../tools/audio/generatePregameSpeech';
import {
  findBrowserSecretReferences,
  validateAudioPlan,
  type GenerateOptions,
} from '../tools/audio/schemas';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ORIGINAL_ANNOUNCER_VOICE_ID = process.env.FOOTBALL_ANNOUNCER_VOICE_ID;

const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  execute: false,
  force: false,
  maxFiles: 1,
  retryCount: 1,
};

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  restoreEnv('ELEVENLABS_API_KEY', ORIGINAL_ELEVENLABS_API_KEY);
  restoreEnv('FOOTBALL_ANNOUNCER_VOICE_ID', ORIGINAL_ANNOUNCER_VOICE_ID);
});

describe('pregame commentary catalog', () => {
  it('validates the generated script catalog from teams and starting quarterbacks', () => {
    const teams = listTeamProfiles();
    const quarterbacks = listKnownStartingQuarterbacks();
    const orderedPairCount = teams.length * (teams.length - 1);

    expect(validatePregameCommentaryCatalog()).toEqual([]);
    expect(validatePregameScriptCatalog()).toEqual([]);
    expect(PREGAME_COMMENTARY_CATALOG.filter((clip) => clip.category === 'welcome')).toHaveLength(3);
    expect(PREGAME_COMMENTARY_CATALOG.filter((clip) => clip.category === 'matchup')).toHaveLength(orderedPairCount * 2);
    expect(PREGAME_COMMENTARY_CATALOG.filter((clip) => clip.category === 'weather')).toHaveLength(10);
    expect(PREGAME_COMMENTARY_CATALOG.filter((clip) => clip.category === 'quarterback')).toHaveLength(quarterbacks.length * 3);
    expect(PREGAME_COMMENTARY_CATALOG.every((clip) => clip.caption === clip.script)).toBe(true);
  });

  it('resolves every known ordered team pairing and falls back for unavailable pairings', () => {
    const teams = listTeamProfiles();

    for (const awayTeam of teams) {
      for (const homeTeam of teams) {
        if (awayTeam.id === homeTeam.id) {
          continue;
        }

        const selection = resolveMatchupLine({
          awayTeamId: awayTeam.id,
          homeTeamId: homeTeam.id,
          matchSeed: 'matrix',
        });

        expect(selection.available).toBe(true);
        expect(selection.clip?.awayTeamId).toBe(awayTeam.id);
        expect(selection.clip?.homeTeamId).toBe(homeTeam.id);
      }
    }

    expect(
      resolveMatchupLine({
        awayTeamId: teams[0].id,
        homeTeamId: teams[0].id,
      }),
    ).toMatchObject({
      available: false,
      fallbackReason: 'missingContext',
    });
    expect(
      resolveMatchupLine({
        awayTeamId: 'custom-away',
        homeTeamId: teams[0].id,
      }),
    ).toMatchObject({
      available: false,
      fallbackReason: 'unknownContext',
    });
  });

  it('resolves every known starting quarterback and includes exact roster identity', () => {
    for (const quarterback of listKnownStartingQuarterbacks()) {
      const selection = resolveQuarterbackSpotlight({
        matchSeed: 'qb',
        teamId: quarterback.teamId,
      });

      expect(selection.available).toBe(true);
      expect(selection.clip?.rosterPlayerId).toBe(quarterback.rosterPlayerId);
      expect(selection.caption).toContain(quarterback.player.displayName);
      expect(selection.caption).toContain(`number ${quarterback.jerseyNumber}`);
    }

    expect(resolveQuarterbackSpotlight({ teamId: 'custom-team' })).toMatchObject({
      available: false,
      fallbackReason: 'missingContext',
    });
  });

  it('maps weather conditions and defaults unsupported values to clear', () => {
    for (const condition of ['clear', 'overcast', 'rain', 'snow', 'windy'] as const) {
      const selection = resolveWeatherLine({ condition, matchSeed: 'weather' });

      expect(selection.available).toBe(true);
      expect(selection.clip?.weatherCondition).toBe(condition);
    }

    expect(resolveWeatherLine({ condition: 'fog', matchSeed: 'weather' }).clip?.weatherCondition).toBe('clear');
  });

  it('selects deterministically and avoids immediate rematch repetition when alternatives exist', () => {
    const teams = listTeamProfiles();
    const baseSelection = resolveMatchupLine({
      awayTeamId: teams[0].id,
      homeTeamId: teams[1].id,
      matchSeed: 'same-seed',
    });
    const repeatedSelection = resolveMatchupLine({
      awayTeamId: teams[0].id,
      homeTeamId: teams[1].id,
      matchSeed: 'same-seed',
    });
    const rematchSelection = resolveMatchupLine({
      awayTeamId: teams[0].id,
      homeTeamId: teams[1].id,
      matchSeed: 'same-seed',
      previousScriptId: baseSelection.scriptId,
    });

    expect(repeatedSelection.scriptId).toBe(baseSelection.scriptId);
    expect(rematchSelection.scriptId).not.toBe(baseSelection.scriptId);
  });

  it('falls back gracefully when selected assets are missing', () => {
    expect(resolvePregameWelcome({ availableAssetIds: [] })).toMatchObject({
      available: false,
      fallbackReason: 'missingAssets',
    });
  });

  it('writes pregame captions and audition artifacts from the same plan', async () => {
    await withTemporaryCwd(async (cwd) => {
      const plan = createPregameSpeechPlan('voice-test');
      const written = writePregameArtifacts(plan);
      const captions = JSON.parse(readFileSync(join(cwd, PREGAME_CAPTION_MANIFEST_PATH), 'utf8')) as {
        scripts: Array<{ caption: string; category: string; script: string; voiceId: string }>;
      };

      expect(validateAudioPlan(plan)).toEqual([]);
      expect(written).toEqual({
        auditionPagePath: PREGAME_AUDITION_PAGE_PATH,
        captionManifestPath: PREGAME_CAPTION_MANIFEST_PATH,
      });
      expect(captions.scripts).toHaveLength(PREGAME_COMMENTARY_CATALOG.length);
      expect(captions.scripts.every((entry) => entry.caption === entry.script)).toBe(true);
      expect(captions.scripts.every((entry) => entry.voiceId === 'voice-test')).toBe(true);
      expect(new Set(captions.scripts.map((entry) => entry.category))).toEqual(
        new Set(['matchup', 'quarterback', 'weather', 'welcome']),
      );
      expect(readFileSync(join(cwd, PREGAME_AUDITION_PAGE_PATH), 'utf8')).toContain('Pregame Audition');
    });
  });

  it('keeps dry-run pregame generation from constructing an API client', async () => {
    await withTemporaryCwd(async () => {
      let clientFactoryCalled = false;
      const summary = await generatePregameSpeech(
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
    });
  });

  it('generates one selected pregame speech asset with metadata sidecar', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.FOOTBALL_ANNOUNCER_VOICE_ID = 'voice-test';
      let speechCalls = 0;
      const fakeClient = {
        textToSpeech: {
          convert: async () => {
            speechCalls += 1;
            return createReadableStreamFromText('pregame-mp3');
          },
        },
      };

      const summary = await generatePregameSpeech(
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        },
        {
          clientFactory: async () => fakeClient as never,
        },
      );
      const firstAsset = createPregameSpeechPlan('voice-test')[0];
      const sidecar = JSON.parse(readFileSync(join(cwd, `${firstAsset.outputPath}.json`), 'utf8')) as {
        metadata: { pregameCategory: string; variant: number };
        scriptId: string;
        voiceId: string;
      };

      expect(summary.generated).toEqual([firstAsset.assetId]);
      expect(speechCalls).toBe(1);
      expect(sidecar).toMatchObject({
        metadata: {
          pregameCategory: 'welcome',
          variant: 1,
        },
        scriptId: firstAsset.scriptId,
        voiceId: 'voice-test',
      });
    });
  });

  it('fails paid execution when the key is missing and writes the missing-assets report', async () => {
    await withTemporaryCwd(async (cwd) => {
      delete process.env.ELEVENLABS_API_KEY;
      delete process.env.FOOTBALL_ANNOUNCER_VOICE_ID;

      await expect(
        generatePregameSpeech({
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
        }),
      ).rejects.toThrow(/Missing ELEVENLABS_API_KEY/);
      expect(existsSync(join(cwd, PREGAME_CAPTION_MANIFEST_PATH))).toBe(true);
      expect(existsSync(join(cwd, PREGAME_AUDITION_PAGE_PATH))).toBe(true);
    });
  });

  it('protects existing pregame files from replacement without force', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      process.env.FOOTBALL_ANNOUNCER_VOICE_ID = 'voice-test';
      const firstAsset = createPregameSpeechPlan('voice-test')[0];
      const outputPath = join(cwd, firstAsset.outputPath);
      mkdirSync(join(cwd, 'public/audio/announcer/pregame'), { recursive: true });
      writeFileSync(outputPath, 'existing audio placeholder');

      await expect(
        generatePregameSpeech(
          {
            ...DEFAULT_GENERATE_OPTIONS,
            execute: true,
          },
          {
            clientFactory: async () => ({
              textToSpeech: {
                convert: async () => createReadableStreamFromText('should-not-run'),
              },
            }) as never,
          },
        ),
      ).rejects.toThrow(/output already exists/);
      expect(readFileSync(outputPath, 'utf8')).toBe('existing audio placeholder');
    });
  });

  it('keeps ElevenLabs secrets and SDK references out of browser source', () => {
    const browserSourceFiles = readSourceFiles(join(ORIGINAL_CWD, 'src'));

    expect(findBrowserSecretReferences(browserSourceFiles)).toEqual([]);
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
  const cwd = mkdtempSync(join(tmpdir(), 'football-pregame-audio-test-'));

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

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
