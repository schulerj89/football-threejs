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
import {
  FOOTBALL_JS_BRAND_ASSET_PLAN,
  validateFootballJsBrandAssetPlan,
} from '../tools/branding/brandAssetPlan';
import {
  createBrandAssetReport,
  selectBrandAssets,
  writeBrandAssetReportFiles,
} from '../tools/branding/brandAssetReport';
import {
  FOOTBALL_JS_COIN_ASSET_PLAN,
  validateFootballJsCoinAssetPlan,
} from '../tools/branding/coinAssetPlan';
import {
  FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
  validateFootballJsTeamLogoPlan,
} from '../tools/branding/teamLogoPlan';
import {
  FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
  validateFootballJsScorebugAssetPlan,
} from '../tools/branding/scorebugAssetPlan';
import {
  COIN_GALLERY_PATH,
  COIN_REPORT_PATH,
  COIN_SELECTION_PATH,
  FOOTBALL_JS_COIN_HEADS_RUNTIME_PATH,
  FOOTBALL_JS_COIN_TAILS_RUNTIME_PATH,
  createCoinAssetReport,
  selectCoinAssets,
  writeCoinAssetReportFiles,
} from '../tools/branding/coinAssetReport';
import { generateBrandImages } from '../tools/branding/generateBrandImages';
import { generateCoinAssets } from '../tools/branding/generateCoinAssets';
import { generateScorebugAssets, parseScorebugGenerateOptions } from '../tools/branding/generateScorebugAssets';
import { generateTeamLogos, parseTeamLogoGenerateOptions } from '../tools/branding/generateTeamLogos';
import {
  TEAM_LOGO_GALLERY_PATH,
  TEAM_LOGO_REPORT_PATH,
  TEAM_LOGO_SELECTION_PATH,
  createTeamLogoReport,
  selectTeamLogos,
  writeTeamLogoReportFiles,
} from '../tools/branding/teamLogoReport';
import {
  FOOTBALL_JS_SCOREBUG_RUNTIME_PATH,
  SCOREBUG_GALLERY_PATH,
  SCOREBUG_LAYOUT_PATH,
  SCOREBUG_REPORT_PATH,
  SCOREBUG_SELECTION_PATH,
  createScorebugAssetReport,
  selectScorebugAsset,
  validateScorebugLayout,
  writeScorebugAssetReportFiles,
} from '../tools/branding/scorebugAssetReport';
import {
  BRAND_GALLERY_PATH,
  BRAND_REPORT_PATH,
  BRAND_SELECTION_PATH,
  FOOTBALL_JS_EMBLEM_RUNTIME_PATH,
  FOOTBALL_JS_TITLE_RUNTIME_PATH,
  assertCanWriteBrandAsset,
  findBrowserOpenAISecretReferences,
  parseBrandGenerateOptions,
  requireOpenAIApiKey,
  validateBrandAssetPlan,
  type BrandGenerateOptions,
} from '../tools/branding/schemas';
import { GAME_BRAND } from '../src/config/GameBrand';
import { listTeamProfiles } from '../src/teams/TeamRegistry';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const DEFAULT_GENERATE_OPTIONS: BrandGenerateOptions = {
  execute: false,
  force: false,
  maxFiles: 2,
  retryCount: 1,
};

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  if (ORIGINAL_OPENAI_API_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
  }
});

describe('Football JS brand asset pipeline', () => {
  it('defines the official in-game brand through a central config', () => {
    expect(GAME_BRAND).toMatchObject({
      announcerName: 'Grant Mercer',
      emblemImageUrl: '/branding/football-js-emblem.webp',
      heroImageUrl: '/branding/football-js-title.webp',
      shortTitle: 'Football JS',
      title: 'Football JS',
      titleMusicId: 'football-js-title',
    });
  });

  it('validates the typed GPT Image 2 brand generation plan', () => {
    expect(validateFootballJsBrandAssetPlan()).toEqual([]);
    expect(validateBrandAssetPlan(FOOTBALL_JS_BRAND_ASSET_PLAN)).toEqual([]);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN).toHaveLength(4);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.filter((asset) => asset.category === 'title')).toHaveLength(2);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.filter((asset) => asset.category === 'emblem')).toHaveLength(2);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.every((asset) => asset.model === 'gpt-image-2')).toBe(true);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.every((asset) => asset.quality === 'high')).toBe(true);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.every((asset) => asset.outputFormat === 'webp')).toBe(true);
  });

  it('rejects invalid output paths before generation', () => {
    const invalidPlan = [
      {
        ...FOOTBALL_JS_BRAND_ASSET_PLAN[0],
        outputPath: '../public/branding/title/escape.webp',
      },
      ...FOOTBALL_JS_BRAND_ASSET_PLAN.slice(1),
    ];

    expect(validateBrandAssetPlan(invalidPlan)).toContain(
      'football-js-title-01: outputPath must not contain parent traversal',
    );
  });

  it('fails paid execution when OPENAI_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        generateBrandImages(FOOTBALL_JS_BRAND_ASSET_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        }),
      ).rejects.toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('keeps dry-run generation from making an API request or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let requestCalled = false;
      const summary = await generateBrandImages(
        FOOTBALL_JS_BRAND_ASSET_PLAN,
        DEFAULT_GENERATE_OPTIONS,
        {
          requestImage: async () => {
            requestCalled = true;
            throw new Error('dry-run should not request images');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: true,
        generated: [],
        skipped: ['football-js-title-01', 'football-js-title-02'],
      });
      expect(requestCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/branding/title/football-js-title-01.webp'))).toBe(false);
    });
  });

  it('accepts explicit npm-run flag handoff without changing dry-run defaults', () => {
    const originalExecute = process.env.npm_config_execute;
    const originalForce = process.env.npm_config_force;
    const originalMaxFiles = process.env.npm_config_max_files;
    const originalAsset = process.env.npm_config_asset;
    const originalBrandMaxFiles = process.env.BRAND_IMAGE_MAX_FILES;

    try {
      delete process.env.BRAND_IMAGE_MAX_FILES;
      delete process.env.npm_config_execute;
      delete process.env.npm_config_force;
      delete process.env.npm_config_max_files;
      delete process.env.npm_config_asset;
      expect(parseBrandGenerateOptions([])).toMatchObject({
        execute: false,
        force: false,
        maxFiles: 4,
      });

      process.env.npm_config_execute = 'true';
      process.env.npm_config_force = 'true';
      process.env.npm_config_max_files = '2';
      process.env.npm_config_asset = 'candidate-a-heads';
      expect(parseBrandGenerateOptions([])).toMatchObject({
        execute: true,
        force: true,
        maxFiles: 2,
        onlyAssetId: 'candidate-a-heads',
      });
    } finally {
      restoreOptionalEnv('npm_config_execute', originalExecute);
      restoreOptionalEnv('npm_config_force', originalForce);
      restoreOptionalEnv('npm_config_max_files', originalMaxFiles);
      restoreOptionalEnv('npm_config_asset', originalAsset);
      restoreOptionalEnv('BRAND_IMAGE_MAX_FILES', originalBrandMaxFiles);
    }
  });

  it('skips existing generated files unless force is supplied', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const existingPath = join(cwd, 'public/branding/title/football-js-title-01.webp');
      mkdirSync(join(cwd, 'public/branding/title'), { recursive: true });
      writeFileSync(existingPath, 'existing image placeholder');
      writeFileSync(`${existingPath}.json`, '{}');
      let requestCalled = false;

      const summary = await generateBrandImages(
        FOOTBALL_JS_BRAND_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            return Buffer.from('new image');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: false,
        generated: [],
        skipped: ['football-js-title-01'],
      });
      expect(requestCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing image placeholder');
      expect(() => assertCanWriteBrandAsset(FOOTBALL_JS_BRAND_ASSET_PLAN[0], false)).toThrow(/--force/);
    });
  });

  it('generates report, gallery, selection manifest, and stable runtime filenames', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const generatedContent = Buffer.from('brand-image-bytes');
      const summary = await generateBrandImages(
        FOOTBALL_JS_BRAND_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 4,
        },
        {
          requestImage: async () => generatedContent,
        },
      );
      const selection = selectBrandAssets(FOOTBALL_JS_BRAND_ASSET_PLAN, {
        emblemAssetId: 'football-js-emblem-01',
        force: false,
        selectedAt: '2026-06-21T00:00:00.000Z',
        titleAssetId: 'football-js-title-01',
      });
      const report = createBrandAssetReport();
      writeBrandAssetReportFiles(report);

      expect(summary.generated).toEqual([
        'football-js-title-01',
        'football-js-title-02',
        'football-js-emblem-01',
        'football-js-emblem-02',
      ]);
      expect(report.validationErrors).toEqual([]);
      expect(report.generatedCount).toBe(4);
      expect(selection.title.runtimeImageUrl).toBe('/branding/football-js-title.webp');
      expect(selection.emblem.runtimeImageUrl).toBe('/branding/football-js-emblem.webp');
      expect(existsSync(join(cwd, FOOTBALL_JS_TITLE_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, FOOTBALL_JS_EMBLEM_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, BRAND_SELECTION_PATH))).toBe(true);
      expect(existsSync(join(cwd, BRAND_REPORT_PATH))).toBe(true);
      expect(existsSync(join(cwd, BRAND_GALLERY_PATH))).toBe(true);
      expect(readFileSync(join(cwd, BRAND_GALLERY_PATH), 'utf8')).toContain('Football JS Brand Gallery');
    });
  });

  it('reads local API keys only from Node-only sources', async () => {
    await withTemporaryCwd(async (cwd) => {
      writeFileSync(join(cwd, '.env'), 'OPENAI_API_KEY="env-file-key"\n');
      expect(requireOpenAIApiKey({ env: {}, allowLocalFiles: false })).toBe('env-file-key');
      expect(() =>
        requireOpenAIApiKey({
          allowLocalFiles: false,
          env: {},
          envFilePath: null,
          localKeyFiles: [],
        }),
      ).toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('does not put OpenAI secrets or API calls in browser-facing source or manifests', async () => {
    await withTemporaryCwd(async (cwd) => {
      const selection = selectBrandAssetsFixture(cwd);
      expect(selection).toBeTruthy();

      const files = [
        {
          path: 'src/config/GameBrand.ts',
          text: readFileSync(join(ORIGINAL_CWD, 'src/config/GameBrand.ts'), 'utf8'),
        },
        {
          path: BRAND_SELECTION_PATH,
          text: readFileSync(join(cwd, BRAND_SELECTION_PATH), 'utf8'),
        },
      ];

      expect(findBrowserOpenAISecretReferences(files)).toEqual([]);
    });
  });
});

describe('Football JS coin asset pipeline', () => {
  it('validates the typed GPT Image 2 coin generation plan', () => {
    expect(validateFootballJsCoinAssetPlan()).toEqual([]);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN).toHaveLength(4);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.filter((asset) => asset.coinSetId === 'candidate-a')).toHaveLength(2);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.filter((asset) => asset.coinSetId === 'candidate-b')).toHaveLength(2);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.filter((asset) => asset.face === 'heads')).toHaveLength(2);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.filter((asset) => asset.face === 'tails')).toHaveLength(2);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.every((asset) => asset.model === 'gpt-image-2')).toBe(true);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.every((asset) => asset.requestedSize === '1024x1024')).toBe(true);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.every((asset) => asset.quality === 'high')).toBe(true);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.every((asset) => asset.outputFormat === 'webp')).toBe(true);
    expect(FOOTBALL_JS_COIN_ASSET_PLAN.every((asset) => asset.background === 'opaque')).toBe(true);
  });

  it('keeps coin dry-run generation from making an API request or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let requestCalled = false;
      const summary = await generateCoinAssets(
        FOOTBALL_JS_COIN_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          maxFiles: 4,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            throw new Error('dry-run should not request coin images');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: true,
        generated: [],
        skipped: [
          'candidate-a-heads',
          'candidate-a-tails',
          'candidate-b-heads',
          'candidate-b-tails',
        ],
      });
      expect(requestCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/branding/coin/candidate-a-heads.webp'))).toBe(false);
    });
  });

  it('fails paid coin execution when OPENAI_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        generateCoinAssets(FOOTBALL_JS_COIN_ASSET_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        }),
      ).rejects.toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('skips existing coin files unless force is supplied', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const existingPath = join(cwd, 'public/branding/coin/candidate-a-heads.webp');
      mkdirSync(join(cwd, 'public/branding/coin'), { recursive: true });
      writeFileSync(existingPath, 'existing coin placeholder');
      writeFileSync(`${existingPath}.json`, '{}');
      let requestCalled = false;

      const summary = await generateCoinAssets(
        FOOTBALL_JS_COIN_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            return {
              content: Buffer.from('new coin image'),
              metadata: {
                apiEndpoint: 'images/generations',
                referenceMode: 'none',
              },
            };
          },
        },
      );

      expect(summary).toEqual({
        dryRun: false,
        generated: [],
        skipped: ['candidate-a-heads'],
      });
      expect(requestCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing coin placeholder');
    });
  });

  it('generates coin report, gallery, selection manifest, and stable runtime filenames', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const referenceAssets: string[] = [];
      const summary = await generateCoinAssets(
        FOOTBALL_JS_COIN_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 4,
        },
        {
          requestImage: async (asset, _apiKey, referenceImage) => {
            if (referenceImage) {
              referenceAssets.push(asset.assetId);
            }

            return {
              content: Buffer.from(`coin-image-bytes-${asset.assetId}`),
              metadata: {
                apiEndpoint: referenceImage ? 'images/edits' : 'images/generations',
                referenceAssetId: asset.referenceAssetId,
                referenceMode: referenceImage ? 'imageEdit' : 'none',
              },
            };
          },
        },
      );
      const selection = selectCoinAssets(FOOTBALL_JS_COIN_ASSET_PLAN, {
        force: false,
        selectedAt: '2026-06-22T00:00:00.000Z',
        selectedSetId: 'candidate-a',
      });
      const report = createCoinAssetReport();
      writeCoinAssetReportFiles(report);

      expect(summary.generated).toEqual([
        'candidate-a-heads',
        'candidate-a-tails',
        'candidate-b-heads',
        'candidate-b-tails',
      ]);
      expect(referenceAssets).toEqual(['candidate-a-tails', 'candidate-b-tails']);
      expect(report.validationErrors).toEqual([]);
      expect(report.generatedCount).toBe(4);
      expect(selection.heads.runtimeImageUrl).toBe('/branding/coin/football-js-coin-heads.webp');
      expect(selection.tails.runtimeImageUrl).toBe('/branding/coin/football-js-coin-tails.webp');
      expect(existsSync(join(cwd, FOOTBALL_JS_COIN_HEADS_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, FOOTBALL_JS_COIN_TAILS_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, COIN_SELECTION_PATH))).toBe(true);
      expect(existsSync(join(cwd, COIN_REPORT_PATH))).toBe(true);
      expect(existsSync(join(cwd, COIN_GALLERY_PATH))).toBe(true);
      expect(readFileSync(join(cwd, COIN_GALLERY_PATH), 'utf8')).toContain('Football JS Coin Gallery');
    });
  });

  it('does not put OpenAI secrets or API calls in coin browser-facing manifests', async () => {
    await withTemporaryCwd(async (cwd) => {
      selectCoinAssetsFixture(cwd);

      const files = [
        {
          path: COIN_SELECTION_PATH,
          text: readFileSync(join(cwd, COIN_SELECTION_PATH), 'utf8'),
        },
      ];

      expect(findBrowserOpenAISecretReferences(files)).toEqual([]);
    });
  });
});

describe('Football JS team logo pipeline', () => {
  it('validates the typed GPT Image 2 team-logo plan for the six-team league', () => {
    const teams = listTeamProfiles();

    expect(validateFootballJsTeamLogoPlan()).toEqual([]);
    expect(teams).toHaveLength(6);
    expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN).toHaveLength(12);
    for (const team of teams) {
      expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.filter((asset) => asset.teamId === team.id)).toHaveLength(2);
      expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.filter(
        (asset) => asset.teamId === team.id && asset.candidateId === 'candidate-a',
      )).toHaveLength(1);
      expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.filter(
        (asset) => asset.teamId === team.id && asset.candidateId === 'candidate-b',
      )).toHaveLength(1);
    }
    expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.every((asset) => asset.model === 'gpt-image-2')).toBe(true);
    expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.every((asset) => asset.requestedSize === '1024x1024')).toBe(true);
    expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.every((asset) => asset.quality === 'high')).toBe(true);
    expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.every((asset) => asset.outputFormat === 'webp')).toBe(true);
    expect(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.every((asset) => asset.background === 'opaque')).toBe(true);
  });

  it('keeps team-logo dry-run generation from making an API request or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let requestCalled = false;
      const summary = await generateTeamLogos(
        FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          maxFiles: 12,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            throw new Error('dry-run should not request team logos');
          },
        },
      );

      expect(summary.dryRun).toBe(true);
      expect(summary.generated).toEqual([]);
      expect(summary.skipped).toHaveLength(12);
      expect(requestCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/branding/teams/metro-meteors/candidate-a.webp'))).toBe(false);
    });
  });

  it('uses a twelve-image cap for the approved six-team candidate set', () => {
    expect(parseTeamLogoGenerateOptions(['--max-files=12'])).toMatchObject({
      execute: false,
      force: false,
      maxFiles: 12,
    });
    expect(() => parseTeamLogoGenerateOptions(['--max-files=13'])).toThrow(/capped at 12/);
  });

  it('fails paid team-logo execution when OPENAI_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        generateTeamLogos(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        }),
      ).rejects.toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('skips existing team-logo files unless force is supplied', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const existingPath = join(cwd, 'public/branding/teams/metro-meteors/candidate-a.webp');
      mkdirSync(join(cwd, 'public/branding/teams/metro-meteors'), { recursive: true });
      writeFileSync(existingPath, 'existing team logo placeholder');
      writeFileSync(`${existingPath}.json`, '{}');
      let requestCalled = false;

      const summary = await generateTeamLogos(
        FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            return {
              content: Buffer.from('new team logo'),
              metadata: {
                apiEndpoint: 'images/generations',
                revisedPrompt: null,
              },
            };
          },
        },
      );

      expect(summary).toEqual({
        dryRun: false,
        generated: [],
        skipped: ['metro-meteors-logo-a'],
      });
      expect(requestCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing team logo placeholder');
    });
  });

  it('generates team-logo report, gallery, selection manifest, and stable runtime filenames', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const summary = await generateTeamLogos(
        FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 12,
        },
        {
          requestImage: async (asset) => ({
            content: Buffer.from(`team-logo-image-${asset.assetId}`),
            metadata: {
              apiEndpoint: 'images/generations',
              revisedPrompt: null,
            },
          }),
        },
      );
      const selection = selectTeamLogos(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN, {
        force: false,
        selectedAt: '2026-06-22T00:00:00.000Z',
        selectedCandidateId: 'candidate-a',
      });
      const report = createTeamLogoReport();
      writeTeamLogoReportFiles(report);

      expect(summary.generated).toHaveLength(12);
      expect(report.validationErrors).toEqual([]);
      expect(report.generatedCount).toBe(12);
      expect(selection.teams).toHaveLength(6);
      for (const team of listTeamProfiles()) {
        expect(selection.teams.find((entry) => entry.teamId === team.id)).toMatchObject({
          runtimeImageUrl: `/branding/teams/${team.id}/logo.webp`,
          runtimePath: `public/branding/teams/${team.id}/logo.webp`,
        });
        expect(existsSync(join(cwd, `public/branding/teams/${team.id}/logo.webp`))).toBe(true);
      }
      expect(existsSync(join(cwd, TEAM_LOGO_SELECTION_PATH))).toBe(true);
      expect(existsSync(join(cwd, TEAM_LOGO_REPORT_PATH))).toBe(true);
      expect(existsSync(join(cwd, TEAM_LOGO_GALLERY_PATH))).toBe(true);
      expect(readFileSync(join(cwd, TEAM_LOGO_GALLERY_PATH), 'utf8')).toContain('Football JS Team Logo Gallery');
    });
  });

  it('has selected runtime logo files for every registered team', () => {
    for (const team of listTeamProfiles()) {
      expect(team.logoUrl).toBe(`/branding/teams/${team.id}/logo.webp`);
      expect(existsSync(join(ORIGINAL_CWD, 'public', team.logoUrl))).toBe(true);
    }
  });

  it('does not put OpenAI secrets or API calls in team-logo browser-facing manifests', async () => {
    await withTemporaryCwd(async (cwd) => {
      selectTeamLogoAssetsFixture(cwd);

      const files = [
        {
          path: TEAM_LOGO_SELECTION_PATH,
          text: readFileSync(join(cwd, TEAM_LOGO_SELECTION_PATH), 'utf8'),
        },
      ];

      expect(findBrowserOpenAISecretReferences(files)).toEqual([]);
    });
  });
});

describe('Football JS scorebug shell asset pipeline', () => {
  it('validates the typed GPT Image 2 scorebug shell plan', () => {
    expect(validateFootballJsScorebugAssetPlan()).toEqual([]);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN).toHaveLength(3);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN.map((asset) => asset.candidateId)).toEqual([
      'candidate-a',
      'candidate-b',
      'candidate-c',
    ]);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN.every((asset) => asset.model === 'gpt-image-2')).toBe(true);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN.every((asset) => asset.requestedSize === '1536x512')).toBe(true);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN.every((asset) => asset.quality === 'high')).toBe(true);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN.every((asset) => asset.outputFormat === 'webp')).toBe(true);
    expect(FOOTBALL_JS_SCOREBUG_ASSET_PLAN.every((asset) => asset.background === 'opaque')).toBe(true);
  });

  it('keeps scorebug dry-run generation from making an API request or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let requestCalled = false;
      const summary = await generateScorebugAssets(
        FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          maxFiles: 3,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            throw new Error('dry-run should not request scorebug images');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: true,
        generated: [],
        skipped: ['candidate-a', 'candidate-b', 'candidate-c'],
      });
      expect(requestCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/branding/scorebug/candidate-a.webp'))).toBe(false);
    });
  });

  it('uses a three-image cap for the approved scorebug candidate set', () => {
    expect(parseScorebugGenerateOptions(['--max-files=3'])).toMatchObject({
      execute: false,
      force: false,
      maxFiles: 3,
    });
    expect(() => parseScorebugGenerateOptions(['--max-files=4'])).toThrow(/capped at 3/);
  });

  it('fails paid scorebug execution when OPENAI_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        generateScorebugAssets(FOOTBALL_JS_SCOREBUG_ASSET_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        }),
      ).rejects.toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('skips existing scorebug files unless force is supplied', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const existingPath = join(cwd, 'public/branding/scorebug/candidate-a.webp');
      mkdirSync(join(cwd, 'public/branding/scorebug'), { recursive: true });
      writeFileSync(existingPath, 'existing scorebug placeholder');
      writeFileSync(`${existingPath}.json`, '{}');
      let requestCalled = false;

      const summary = await generateScorebugAssets(
        FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            return {
              content: Buffer.from('new scorebug image'),
              metadata: {
                apiEndpoint: 'images/generations',
                revisedPrompt: null,
              },
            };
          },
        },
      );

      expect(summary).toEqual({
        dryRun: false,
        generated: [],
        skipped: ['candidate-a'],
      });
      expect(requestCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing scorebug placeholder');
    });
  });

  it('generates scorebug report, gallery, safe-zone layout, selection manifest, and stable runtime filename', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const summary = await generateScorebugAssets(
        FOOTBALL_JS_SCOREBUG_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 3,
        },
        {
          requestImage: async (asset) => ({
            content: Buffer.from(`scorebug-image-${asset.assetId}`),
            metadata: {
              apiEndpoint: 'images/generations',
              revisedPrompt: null,
            },
          }),
        },
      );
      const selection = selectScorebugAsset(FOOTBALL_JS_SCOREBUG_ASSET_PLAN, {
        force: false,
        selectedAt: '2026-06-22T00:00:00.000Z',
        selectedCandidateId: 'candidate-a',
      });
      const report = createScorebugAssetReport();
      writeScorebugAssetReportFiles(report);

      expect(summary.generated).toEqual(['candidate-a', 'candidate-b', 'candidate-c']);
      expect(report.validationErrors).toEqual([]);
      expect(report.generatedCount).toBe(3);
      expect(report.assets[0].dimensions).toEqual({ height: 512, width: 1536 });
      expect(validateScorebugLayout(report.layout)).toEqual([]);
      expect(report.layout.safeZones.map((zone) => zone.id)).toEqual([
        'userLogo',
        'userAbbreviation',
        'userScore',
        'userTimeouts',
        'opponentScore',
        'opponentTimeouts',
        'opponentAbbreviation',
        'opponentLogo',
        'quarter',
        'gameClock',
        'possession',
        'downDistance',
        'ballLocation',
      ]);
      expect(selection.selected.runtimeImageUrl).toBe('/branding/scorebug/football-js-scorebug-shell.webp');
      expect(existsSync(join(cwd, FOOTBALL_JS_SCOREBUG_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, SCOREBUG_SELECTION_PATH))).toBe(true);
      expect(existsSync(join(cwd, SCOREBUG_LAYOUT_PATH))).toBe(true);
      expect(existsSync(join(cwd, SCOREBUG_REPORT_PATH))).toBe(true);
      expect(existsSync(join(cwd, SCOREBUG_GALLERY_PATH))).toBe(true);
      expect(readFileSync(join(cwd, SCOREBUG_GALLERY_PATH), 'utf8')).toContain('Football JS Scorebug Gallery');
    });
  });

  it('does not put OpenAI secrets or API calls in scorebug browser-facing manifests', async () => {
    await withTemporaryCwd(async (cwd) => {
      selectScorebugAssetFixture(cwd);

      const files = [
        {
          path: SCOREBUG_SELECTION_PATH,
          text: readFileSync(join(cwd, SCOREBUG_SELECTION_PATH), 'utf8'),
        },
        {
          path: SCOREBUG_LAYOUT_PATH,
          text: readFileSync(join(cwd, SCOREBUG_LAYOUT_PATH), 'utf8'),
        },
      ];

      expect(findBrowserOpenAISecretReferences(files)).toEqual([]);
    });
  });
});

async function withTemporaryCwd(action: (cwd: string) => Promise<void> | void): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'football-brand-assets-'));
  process.chdir(cwd);
  try {
    await action(cwd);
  } finally {
    process.chdir(ORIGINAL_CWD);
    rmSync(cwd, { force: true, recursive: true });
  }
}

function selectBrandAssetsFixture(cwd: string): unknown {
  const titlePath = join(cwd, FOOTBALL_JS_BRAND_ASSET_PLAN[0].outputPath);
  const emblemPath = join(cwd, FOOTBALL_JS_BRAND_ASSET_PLAN[2].outputPath);
  mkdirSync(join(cwd, 'public/branding/title'), { recursive: true });
  mkdirSync(join(cwd, 'public/branding/emblem'), { recursive: true });
  writeFileSync(titlePath, 'title fixture');
  writeFileSync(emblemPath, 'emblem fixture');

  return selectBrandAssets(FOOTBALL_JS_BRAND_ASSET_PLAN, {
    emblemAssetId: 'football-js-emblem-01',
    force: false,
    selectedAt: '2026-06-21T00:00:00.000Z',
    titleAssetId: 'football-js-title-01',
  });
}

function selectCoinAssetsFixture(cwd: string): unknown {
  const headsPath = join(cwd, FOOTBALL_JS_COIN_ASSET_PLAN[0].outputPath);
  const tailsPath = join(cwd, FOOTBALL_JS_COIN_ASSET_PLAN[1].outputPath);
  mkdirSync(join(cwd, 'public/branding/coin'), { recursive: true });
  writeFileSync(headsPath, 'heads fixture');
  writeFileSync(tailsPath, 'tails fixture');

  return selectCoinAssets(FOOTBALL_JS_COIN_ASSET_PLAN, {
    force: false,
    selectedAt: '2026-06-22T00:00:00.000Z',
    selectedSetId: 'candidate-a',
  });
}

function selectTeamLogoAssetsFixture(cwd: string): unknown {
  for (const asset of FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.filter((candidate) => candidate.candidateId === 'candidate-a')) {
    const assetPath = join(cwd, asset.outputPath);
    mkdirSync(join(cwd, 'public/branding/teams', asset.teamId), { recursive: true });
    writeFileSync(assetPath, `${asset.teamId} logo fixture`);
  }

  return selectTeamLogos(FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN, {
    force: false,
    selectedAt: '2026-06-22T00:00:00.000Z',
    selectedCandidateId: 'candidate-a',
  });
}

function selectScorebugAssetFixture(cwd: string): unknown {
  const assetPath = join(cwd, FOOTBALL_JS_SCOREBUG_ASSET_PLAN[0].outputPath);
  mkdirSync(join(cwd, 'public/branding/scorebug'), { recursive: true });
  writeFileSync(assetPath, 'scorebug fixture');

  return selectScorebugAsset(FOOTBALL_JS_SCOREBUG_ASSET_PLAN, {
    force: false,
    selectedAt: '2026-06-22T00:00:00.000Z',
    selectedCandidateId: 'candidate-a',
  });
}

function restoreOptionalEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
