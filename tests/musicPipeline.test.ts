import { Buffer } from 'node:buffer';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateMusic } from '../tools/audio/generateMusic';
import {
  FOOTBALL_EXPANDED_MUSIC_PLAN,
  FOOTBALL_MENU_PLAYLIST_PLAN,
  FOOTBALL_STADIUM_CHANT_PLAN,
  FOOTBALL_TITLE_MUSIC_DURATION_SECONDS,
  FOOTBALL_TITLE_MUSIC_PLAN,
  FOOTBALL_TRANSITION_STINGER_PLAN,
  validateFootballExpandedMusicPlan,
  validateFootballTitleMusicPlan,
} from '../tools/audio/musicPlan';
import {
  TITLE_MUSIC_AUDITION_PATH,
  TITLE_MUSIC_CATALOG_PATH,
  TITLE_MUSIC_REPORT_PATH,
  TITLE_MUSIC_RUNTIME_PATH,
  TITLE_MUSIC_SELECTION_PATH,
  createTitleMusicReport,
  selectTitleMusicAsset,
  writeTitleMusicReportFiles,
} from '../tools/audio/musicReport';
import {
  findBrowserSecretReferences,
  requireElevenLabsApiKey,
  validateAudioPlan,
  type GenerateOptions,
} from '../tools/audio/schemas';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  execute: false,
  force: false,
  maxFiles: 3,
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

describe('Football JS title music production pipeline', () => {
  it('validates the three-candidate music plan', () => {
    expect(validateFootballTitleMusicPlan()).toEqual([]);
    expect(validateAudioPlan(FOOTBALL_TITLE_MUSIC_PLAN)).toEqual([]);
    expect(FOOTBALL_TITLE_MUSIC_PLAN).toHaveLength(3);
    expect(FOOTBALL_TITLE_MUSIC_PLAN.every((asset) => asset.category === 'music')).toBe(true);
    expect(FOOTBALL_TITLE_MUSIC_PLAN.every((asset) => asset.kind === 'music')).toBe(true);
    expect(FOOTBALL_TITLE_MUSIC_PLAN.every((asset) => asset.modelId === 'music_v2')).toBe(true);
    expect(FOOTBALL_TITLE_MUSIC_PLAN.every((asset) => asset.outputFormat === 'mp3_48000_192')).toBe(true);
    expect(FOOTBALL_TITLE_MUSIC_PLAN.every((asset) => asset.requestedDurationSeconds === FOOTBALL_TITLE_MUSIC_DURATION_SECONDS)).toBe(true);
    expect(FOOTBALL_TITLE_MUSIC_PLAN.every((asset) => asset.loop && asset.runtimeLoadingStrategy === 'stream')).toBe(true);
    expect(
      FOOTBALL_TITLE_MUSIC_PLAN.every((asset) =>
        /no vocals/i.test(asset.prompt ?? '') &&
        /no spoken words/i.test(asset.prompt ?? '') &&
        /no real fight-song/i.test(asset.prompt ?? ''),
      ),
    ).toBe(true);
  });

  it('validates the expanded menu, stinger, and chant music pack plan', () => {
    expect(validateFootballExpandedMusicPlan()).toEqual([]);
    expect(validateAudioPlan(FOOTBALL_EXPANDED_MUSIC_PLAN)).toEqual([]);
    expect(FOOTBALL_MENU_PLAYLIST_PLAN).toHaveLength(3);
    expect(FOOTBALL_TRANSITION_STINGER_PLAN).toHaveLength(6);
    expect(FOOTBALL_STADIUM_CHANT_PLAN).toHaveLength(3);
    expect(FOOTBALL_EXPANDED_MUSIC_PLAN).toHaveLength(15);
    expect(FOOTBALL_MENU_PLAYLIST_PLAN.every((asset) => asset.modelId === 'music_v2')).toBe(true);
    expect(FOOTBALL_TRANSITION_STINGER_PLAN.every((asset) => asset.modelId === 'music_v2')).toBe(true);
    expect(FOOTBALL_STADIUM_CHANT_PLAN.every((asset) => asset.modelId === 'eleven_text_to_sound_v2')).toBe(true);
    expect(
      FOOTBALL_STADIUM_CHANT_PLAN.every((asset) =>
        asset.category === 'crowd' &&
        asset.outputPath.startsWith('public/audio/crowd/chants/') &&
        asset.metadata?.catalogCategory === 'chant',
      ),
    ).toBe(true);
    expect(
      [...FOOTBALL_MENU_PLAYLIST_PLAN, ...FOOTBALL_TRANSITION_STINGER_PLAN].every((asset) =>
        /no real team/i.test(asset.prompt ?? '') &&
        /no artist reference/i.test(asset.prompt ?? ''),
      ),
    ).toBe(true);
    expect(FOOTBALL_STADIUM_CHANT_PLAN.every((asset) => /no team name/i.test(asset.prompt ?? ''))).toBe(true);
  });

  it('fails paid execution when ELEVENLABS_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.ELEVENLABS_API_KEY;

      await expect(
        generateMusic(FOOTBALL_TITLE_MUSIC_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        }),
      ).rejects.toThrow(/Missing ELEVENLABS_API_KEY/);
    });
  });

  it('keeps dry-run generation from requesting music or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let requestCalled = false;
      const summary = await generateMusic(
        FOOTBALL_TITLE_MUSIC_PLAN,
        DEFAULT_GENERATE_OPTIONS,
        {
          requestMusic: async () => {
            requestCalled = true;
            throw new Error('dry-run should not request music');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: true,
        generated: [],
        skipped: ['football-js-title-a', 'football-js-title-b', 'football-js-title-c'],
      });
      expect(requestCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/audio/music/football-js-title-a.mp3'))).toBe(false);
    });
  });

  it('skips existing music files unless force is supplied', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      mkdirSync(join(cwd, 'public/audio/music'), { recursive: true });
      const existingPath = join(cwd, 'public/audio/music/football-js-title-a.mp3');
      writeFileSync(existingPath, 'existing title music');
      let requestCalled = false;

      const summary = await generateMusic(
        FOOTBALL_TITLE_MUSIC_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestMusic: async () => {
            requestCalled = true;
            return { content: Buffer.from('new music') };
          },
        },
      );

      expect(summary).toEqual({
        dryRun: false,
        generated: [],
        skipped: ['football-js-title-a'],
      });
      expect(requestCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing title music');
    });
  });

  it('routes stadium chants through the sound-effect generation path', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      let musicCalled = false;
      let soundEffectCalls = 0;

      const summary = await generateMusic(
        FOOTBALL_STADIUM_CHANT_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestMusic: async () => {
            musicCalled = true;
            throw new Error('chants should not use the music endpoint');
          },
          requestSoundEffect: async (asset) => {
            soundEffectCalls += 1;
            return { content: Buffer.from(`chant-${asset.assetId}`) };
          },
        },
      );

      expect(summary.generated).toEqual(['football-js-chant-defense']);
      expect(summary.skipped).toEqual([]);
      expect(musicCalled).toBe(false);
      expect(soundEffectCalls).toBe(1);
      expect(existsSync(join(cwd, 'public/audio/crowd/chants/football-js-chant-defense.mp3'))).toBe(true);
    });
  });

  it('writes provenance, report, audition page, selection manifest, and stable runtime file', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      const summary = await generateMusic(
        FOOTBALL_TITLE_MUSIC_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 3,
        },
        {
          requestMusic: async (asset) => ({
            content: Buffer.from(`music-${asset.assetId}`),
            songId: `song-${asset.assetId}`,
          }),
        },
      );
      const selection = selectTitleMusicAsset(FOOTBALL_TITLE_MUSIC_PLAN, {
        assetId: 'football-js-title-a',
        force: false,
        selectedAt: '2026-06-21T00:00:00.000Z',
      });
      const report = createTitleMusicReport(FOOTBALL_TITLE_MUSIC_PLAN, '2026-06-21T00:00:01.000Z');
      const written = writeTitleMusicReportFiles(report);

      expect(summary.generated).toEqual(['football-js-title-a', 'football-js-title-b', 'football-js-title-c']);
      expect(selection.runtimeAudioUrl).toBe('/audio/music/football-js-title.mp3');
      expect(report.generatedCount).toBe(3);
      expect(report.selection?.assetId).toBe('football-js-title-a');
      expect(report.candidates.every((candidate) => candidate.provenanceExists)).toBe(true);
      expect(report.candidates.map((candidate) => candidate.songId)).toEqual([
        'song-football-js-title-a',
        'song-football-js-title-b',
        'song-football-js-title-c',
      ]);
      expect(written).toEqual({
        auditionPath: TITLE_MUSIC_AUDITION_PATH,
        catalogPath: TITLE_MUSIC_CATALOG_PATH,
        reportPath: TITLE_MUSIC_REPORT_PATH,
      });
      expect(existsSync(join(cwd, TITLE_MUSIC_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, TITLE_MUSIC_SELECTION_PATH))).toBe(true);
      expect(existsSync(join(cwd, TITLE_MUSIC_CATALOG_PATH))).toBe(true);
      expect(existsSync(join(cwd, TITLE_MUSIC_AUDITION_PATH))).toBe(true);
      expect(readFileSync(join(cwd, TITLE_MUSIC_AUDITION_PATH), 'utf8')).toContain('Football JS Music Pack Audition');
    });
  });

  it('writes an expanded runtime catalog grouped by menu tracks, stingers, and chants', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.ELEVENLABS_API_KEY = 'test-key';
      await generateMusic(
        FOOTBALL_EXPANDED_MUSIC_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 15,
        },
        {
          requestMusic: async (asset) => ({
            content: Buffer.from(`music-${asset.assetId}`),
            songId: `song-${asset.assetId}`,
          }),
          requestSoundEffect: async (asset) => ({
            content: Buffer.from(`chant-${asset.assetId}`),
          }),
        },
      );
      selectTitleMusicAsset(FOOTBALL_TITLE_MUSIC_PLAN, {
        assetId: 'football-js-title-a',
        force: false,
        selectedAt: '2026-06-21T00:00:00.000Z',
      });
      const report = createTitleMusicReport(FOOTBALL_EXPANDED_MUSIC_PLAN, '2026-06-21T00:00:01.000Z');
      writeTitleMusicReportFiles(report);
      const catalog = JSON.parse(readFileSync(join(cwd, TITLE_MUSIC_CATALOG_PATH), 'utf8')) as {
        tracks: Array<{ assetId: string; category: string; displayTitle: string; outputPath: string }>;
      };

      expect(catalog.tracks.filter((entry) => entry.category === 'menu')).toHaveLength(4);
      expect(catalog.tracks.filter((entry) => entry.category === 'stinger')).toHaveLength(6);
      expect(catalog.tracks.filter((entry) => entry.category === 'chant')).toHaveLength(3);
      expect(catalog.tracks[0]).toMatchObject({
        assetId: 'football-js-title',
        category: 'menu',
        displayTitle: 'Football JS Main Theme',
        outputPath: TITLE_MUSIC_RUNTIME_PATH,
      });
      expect(readFileSync(join(cwd, TITLE_MUSIC_AUDITION_PATH), 'utf8')).toContain('Transition Stingers');
      expect(readFileSync(join(cwd, TITLE_MUSIC_AUDITION_PATH), 'utf8')).toContain('Stadium Chants');
    });
  });

  it('reads local API keys only from Node-only sources', async () => {
    await withTemporaryCwd(async (cwd) => {
      writeFileSync(join(cwd, '.env'), 'ELEVENLABS_API_KEY="env-file-key"\n');
      expect(requireElevenLabsApiKey({} as NodeJS.ProcessEnv)).toBe('env-file-key');
    });
  });

  it('does not expose ElevenLabs secrets in browser-facing music manifests', async () => {
    await withTemporaryCwd(async (cwd) => {
      mkdirSync(join(cwd, 'public/audio/music'), { recursive: true });
      writeFileSync(join(cwd, 'public/audio/music/football-js-title-a.mp3'), 'music fixture');
      selectTitleMusicAsset(FOOTBALL_TITLE_MUSIC_PLAN, {
        assetId: 'football-js-title-a',
        force: false,
        selectedAt: '2026-06-21T00:00:00.000Z',
      });

      const files = [
        {
          path: TITLE_MUSIC_SELECTION_PATH,
          text: readFileSync(join(cwd, TITLE_MUSIC_SELECTION_PATH), 'utf8'),
        },
      ];

      expect(findBrowserSecretReferences(files)).toEqual([]);
    });
  });
});

async function withTemporaryCwd(action: (cwd: string) => Promise<void> | void): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'football-title-music-'));
  process.chdir(cwd);
  try {
    await action(cwd);
  } finally {
    process.chdir(ORIGINAL_CWD);
    rmSync(cwd, { force: true, recursive: true });
  }
}
